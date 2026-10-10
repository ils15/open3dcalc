/**
 * Persistence Bridge — syncs localStorage ↔ SQLite via Electron IPC.
 *
 * STRATEGY:
 *   - On startup: loads SQLite data into localStorage (stores hydrate as usual)
 *   - On first run: migrates existing localStorage → SQLite
 *   - On beforeunload: saves localStorage → SQLite
 *   - Periodic auto-save (see AUTO_SAVE_INTERVAL_MS) as a safety net
 *
 * This allows all existing Zustand stores to work unchanged — they still
 * use localStorage, but the durable store is SQLite.
 *
 * IMPORTANT: This module uses `window.electronAPI.db` directly (raw string I/O)
 * rather than `dbBridge` (which adds JSON.parse/stringify). This avoids
 * double-serialization because localStorage already stores JSON strings.
 */

import { isKeyAllowed, isManifestUnavailable } from "@/shared/lib/manifestGate";
import { isBetaChannel } from "@/shared/config/betaChannel";
import {
  latchUnavailableClasses,
  type UnavailableEntry,
} from "@/platform/desktop/overrides/unavailableClasses";

/**
 * Re-exported so the bridge's own type is reachable from the module a consumer
 * already imports. The VALUE comes from the leaf module above; this is an
 * alias, not a second latch, so the two cannot disagree.
 */
export type { UnavailableEntry } from "@/platform/desktop/overrides/unavailableClasses";

/* ------------------------------------------------------------------ */
/*  Error tracking                                                      */
/* ------------------------------------------------------------------ */

let consecutiveDbFailures = 0;
const MAX_FAILURES_BEFORE_WARN = 5;

/**
 * True once `loadFromDatabase` has enumerated the stored key set and written
 * every readable, approved non-PII key into localStorage.
 *
 * The stale-key sweep's premise is "a DB row with no localStorage counterpart
 * has been removed at runtime". That premise is only valid AFTER hydration: run
 * it before, and every row looks stale — which is how an unloadable manifest,
 * which hydrates nothing, became the deletion of the whole profile.
 */
let hydrationCompleted = false;

/**
 * What hydration positively did with each manifest-declared key it attempted.
 *
 * The sweep's premise — "a DB row with no localStorage counterpart is stale" —
 * holds only when hydration POSITIVELY populated a key that is also on the
 * static non-PII sweep allowlist. A key hydration could not read (malformed or
 * unsupported stored content, or any unforeseen error) is absent from
 * localStorage BY DESIGN, so that absence is a refusal,
 * not evidence of staleness. Recording the outcome per key lets the sweep tell
 * the two apart: `hydrated` is necessary but not sufficient for deletion, and
 * a key marked `not_hydrated` is preserved.
 *
 * A MISSING record is not proof of staleness either, and fails closed like
 * `not_hydrated`. The sweep re-reads `listKeys()` every cycle, so a key can
 * enter `storage` AFTER hydration — a second writer to the SQLite file (another
 * app instance, a restored or copied profile, or a future store that writes to
 * a dedicated adapter without a localStorage mirror). Hydration never enumerated such a
 * key, so it has no record, and treating that absence as staleness would delete
 * a declared key that was never classified at all. Undeclared keys are always
 * preserved as well: a storage row's absence from the manifest/localStorage is
 * not proof that it is disposable. Only the explicit sweep allowlist owns stale
 * cleanup — see `deleteStaleKeys`.
 *
 * It is keyed by the failure's OUTCOME, not its shape — a key that fails for a
 * new reason is covered without teaching the sweep about that reason — and it
 * is rebuilt on every hydration so a re-init cannot carry stale records
 * forward.
 */
let hydrationOutcomes = new Map<string, "hydrated" | "not_hydrated">();

/**
 * How often the safety-net save runs.
 *
 * Declared here, once, and referred to by name everywhere below — the four
 * comments that used to restate the interval in prose all said "30 seconds"
 * while the constant had been 10 s for a while, and reading one of them is
 * what put the wrong figure into an approved plan. A number that is only ever
 * written once cannot drift from the code it describes; a number repeated in
 * four comments can, and did.
 */
const AUTO_SAVE_INTERVAL_MS = 10_000;

/* ------------------------------------------------------------------ */
/*  Manifest availability                                               */
/* ------------------------------------------------------------------ */

/**
 * The one class the surface reports when the manifest itself will not load.
 *
 * It is NOT a storage key and is not persisted anywhere: `UnavailableEntry`
 * names "a class of stored data that exists but could not be read", and when
 * the manifest is unloadable the class is every key at once. `"*"` keeps that
 * honest while still travelling through the same latch and the same banner as a
 * per-key refusal. Key NAMES and codes only (§3.2).
 */
const MANIFEST_UNAVAILABLE_KEY = "*";
const MANIFEST_UNAVAILABLE_REASON = "manifest_unavailable";

/**
 * A save that could not even be evaluated, because the manifest would not load.
 *
 * Distinct from `PersistenceSaveError`, which reports a pass that lost SOME
 * keys: here no key could be classified, so the pass is refused in full. The
 * old path reached neither error — `collectLocalStorageEntries` filtered every
 * key out at `isKeyAllowed` and the pass reported "Saved 0 keys", a silent
 * no-op indistinguishable from a profile with nothing to save.
 */
export class ManifestUnavailableError extends Error {
  readonly reason = MANIFEST_UNAVAILABLE_REASON;
  constructor() {
    super(
      `${MANIFEST_UNAVAILABLE_REASON}: the manifest could not be loaded, so no key could be classified — save refused`,
    );
    this.name = "ManifestUnavailableError";
  }
}

/**
 * Latch and announce the whole-profile class, so the banner can show it.
 *
 * Called from the manifest failure itself rather than waiting for a per-key
 * `db:load` rejection: every key is denied before any load is issued, so no
 * load ever fails and the signal would otherwise never be raised. Idempotent in
 * effect (the latch holds one entry; re-announcing is harmless).
 */
/**
 * Announce the `open3dcalc:pii-unavailable` class on BOTH `document` and
 * `window`.
 *
 * ## Why two events, not one event dispatched twice
 *
 * The DOM `dispatchEvent` contract: an event object carries an internal
 * "dispatch flag" while it is being dispatched and it is NOT cleared
 * afterwards. Re-dispatching the SAME object is a silent no-op — the second
 * call does nothing and the second target's listeners never run. So the
 * obvious "dispatch once on document, once on window" with one shared
 * `CustomEvent` reaches only the FIRST target: a subscriber on `window` (a
 * React component, a plain listener — anywhere but `document`) never hears the
 * announcement, which is exactly the failure this dispatch pattern was written
 * to avoid.
 *
 * A fresh event per target is the fix, and it is why this is a helper rather
 * than an inline pair: two call sites needed it, and the bug is invisible
 * (both dispatches look correct) unless you know the flag rule.
 */
function announcePiiUnavailable(entries: UnavailableEntry[]): void {
  if (typeof document === "undefined") return;
  const make = (): CustomEvent =>
    new CustomEvent("open3dcalc:pii-unavailable", {
      detail: { unavailable: entries },
    });
  document.dispatchEvent(make());
  window.dispatchEvent(make());
}

function reportManifestUnavailable(): void {
  const entry: UnavailableEntry = {
    key: MANIFEST_UNAVAILABLE_KEY,
    reason: MANIFEST_UNAVAILABLE_REASON,
  };
  latchUnavailableClasses([entry]);
  console.warn(
    `[persistence-bridge] ${MANIFEST_UNAVAILABLE_REASON} — no key could be classified`,
  );
  announcePiiUnavailable([entry]);
}

/* ------------------------------------------------------------------ */
/*  Known localStorage keys used throughout the app                    */
/*  (Keep in sync with all stores, components, and migration logic)     */
/* ------------------------------------------------------------------ */

/**
 * The keys the bridge migrates, hydrates and saves.
 *
 * User-content keys are handled by their dedicated local-data adapters, not
 * this preference/UI-state bridge. Keeping them out of the generic key list
 * prevents one persistence path from overwriting another or hydrating a
 * partially-read profile as if it were empty.
 *
 * The recovery marker `open3dcalc_migration_done_v2` is PII-bearing (its value
 * embeds the raw pre-migration history) and is also gone from this list: it is
 * read-only legacy input, and re-materializing it on every startup was the
 * self-sustaining exposure the plan records. It survives in the `storage`
 * table, retained but never mirrored into the renderer.
 *
 * What remains are preferences and UI state: `pii:false`, plaintext allowed.
 * They are not PII and keep their localStorage mirror.
 */
const LOCALSTORAGE_KEYS = [
  "open3dcalc_settings_v2",
  "open3dcalc_catalog_v1",
  "open3dcalc_filaments",
  "open3dcalc_color_palette_v1",
  "open3dcalc_consent_v1",
  "open3dcalc_tutorial_v1",
  "open3dcalc_onboarded",
  "open3dcalc_dashboard_v1",
  "open3dcalc_sections",
  "open3dcalc_theme",
] as const;

/**
 * Only known, non-PII localStorage keys may be removed by the stale sweep.
 * This explicit allowlist is deliberately narrower than the SQLite key space:
 * unknown, internal, legacy PII, and future keys have no ownership evidence in
 * renderer localStorage and must survive ordinary startup/sweeps unchanged.
 */
const STALE_SWEEP_ALLOWLIST = new Set<string>([
  "open3dcalc_settings_v2",
  "open3dcalc_catalog_v1",
  "open3dcalc_filaments",
  "open3dcalc_color_palette_v1",
  "open3dcalc_consent_v1",
  "open3dcalc_tutorial_v1",
  "open3dcalc_onboarded",
  "open3dcalc_dashboard_v1",
  "open3dcalc_sections",
  "open3dcalc_theme",
]);

/**
 * Keys the bridge must never write into, or read out of, the renderer.
 *
 * These are the migrated PII keys and the PII-bearing recovery marker. The
 * explicit list is what makes the refusal independent of the manifest's `pii`
 * flag: the bridge denies on the KEY, so a manifest that lost or mis-declared
 * an entry cannot reopen the plaintext path. See `isPiiBridgeKey`.
 */
const PII_BRIDGE_KEYS = new Set<string>([
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
  "open3dcalc_migration_done_v2",
]);

/**
 * True for a key whose value must never reach the renderer through this bridge.
 *
 * Key NAMES only — the reason this is a set and not a value inspection (§3.2).
 */
function isPiiBridgeKey(key: string): boolean {
  return PII_BRIDGE_KEYS.has(key);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Check whether we're running inside Electron with the IPC bridge available.
 */
function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.db;
}

/**
 * Return the raw IPC db API. Throws if not in Electron — call `isElectron()` first.
 */
function db() {
  // Non-null assertion safe because caller must guard with isElectron()
  return window.electronAPI!.db;
}

/**
 * Return the known and manifest-approved localStorage source values once.
 * Capturing before the asynchronous writes keeps iteration stable while the
 * IPC adapter is saving rows.
 */
function collectLocalStorageEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const seen = new Set<string>();

  const collect = (key: string): void => {
    if (seen.has(key) || isPiiBridgeKey(key) || !isKeyAllowed(key)) return;
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    seen.add(key);
    entries.push([key, raw]);
  };

  for (const key of LOCALSTORAGE_KEYS) collect(key);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("open3dcalc_")) collect(key);
  }
  return entries;
}

/**
 * Record one failed operation.
 *
 * The log line carries the real error; the DOM event deliberately does NOT.
 *
 * `open3dcalc:db-error` is dispatched into the renderer, where it becomes
 * user-visible text via `DbErrorBanner`, so its `detail.message` is a FIXED
 * string and stays one — no error message, no key name, no stack, nothing
 * derived from a value. Interpolating `error` into it would be the obvious
 * "improvement" and it is the PII-exposure path this file is written to keep
 * shut (§3.2 — logs carry key NAMES only, never values, and a user-facing
 * string is a wider channel than a log). The cost of the fixed string is that
 * it cannot say which key failed; that diagnosis belongs in the console line
 * above, which already has the error.
 */
function noteDbFailure(error: unknown, operation: string): void {
  console.warn(`[persistence-bridge] Failed to ${operation}:`, error);
  consecutiveDbFailures++;
  if (consecutiveDbFailures === MAX_FAILURES_BEFORE_WARN) {
    if (typeof document !== "undefined") {
      const event = new CustomEvent("open3dcalc:db-error", {
        detail: {
          message:
            "Database unavailable — data will not persist between sessions.",
        },
      });
      document.dispatchEvent(event);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Core operations                                                     */
/* ------------------------------------------------------------------ */

/**
 * A class of stored data that exists but could not be read, and why.
 *
 * Distinct from an error, and distinct from an empty value: the app continues,
 * the rest of the profile loads, and the user is told which class is missing and
 * what to do about it. A refusal MUST NOT look like data loss — a store hydrated
 * with an empty string would both read as "you have no customers" and then
 * overwrite the very row that could not be read on the next save.
 */
/**
 * Load all persisted data from SQLite into localStorage.
 * Called once at app startup (after any migration).
 *
 * ## Per-key isolation, and why it is not optional
 *
 * This used to `await db().load(key)` inside a bare loop, so a single unreadable
 * row rejected the whole function. An inaccessible or malformed row propagated
 * out of here, out of `initPersistenceBridge`, and `main.tsx` rendered `<StartupBridgeFailure/>`
 * instead of `<App/>`. Worse, the throw happened at step 2, so the app never
 * registered its `beforeunload` handler or its auto-save interval AT ALL: the
 * profile could not be saved even for the keys that were perfectly readable. One
 * unreadable row took down the application.
 *
 * A per-value read failure is now reported without blocking other local data.
 *
 * So a per-value read failure is collected and reported, and hydration continues.
 * Fail-closed is preserved on both sides: an unreadable value is never written
 * into `localStorage` (it is not decoded or materialized as an unsupported raw
 * value either), and it is never deleted from SQLite. A STRUCTURAL failure —
 * `listKeys` itself failing, an unreadable manifest — is still terminal, because
 * then there is no key set to isolate and hydrating from stale localStorage would
 * look like success and then lose every write.
 */
async function loadFromDatabase(): Promise<void> {
  // A structural manifest failure is detected BEFORE the per-key loop: with
  // the manifest unloadable `isKeyAllowed` denies every key, so the loop below
  // would skip the whole profile and report a successful empty hydration. Latch
  // the class instead (a `db:load` is never issued, so nothing else would), and
  // leave `hydrationCompleted` false so the sweep refuses to run.
  if (isManifestUnavailable()) {
    reportManifestUnavailable();
    console.warn(
      "[persistence-bridge] Hydration skipped: manifest unavailable",
    );
    return;
  }

  const keys = await db().listKeys();
  const values: Array<[string, string]> = [];
  const unavailable: UnavailableEntry[] = [];
  // Rebuilt per hydration: the record of what THIS pass could positively
  // populate, so the sweep can refuse to treat a refusal as staleness.
  hydrationOutcomes = new Map();

  for (const key of keys) {
    // SPEC-01 gate: unknown keys are never materialized locally.
    if (!isKeyAllowed(key)) continue;
    // Local user-data keys use their dedicated storage route and are never
    // materialized through this generic renderer bridge. The row
    // is still RECORDED as an outcome so the sweep can tell a refusal from
    // staleness and preserve it (copy-without-delete); see `deleteStaleKeys`.
    if (isPiiBridgeKey(key)) {
      hydrationOutcomes.set(key, "not_hydrated");
      continue;
    }
    try {
      const raw = await db().load(key);
      if (raw !== null && raw !== undefined) {
        values.push([key, raw]);
        hydrationOutcomes.set(key, "hydrated");
      } else {
        // Enumerated but nothing came back: the key cannot be positively
        // populated, so it is recorded as unhydrated rather than left absent
        // and therefore looking stale to the sweep.
        hydrationOutcomes.set(key, "not_hydrated");
      }
    } catch (error) {
      // One key, isolated. The reason survives the IPC boundary as the
      // main process's own code, because `db:load` is told to attach it to the
      // rejection rather than relying on Electron's string flattening — which
      // rewrites it to "Error invoking remote method 'db:load': …" and loses
      // every structured field.
      hydrationOutcomes.set(key, "not_hydrated");
      unavailable.push({ key, reason: refusalReasonFromError(error) });
    }
  }

  // Read every row successfully before touching localStorage. A DB read error
  // must reject startup without applying a partial hydration to the renderer.
  for (const [key, raw] of values) localStorage.setItem(key, raw);

  if (unavailable.length > 0) {
    // Latched before the event, because the event is raised with no subscriber
    // mounted yet — see `unavailableClasses.ts` for why the latch is a separate
    // leaf module rather than a field of this one.
    latchUnavailableClasses(unavailable);
    // Announced, not silently skipped: a class of data the user cannot see
    // must be said out loud, or "my customers are gone" is indistinguishable
    // from "this app decided not to show you your customers".
    console.warn(
      `[persistence-bridge] ${unavailable.length} key(s) unavailable and quarantined: ` +
        unavailable.map((u) => `${u.key} (${u.reason})`).join(", "),
    );
    if (typeof document !== "undefined") {
      // On BOTH `document` and `window`, each with a FRESH event — see
      // `announcePiiUnavailable` for why one shared event cannot reach the
      // second target. A React component or a plain subscriber sits on
      // `window`, so a `document`-only dispatch (or a same-instance re-dispatch)
      // makes the announcement unreceivable, which is the same as no
      // announcement.
      announcePiiUnavailable(unavailable);
    }
  }

  console.log(
    `[persistence-bridge] Loaded ${values.length}/${keys.length} keys from SQLite` +
      (unavailable.length > 0 ? ` (${unavailable.length} quarantined)` : ""),
  );

  // Only now is the sweep's premise valid: every stored key was enumerated
  // and every readable one is in localStorage. A key hydration could NOT read
  // is the one exception, and `hydrationOutcomes` records it so the sweep does
  // not mistake its (deliberate) absence for staleness — see `deleteStaleKeys`.
  hydrationCompleted = true;
}

/**
 * Read a generic storage failure code from a rejected `db:load`.
 *
 * Electron flattens an error crossing `ipcRenderer.invoke` into a plain string
 * prefixed "Error invoking remote method 'db:load': ", so `error.reason` and
 * `error.code` do not survive. Two sources, in order of trust:
 *
 *  1. the structured fields, when the rejection is direct (a test, or a future
 *     structured-result contract); then
 *  2. the code as a substring of the flattened message, which is why
 *     `electron/main.ts` puts the code IN the message before re-throwing.
 *
 * The fallback is a generic `unreadable` rather than a guess: inventing a
 * specific reason from a mangled string is how a wrong reason reaches a user.
 */
function refusalReasonFromError(error: unknown): string {
  const structured = (error as { reason?: unknown } | null)?.reason;
  if (typeof structured === "string" && structured.length > 0) {
    return structured;
  }
  const message = String(
    (error as { message?: unknown } | null)?.message ?? error,
  );
  if (message.includes("manifest_unavailable")) return "manifest_unavailable";
  return "unreadable";
}

/**
 * A save pass that lost one or more keys.
 *
 * Reported as ONE error carrying every key and its own error, rather than the
 * first refusal: a single quarantined PII key explains a failed pass, and five
 * of them do not. What the caller does with it is deliberately narrow — the
 * console line it produces receives this error whole, so the aggregated
 * message (every lost key) and every per-key error underneath it are what
 * reaches the log. The `open3dcalc:db-error` signal that `noteDbFailure` also
 * raises does NOT carry it: that event's text is a fixed string, and an error
 * is not something to put in front of a user. See `noteDbFailure`.
 *
 * Key NAMES only, in the message and in the log — never a value (§3.2).
 */
export class PersistenceSaveError extends Error {
  readonly failures: ReadonlyArray<{ key: string; error: unknown }>;

  constructor(failures: ReadonlyArray<{ key: string; error: unknown }>) {
    super(
      `Failed to save ${failures.length} localStorage key(s) to SQLite: ` +
        failures.map(({ key }) => key).join(", "),
    );
    this.name = "PersistenceSaveError";
    this.failures = failures;
  }
}

/**
 * Save all localStorage data to SQLite.
 * Called on beforeunload and periodically (every 10 s).
 *
 * Moves JSON strings as-is from localStorage to SQLite.
 *
 * Per key, not per pass: a refused key is not a one-off. A quarantined PII key
 * (ADR-002 §2.2.1) is refused on EVERY write until the user migrates or
 * eliminates it, so the `await` this loop used to put in its header threw out
 * of the function on the first one and every key after it in
 * LOCALSTORAGE_KEYS went unpersisted without a word — a failure that was both
 * total and permanent. The loop continues, and the pass reports itself as a
 * whole once every key has had its turn.
 */
async function saveToDatabase(): Promise<void> {
  // "No keys are eligible" and "no key could be evaluated" are different facts.
  // Without this check the second collapses into the first: every key is
  // filtered out at `isKeyAllowed`, the loop runs zero times, and the pass
  // reports "Saved 0 keys" — a silent no-op whose writes exist only in
  // localStorage and die on restart.
  if (isManifestUnavailable()) {
    reportManifestUnavailable();
    throw new ManifestUnavailableError();
  }

  const entries = collectLocalStorageEntries();
  const failures: Array<{ key: string; error: unknown }> = [];
  for (const [key, raw] of entries) {
    try {
      await db().save(key, raw);
    } catch (error) {
      failures.push({ key, error });
    }
  }
  if (failures.length > 0) throw new PersistenceSaveError(failures);
  console.log(`[persistence-bridge] Saved ${entries.length} keys to SQLite`);
}

/**
 * Delete known non-PII SQLite keys that were hydrated and then removed locally.
 * Unknown and legacy rows are never inferred stale from localStorage absence.
 */
async function deleteStaleKeys(): Promise<void> {
  // The sweep deletes a DB row when its key is absent from localStorage. Both
  // halves of that premise have to be true before it may run:
  //
  //  - the manifest must be loadable, or "the key is not in localStorage" is
  //    indistinguishable from "the key was never evaluated"; and
  //  - hydration must have completed, or localStorage was never populated and
  //    every row looks stale.
  //
  // Refusing to run is the fail-closed choice: the cost of a skipped sweep is a
  // stale row surviving one more cycle, and the cost of a wrongly-run sweep is
  // permanent deletion of a user's profile.
  if (isManifestUnavailable()) {
    console.warn(
      "[persistence-bridge] Skipping stale-key sweep: manifest unavailable",
    );
    return;
  }
  if (!hydrationCompleted) {
    console.warn(
      "[persistence-bridge] Skipping stale-key sweep: hydration not complete",
    );
    return;
  }

  try {
    const dbKeys = await db().listKeys();
    const localKeys = new Set<string>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) localKeys.add(key);
    }

    for (const dbKey of dbKeys) {
      if (localKeys.has(dbKey)) continue;

      // Positive proof plus ownership allowlist, not absence. A row may be
      // deleted as stale ONLY when hydration populated an explicitly known,
      // non-PII manifest key and the renderer counterpart was subsequently
      // removed at runtime.
      if (
        hydrationOutcomes.get(dbKey) === "hydrated" &&
        STALE_SWEEP_ALLOWLIST.has(dbKey) &&
        !isPiiBridgeKey(dbKey) &&
        isKeyAllowed(dbKey)
      ) {
        await db().delete(dbKey);
        continue;
      }

      // Absence is never enough to classify an arbitrary SQLite row as stale.
      // In particular, unknown keys and old PII may be deliberately absent from
      // the renderer. Delete only an explicitly allowlisted non-PII key which
      // this hydration positively materialized and which the manifest still
      // recognizes; every other row is preserved byte-for-byte.
      if (
        !STALE_SWEEP_ALLOWLIST.has(dbKey) ||
        isPiiBridgeKey(dbKey) ||
        hydrationOutcomes.get(dbKey) !== "hydrated" ||
        !isKeyAllowed(dbKey)
      ) {
        console.warn(
          `[persistence-bridge] Preserving key ${dbKey}: key is not proven stale by the non-PII allowlist and hydration`,
        );
        continue;
      }
      await db().delete(dbKey);
    }
  } catch (error) {
    console.warn("[persistence-bridge] Failed to clean stale keys:", error);
  }
}

/**
 * Test-only seam: read the bridge's PII denylist.
 *
 * Exported so the T3.1/T3.2 spec can assert, as data, that every migrated PII
 * key is on the list — a future edit that removes one fails there rather than
 * silently reopening the plaintext mirror.
 */
export function piiBridgeKeysForTests(): readonly string[] {
  return [...PII_BRIDGE_KEYS];
}

/**
 * Import localStorage data when SQLite does not yet contain every approved
 * source key. This also resumes a previous import interrupted after any
 * committed prefix of per-key writes.
 */
async function migrateIfNeeded(): Promise<void> {
  const existingKeys = new Set(await db().listKeys());
  const sourceEntries = collectLocalStorageEntries();
  const missingSourceKeys = sourceEntries.some(
    ([key]) => !existingKeys.has(key),
  );

  if (!missingSourceKeys) {
    // SQLite is authoritative only when it already contains every allowed
    // source key. A theme seed or partial write must never suppress recovery.
    console.log(
      "[persistence-bridge] SQLite contains all localStorage source keys; skipping import",
    );
    return;
  }

  // Idempotent upserts make this restart-safe after any prefix of db.save
  // writes has committed. Failure intentionally propagates to abort renderer
  // startup; localStorage is left untouched until the entire import succeeds.
  console.log(
    "[persistence-bridge] SQLite is incomplete — migrating localStorage → SQLite",
  );
  for (const [key, raw] of sourceEntries) await db().save(key, raw);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Initialize the persistence bridge.
 *
 * Must be called ONCE at app startup, BEFORE React renders,
 * so that Zustand stores hydrate with SQLite-backed data.
 *
 * Call flow:
 *   1. Migrate localStorage → SQLite if first run
 *   2. Load SQLite data → localStorage (overwrites any stale localStorage)
 *   3. Register beforeunload handler for save-on-close
 *   4. Start periodic auto-save (see AUTO_SAVE_INTERVAL_MS)
 */
export async function initPersistenceBridge(): Promise<void> {
  if (isBetaChannel) {
    console.warn("[persistence-bridge] SQLite bridge is unavailable in Beta");
    return;
  }
  if (!isElectron()) {
    console.log(
      "[persistence-bridge] Not running in Electron — using localStorage only",
    );
    return;
  }

  try {
    if (isManifestUnavailable()) {
      // Neither import nor hydrate: no key can be classified. Latch the class
      // now, from the manifest failure itself, so the banner can show it — no
      // `db:load` is ever issued, so no per-key rejection could carry it. The
      // handlers below are still registered: in-session writes must be REFUSED
      // (visibly, by `saveToDatabase`) rather than silently skipped, and the
      // sweep must refuse to run.
      reportManifestUnavailable();
    } else {
      // 1. Migrate localStorage → SQLite if first run or a prior startup was
      //    interrupted. Any partial failure rejects before renderer hydration.
      await migrateIfNeeded();

      // 2. Load SQLite data into localStorage only after the complete migration.
      //    Per-value refusals are collected INSIDE this call and do not reject —
      //    see `loadFromDatabase`. Only a structural failure reaches the catch.
      await loadFromDatabase();
    }
  } catch (error) {
    noteDbFailure(error, "initialize persistence bridge");
    throw error;
  }

  // 3. Set up save-on-close via beforeunload
  //
  // NOTE: beforeunload fires when the window is about to close.
  // Electron's IPC invoke returns a Promise; we await it to flush.
  // As a safety net, the periodic save (AUTO_SAVE_INTERVAL_MS) guards against
  // data loss if beforeunload doesn't fully complete.
  window.addEventListener("beforeunload", () => {
    void saveToDatabase().catch((error: unknown) =>
      noteDbFailure(error, "save localStorage to SQLite"),
    );
  });

  // 4. Periodic auto-save on AUTO_SAVE_INTERVAL_MS (safety net)
  //    Also runs stale-key cleanup on each cycle.
  //
  //    The two are settled independently on purpose. They were one `try`, so a
  //    single refused key threw out of the block and the sweep never ran for
  //    that cycle — while a refused key is exactly the kind that keeps being
  //    refused, so the sweep was cancelled on every cycle from then on. The
  //    sweep only deletes rows whose localStorage counterpart is gone, and a
  //    write that was refused cannot change any key's membership, so the two
  //    never actually depended on each other.
  setInterval(async () => {
    await Promise.allSettled([
      saveToDatabase().catch((error: unknown) =>
        noteDbFailure(error, "save localStorage to SQLite"),
      ),
      deleteStaleKeys(),
    ]);
  }, AUTO_SAVE_INTERVAL_MS);

  console.log(
    "[persistence-bridge] Initialized — localStorage ↔ SQLite sync active",
  );
}
