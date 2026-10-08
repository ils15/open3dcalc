/**
 * Re-home legacy plaintext browser PII into the encrypted vault (Beta5 Wave 3,
 * HIGH-3 — the WEB remediation).
 *
 * ## The defect this closes
 *
 * After the three browser PII stores migrated onto the vault they set
 * `skipHydration: true`: nothing hydrates them at construction, and after
 * unlock each store hydrates from the VAULT. A profile that predates the vault
 * still holds its customers/quotes/history in plaintext `localStorage` under the
 * old keys, while the vault is empty. Unlock therefore rehydrates EMPTY stores:
 * the data is retained in plaintext but INACCESSIBLE, which is indistinguishable
 * from data loss on every PII surface. The detection half
 * (`detectLegacyPlaintextPii`) reports the residue but had no production caller.
 *
 * ## What this module does — and refuses to do
 *
 * `migrateLegacyPlaintextPiiToVault()` is COPY-WITHOUT-DELETE and consent-gated:
 *
 *  1. No migration consent → refuse (`consent_required`). Nothing is written.
 *  2. The vault is not `hydrated` (locked or incapable) → refuse
 *     (`vault_unavailable`). Nothing is written, and no plaintext is moved
 *     anywhere: the fail-closed rule is not relaxed here.
 *  3. Read the plaintext residue under the three replaced keys.
 *  4. Write it into the ENCRYPTED destination through the hydrated stores (their
 *     own merge-and-dedupe importers), then VERIFY by reading the sealed vault
 *     record back that the records actually landed.
 *  5. Only after verification, record a value-free completion marker so a later
 *     run is a no-op.
 *  6. The plaintext source is NEVER deleted. It remains and is disclosed (the
 *     legacy-residue surface), consistent with ADR-002 §2.2's "never silently
 *     migrated, never silently deleted".
 *
 * ## Idempotency and non-destructiveness
 *
 * The store importers dedupe by id, and records with no id are given a
 * deterministic id before import, so a re-run never duplicates. A corrupt or
 * unrecognisable value is skipped rather than imported, and verification fails
 * until every residue record is provably in the vault — so a corrupt source can
 * never replace the destination with an empty value, and the migration never
 * claims completion it did not achieve.
 *
 * ## Desktop re-home (same semantics, different source)
 *
 * On desktop the three migrated PII keys live as SQLite `storage` rows that the
 * `persistence-bridge` deliberately stops hydrating, so a legacy profile has the
 * same defect with a different source: the residue is retained in SQLite but
 * invisible to the renderer. This module is the ONE implementation of the
 * re-home; `options.fetchLegacy` supplies the desktop residue over the
 * read-only `privacy:legacy-rows` IPC and the rest of the contract — consent,
 * fail-closed vault check, copy-without-delete, verify-before-complete,
 * idempotency — is unchanged. When the sync `read` finds no residue and
 * `fetchLegacy` is absent the injected default reads the desktop rows; on the
 * web it reports `not_applicable` and the `localStorage` path is used.
 */

import { guardedStorage } from "@/shared/lib/manifestStorage";
import { isBetaChannel } from "@/shared/config/betaChannel";
import {
  detectLegacyPlaintextPii,
  type LegacyPiiPlaintextKey,
} from "@/shared/lib/legacyPiiPlaintext";
import {
  fetchDesktopLegacyPiiRows,
  type DesktopLegacyPiiRowsResult,
  type LegacyPiiRowMap,
} from "@/shared/lib/migration/desktopLegacyRows";
import {
  didPiiWritesCommit,
  getPiiStoreAccessState,
  readPiiPersistedRecord,
} from "@/shared/lib/crypto/piiStoreHydration";
import { useConsentStore } from "@/shared/stores/consentStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useHistoryStore } from "@/shared/stores/historyStore";

const CUSTOMERS_KEY = "open3dcalc_customers_v1" as const;
const QUOTES_KEY = "open3dcalc_quotes_v1" as const;
const HISTORY_KEY = "open3dcalc_history_v2" as const;

/**
 * The value-free completion marker.
 *
 * Declared non-PII in the SPEC-01 manifest; it carries only a version and the
 * migrated key NAMES — never a record field. It is the "already re-homed" fact
 * that makes a second run a no-op without re-reading and re-writing the vault.
 */
export const LEGACY_PII_REHOME_MARKER_KEY = "open3dcalc_legacy_pii_rehomed_v1";

/** The `state` array field each store persists under its logical key. */
const RECORD_FIELD: Record<LegacyPiiPlaintextKey, string> = {
  [CUSTOMERS_KEY]: "customers",
  [QUOTES_KEY]: "quotes",
  [HISTORY_KEY]: "entries",
};

/** Deterministic id prefix for a residue record that carries no id of its own. */
const ID_PREFIX: Record<LegacyPiiPlaintextKey, string> = {
  [CUSTOMERS_KEY]: "cust",
  [QUOTES_KEY]: "quote",
  [HISTORY_KEY]: "hist",
};

export type LegacyPiiRehomeStatus =
  /** Beta does not inspect or re-home Stable legacy residue. */
  | "disabled"
  /** The completion marker exists: a prior run already re-homed the residue. */
  | "already_migrated"
  /** There is no plaintext residue under any of the three keys. */
  | "no_residue"
  /** The desktop source could not be read, so residue absence is unverified. */
  | "source_unavailable"
  /** The user has not granted migration consent; nothing was written. */
  | "consent_required"
  /** The vault is locked or incapable; nothing was written. */
  | "vault_unavailable"
  /** Every residue key was written and verified; the marker is set. */
  | "migrated"
  /** Some residue could not be written or verified; the marker is NOT set. */
  | "incomplete";

export interface LegacyPiiRehomeResult {
  status: LegacyPiiRehomeStatus;
  /** Key NAMES only, in migration order. Never a record value. */
  migratedKeys: LegacyPiiPlaintextKey[];
  /** Key NAMES skipped because their residue was empty or unrecognisable. */
  skippedKeys: LegacyPiiPlaintextKey[];
}

export interface LegacyPiiRehomeOptions {
  /**
   * How to read a legacy plaintext value. Injectable so a test can exercise the
   * migration without a DOM, mirroring `detectLegacyPlaintextPii`. Defaults to
   * the manifest-gated `localStorage` facade.
   */
  read?: (key: string) => string | null;
  /**
   * Async source of the legacy residue, consulted ONLY when the sync `read`
   * finds none. This is the DESKTOP source: the residue is in SQLite rows the
   * persistence bridge never hydrates, so it must be fetched over IPC. Defaults
   * to the read-only `privacy:legacy-rows` reader, which distinguishes a web
   * runtime from a failed or unavailable desktop source.
   */
  fetchLegacy?: () => Promise<DesktopLegacyPiiRowsResult>;
}

function rehomeResult(
  status: LegacyPiiRehomeStatus,
  migratedKeys: LegacyPiiPlaintextKey[] = [],
  skippedKeys: LegacyPiiPlaintextKey[] = [],
): LegacyPiiRehomeResult {
  return { status, migratedKeys, skippedKeys };
}

/** True once a run has been verified and recorded. */
function isRehomeComplete(): boolean {
  return guardedStorage.getItem(LEGACY_PII_REHOME_MARKER_KEY) !== null;
}

/** Record the completion as a value-free flag (version + key names only). */
function recordRehomeComplete(keys: LegacyPiiPlaintextKey[]): void {
  guardedStorage.setItem(
    LEGACY_PII_REHOME_MARKER_KEY,
    JSON.stringify({ v: 1, keys }),
  );
}

/**
 * Extract the record array from a legacy value.
 *
 * A zustand persist wrapper is `{ state: { <field>: [...] }, version: N }`; a
 * raw array is the pre-zustand shape the same key held. Anything else — invalid
 * JSON, or an object with no recognisable array — is `null` (unrecognisable).
 */
function extractRecords(raw: string, field: string): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const state = (parsed as { state?: unknown }).state;
    if (state && typeof state === "object") {
      const records = (state as Record<string, unknown>)[field];
      if (Array.isArray(records)) return records;
    }
  }
  return null;
}

/**
 * Give every residue record a stable id so import dedupes and verification can
 * name exactly what should have landed. Records that already carry a non-empty
 * string id are passed through unchanged.
 */
function withDeterministicIds(records: unknown[], prefix: string): unknown[] {
  return records.map((record, index) => {
    if (record && typeof record === "object" && !Array.isArray(record)) {
      const id = (record as { id?: unknown }).id;
      if (typeof id === "string" && id.trim().length > 0) return record;
      return {
        ...(record as Record<string, unknown>),
        id: `legacy_pii_${prefix}_${index}`,
      };
    }
    return record;
  });
}

/** The string ids the import must have placed in the vault. */
function idsOf(records: unknown[]): string[] {
  const ids: string[] = [];
  for (const record of records) {
    if (record && typeof record === "object") {
      const id = (record as { id?: unknown }).id;
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
}

/** Merge the prepared records into the hydrated store; return the imported count. */
function importRecords(key: LegacyPiiPlaintextKey, records: unknown[]): number {
  switch (key) {
    case CUSTOMERS_KEY:
      return useCustomerStore
        .getState()
        .importCustomers(JSON.stringify({ customers: records })).imported;
    case QUOTES_KEY:
      return useQuoteStore
        .getState()
        .importQuotes(JSON.stringify({ quotes: records })).imported;
    case HISTORY_KEY:
      return useHistoryStore
        .getState()
        .importJson(JSON.stringify({ entries: records })).imported;
  }
}

/**
 * Verify, by reading the SEALED vault record back, that every prepared id is
 * present. A locked/refused vault yields `null` from `readPiiPersistedRecord`,
 * which fails verification — fail-closed, never a silent success.
 */
async function vaultHolds(
  key: LegacyPiiPlaintextKey,
  expectedIds: string[],
): Promise<boolean> {
  const raw = await readPiiPersistedRecord(key);
  if (raw === null) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  const records = (parsed as { state?: Record<string, unknown> })?.state?.[
    RECORD_FIELD[key]
  ];
  if (!Array.isArray(records)) return false;
  const present = new Set(idsOf(records));
  return expectedIds.every((id) => present.has(id));
}

/**
 * Resolve the reader the re-home will actually use.
 *
 * The web path wins whenever the sync `read` finds residue: that data is the
 * user's, in `localStorage`, and there is no reason to touch IPC. Only when the
 * sync read finds NOTHING is the async source consulted — the desktop case,
 * where the residue is in SQLite. The result keeps not-applicable, positively
 * absent, available and unavailable sources distinct.
 */
type LegacyReadResolution =
  | { status: "local_available"; read: (key: string) => string | null }
  | { status: "not_applicable"; read: (key: string) => string | null }
  | { status: "absent" }
  | { status: "available"; read: (key: string) => string | null }
  | { status: "unavailable" };

async function resolveLegacyRead(
  localRead: (key: string) => string | null,
  fetchLegacy: (() => Promise<DesktopLegacyPiiRowsResult>) | undefined,
): Promise<LegacyReadResolution> {
  if (detectLegacyPlaintextPii(localRead).present) {
    return { status: "local_available", read: localRead };
  }

  const fetch = fetchLegacy ?? fetchDesktopLegacyPiiRows;
  let result: DesktopLegacyPiiRowsResult;
  try {
    result = await fetch();
  } catch {
    return { status: "unavailable" };
  }
  switch (result.status) {
    case "not_applicable":
      return { status: "not_applicable", read: localRead };
    case "absent":
      return { status: "absent" };
    case "unavailable":
      return { status: "unavailable" };
    case "available": {
      const rows: LegacyPiiRowMap = result.rows;
      return {
        status: "available",
        read: (key) => rows[key as LegacyPiiPlaintextKey] ?? localRead(key),
      };
    }
  }
}

/**
 * Re-home the legacy plaintext residue into the vault.
 *
 * See the module header for the full contract. Returns a value-free outcome; it
 * never throws for a refusal (an unexpected storage failure is reported as
 * `incomplete`), so a caller may run it on the post-unlock path without turning
 * a migration problem into an unlock error.
 */
export async function migrateLegacyPlaintextPiiToVault(
  options: LegacyPiiRehomeOptions = {},
): Promise<LegacyPiiRehomeResult> {
  // The Beta test-only channel must not read, copy, or mutate Stable data.
  if (isBetaChannel) return rehomeResult("disabled");

  // 5 (first): a verified run already happened — do not touch anything.
  if (isRehomeComplete()) return rehomeResult("already_migrated");

  const localRead =
    options.read ?? ((key: string) => guardedStorage.getItem(key));
  const source = await resolveLegacyRead(localRead, options.fetchLegacy);
  if (source.status === "unavailable") {
    return rehomeResult("source_unavailable");
  }
  if (source.status === "absent") return rehomeResult("no_residue");
  const read = source.read;

  const report = detectLegacyPlaintextPii(read);
  if (!report.present) return rehomeResult("no_residue");

  // 1: migration is never silent — no consent, no write.
  if (useConsentStore.getState().needsMigrationConsent()) {
    return rehomeResult("consent_required");
  }

  // 2: the fail-closed rule is not relaxed for a migration.
  if (getPiiStoreAccessState().status !== "hydrated") {
    return rehomeResult("vault_unavailable");
  }

  // 3–4: read, then write into the hydrated stores (which persist to the vault).
  const attempted: LegacyPiiPlaintextKey[] = [];
  const skipped: LegacyPiiPlaintextKey[] = [];
  const expectedIds = new Map<LegacyPiiPlaintextKey, string[]>();
  let unreadable = false;

  for (const entry of report.keys) {
    if (!entry.present) continue;
    const key = entry.key;
    const raw = read(key);
    if (raw === null) {
      // The residue vanished between detection and the read: nothing to do.
      skipped.push(key);
      continue;
    }
    const records = extractRecords(raw, RECORD_FIELD[key]);
    if (records === null) {
      // Present but unrecognisable: never import garbage over a real record.
      skipped.push(key);
      unreadable = true;
      continue;
    }
    if (records.length === 0) {
      // An empty array is residue with nothing to re-home.
      skipped.push(key);
      continue;
    }

    // Import is additive and dedupes by id, so a re-run (or a marker that was
    // lost) re-imports nothing yet leaves the destination intact. Whether the
    // records are ALREADY there is answered by verification below, never by the
    // imported count — which is 0 for a full dedupe and must not read as
    // failure.
    const prepared = withDeterministicIds(records, ID_PREFIX[key]);
    expectedIds.set(key, idsOf(prepared));
    importRecords(key, prepared);
    attempted.push(key);
  }

  if (attempted.length === 0) {
    return rehomeResult(unreadable ? "incomplete" : "no_residue", [], skipped);
  }

  // 4 (cont.): every write the stores issued must have COMMITTED, or the data
  // is not durable and completion would be a lie.
  if (!(await didPiiWritesCommit())) {
    return rehomeResult("incomplete", [], skipped);
  }

  // Verify by reading the sealed records back. A key is migrated only when the
  // vault provably holds every record the residue contained.
  const migrated: LegacyPiiPlaintextKey[] = [];
  let verificationFailed = unreadable;
  for (const key of attempted) {
    if (await vaultHolds(key, expectedIds.get(key) ?? [])) {
      migrated.push(key);
    } else {
      verificationFailed = true;
    }
  }

  if (verificationFailed || migrated.length !== attempted.length) {
    return rehomeResult("incomplete", migrated, skipped);
  }

  // 5: verified — record completion so a later run is a no-op.
  recordRehomeComplete(migrated);
  return rehomeResult("migrated", migrated, skipped);
}
