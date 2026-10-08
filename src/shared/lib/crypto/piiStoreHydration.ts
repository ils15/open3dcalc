/**
 * Hydration lifecycle for the encrypted Desktop PII stores. Stable Web stores
 * use the policy-approved synchronous localStorage adapter instead.
 *
 * ## Why a gate and not just `piiPersistStorage`
 *
 * `piiPersistStorage` (Wave 2) already refuses a locked read/write with a typed
 * `PiiStoreDeniedError`. That is necessary but not sufficient for the zustand
 * wiring, because zustand hydrates SYNCHRONOUSLY at store creation, at ES-module
 * evaluation time — before any React code, before the desktop bridge, and long
 * before a passphrase exists. The encrypted Desktop stores therefore set
 * `skipHydration: true` and are rehydrated here, explicitly, after unlock.
 *
 * Two things are easy to get wrong without a single owner for that lifecycle:
 *
 *  1. **Hydrating too early.** If a store is rehydrated before the vault holds
 *     its key, the read refuses, zustand keeps the store's initial state, and a
 *     later write would persist that empty state over the user's real records.
 *     The gate refuses ANY write until that store has positively hydrated, so a
 *     not-yet-hydrated store cannot be the vector for the empty-array bug — even
 *     if a future caller forgets to wait for `rehydratePiiStores()`.
 *  2. **Hydrating and failing.** A failed hydration (unreadable record, refused
 *     key, malformed JSON) leaves the store at its initial state with no copy of
 *     the real data. Forwarding writes from that state would destroy the record
 *     the failure was hopefully recoverable from. On failure the gate drops the
 *     held key AND refuses writes, so the store is fail-closed rather than
 *     writable in a half-state.
 *
 * ## One choke point, not two
 *
 * The permission question ("may PII be read or written right now?") is answered
 * exactly once, by `piiStoreRefusalReason` in `piiStoreCapability.ts` — the same
 * predicate the vault's own operations use. This module only tracks hydration
 * state; when it refuses it asks that gate for the reason, so a locked vault
 * reports `profile_locked`, a declined user reports `consent_declined`, and so
 * on. No second predicate is introduced.
 *
 * ## The refused write is not silently dropped
 *
 * zustand's persist middleware calls `storage.setItem` from its wrapped `set`,
 * but a store ACTION ignores that returned promise (`set((s) => ...)`). A raw
 * rejection there is an unhandled rejection in every locked session. So the gate
 * attaches an internal no-op handler to the write promise and RETURNS THE SAME
 * STILL-REJECTING PROMISE: an awaiting caller sees the typed refusal, zustand's
 * orphaned promise is not an unhandled rejection, and the typed reason is
 * recorded in `getLastPiiWriteRefusal()` for the UI to surface. Nothing is
 * persisted and nothing is lost.
 */

import type { PersistStorage, StorageValue } from "zustand/middleware";
import {
  PiiStoreDeniedError,
  hasPiiVaultRecord,
  installPiiStoreEnvironment,
  isPiiStoreUnlocked,
  lockPiiStore,
  piiPersistStorage,
  unlockPiiStore,
  type PiiStoreOptions,
} from "./piiStore.js";
import {
  piiStoreRefusalReason,
  type PiiStoreDenialReason,
  type PiiStoreEnvironment,
} from "./piiStoreCapability.js";

/**
 * The three ACTIVE browser PII keys, named once so a surface can ask about the
 * store it writes to without hardcoding the raw vault key a second time.
 */
export const PII_STORE_KEY = {
  customers: "open3dcalc_customers_v1",
  quotes: "open3dcalc_quotes_v1",
  history: "open3dcalc_history_v2",
} as const;

/**
 * The three keys in a fixed order. The order is part of the contract:
 * `rehydratePiiStores()` reports outcomes in this order, so a caller reads the
 * same list in the same sequence every run.
 */
export const PII_STORE_KEYS = [
  PII_STORE_KEY.customers,
  PII_STORE_KEY.quotes,
  PII_STORE_KEY.history,
] as const;

export type PiiStoreKey = (typeof PII_STORE_KEYS)[number];

/** Where a migrated store is in its hydration lifecycle. */
export type PiiHydrationStatus = "idle" | "hydrating" | "hydrated" | "failed";

/** Outcome for one store after `rehydratePiiStores()`. */
export type PiiRehydrateOutcome =
  | { key: PiiStoreKey; status: "hydrated" }
  | { key: PiiStoreKey; status: "failed" }
  | { key: PiiStoreKey; status: "unregistered" };

/** The slice of a zustand `persist` API the gate needs. */
export interface PiiPersistHandle {
  rehydrate: () => Promise<void> | void;
  hasHydrated: () => boolean;
}

// ---------------------------------------------------------------------------
//  Gate state
// ---------------------------------------------------------------------------

const hydrationStates = new Map<string, PiiHydrationStatus>();
const persistHandles = new Map<string, PiiPersistHandle>();

let runtimeOptions: PiiStoreOptions = {};

/**
 * A refused write, for a UI that must show WHY nothing was saved. Never carries
 * a value: a key NAME and a typed reason only (TEST-MATRIX §3.2).
 */
export interface PiiWriteRefusal {
  key: string;
  reason: PiiStoreDenialReason;
}

/**
 * The last refused write, or null. A refusAL that only a test can observe is a
 * silent failure in production, so a UI surface subscribes (see
 * `subscribePiiWriteRefusals`) and renders this the moment it is set.
 */
let lastWriteRefusal: PiiWriteRefusal | null = null;

const refusalListeners = new Set<() => void>();

function setLastWriteRefusal(refusal: PiiWriteRefusal | null): void {
  lastWriteRefusal = refusal;
  for (const listener of refusalListeners) listener();
}

/**
 * Subscribe to write refusals. Returns the unsubscribe function.
 *
 * This is the seam between the non-React gate and a React surface: a refusal is
 * recorded outside React (inside a store `set`), so it is published through a
 * listener set rather than a store subscription. The listener count is tiny
 * (one per mounted PII surface) and cleared when the surface unmounts.
 */
export function subscribePiiWriteRefusals(listener: () => void): () => void {
  refusalListeners.add(listener);
  return () => {
    refusalListeners.delete(listener);
  };
}

/**
 * The environment the gate hands to the vault when it creates a handle.
 *
 * The stores are created at module scope, before a test (or a desktop renderer)
 * can inject an IndexedDB, so the vault handle is created lazily per operation
 * and reads this. Explicit configuration keeps the "is there somewhere to
 * write?" question a fact the caller states, not an ambient global the gate
 * hopes is present.
 */
export function configurePiiStoreRuntime(options: PiiStoreOptions = {}): void {
  runtimeOptions = options;
}

/** Register a migrated store's persist handle so the gate can rehydrate it. */
export function registerPiiPersistStore(
  key: string,
  handle: PiiPersistHandle,
): void {
  persistHandles.set(key, handle);
  if (!hydrationStates.has(key)) hydrationStates.set(key, "idle");
}

/** Current hydration status for a migrated store. */
export function getPiiStoreHydrationStatus(key: string): PiiHydrationStatus {
  return hydrationStates.get(key) ?? "idle";
}

/** The last refused write, or null. Reason is always a typed constant. */
export function getLastPiiWriteRefusal(): PiiWriteRefusal | null {
  return lastWriteRefusal;
}

/**
 * Record a refusal for a write the UI preempted before it reached the vault.
 *
 * The gate records a refusal itself when `requireHydrated()` rejects a store
 * write. But a PII surface also blocks the USER action before it mutates the
 * store (so an entry is never shown as if saved), and that path still has to
 * publish the same refusal to the same consumer. One setter, one event.
 */
export function recordPiiWriteRefusal(
  key: string,
  reason: PiiStoreDenialReason,
): void {
  setLastWriteRefusal({ key, reason });
}

/**
 * Beta readability hook, injected by the renderer-only Beta persistence
 * module (see `betaPersistence.ts`).
 *
 * This module is compiled by the Electron main process
 * (`electron/tsconfig.json`: no DOM, no `@/` alias, no ESM JSON), so it must
 * not statically import the Beta persistence chain (`betaPersistence` →
 * `manifestGate` → `shippedManifest` → JSON fixtures). The renderer registers
 * a checker at module load; main never does, so the Beta branch stays
 * fail-closed there and Stable behavior is untouched.
 *
 * The checker answers, for a Stable PII key (`PII_STORE_KEY.*`), whether Beta
 * plaintext persistence is readable right now (manifest allows the mapped
 * Beta key and its envelope is empty-or-valid). The mapping lives with the
 * checker, not here, so this module holds no Beta key strings.
 */
let betaReadabilityChecker: ((piiKey: string) => boolean) | null = null;

/** Register (or clear with null) the Beta readability checker. */
export function setBetaReadabilityChecker(
  checker: ((piiKey: string) => boolean) | null,
): void {
  betaReadabilityChecker = checker;
}

/** Test-only reset for the injected checker (registrations do not leak). */
export function resetBetaReadabilityCheckerForTests(): void {
  betaReadabilityChecker = null;
}

function isBetaReadableForPiiKey(key: string): boolean {
  try {
    return betaReadabilityChecker?.(key) ?? false;
  } catch {
    return false;
  }
}

function isStableWebPiiKey(key: string): boolean {
  const browser = (
    globalThis as typeof globalThis & {
      navigator?: { userAgent?: string };
    }
  ).navigator;
  return (
    browser !== undefined &&
    !browser.userAgent?.includes("Electron") &&
    PII_STORE_KEYS.includes(key as PiiStoreKey)
  );
}

/**
 * The reason a USER-initiated write to a PII store must be blocked, or null.
 *
 * Stable Web saves do not depend on vault hydration, consent, or crypto
 * capability. They complete synchronous localStorage hydration before writes.
 * The encrypted Desktop path continues to block until its store is hydrated.
 * A demo session remains ephemeral by design and never persists writes.
 *
 * Beta channel: Beta never registers encrypted PII stores; its three
 * `open3dcalc_beta_test_*` stores are allowed only when the Beta manifest and
 * persisted envelope are readable. Stable Web keys skip this vault gate;
 * Desktop continues to require a hydrated encrypted store.
 */
export function getPiiSurfaceWriteBlockReason(
  key: string,
): PiiStoreDenialReason | null {
  if (betaReadabilityChecker !== null) {
    if (isBetaReadableForPiiKey(key)) return null;
    const betaReason = refusalForUnhydrated();
    return betaReason === "demo_session" ? null : betaReason;
  }
  if (isStableWebPiiKey(key)) return null;
  if (getPiiStoreHydrationStatus(key) === "hydrated") return null;
  const reason = refusalForUnhydrated();
  return reason === "demo_session" ? null : reason;
}

/**
 * Block a PII surface write, recording the refusal for the visible consumer.
 *
 * Call BEFORE mutating a Beta or encrypted Desktop store. Stable Web returns
 * null without consulting vault prerequisites and persists through the
 * dedicated plaintext adapter. A non-null return means the caller must abort
 * and render the recorded reason.
 */
export function beginPiiSurfaceWrite(key: string): PiiStoreDenialReason | null {
  const reason = getPiiSurfaceWriteBlockReason(key);
  if (reason !== null) recordPiiWriteRefusal(key, reason);
  return reason;
}

/**
 * The runtime options this gate was configured with (see
 * `configurePiiStoreRuntime`). The unlocked shell forwards them to
 * `unlockPiiStoresAndRehydrate` so a platform adapter or a test that injected a
 * vault keeps it across the unlock instead of the call resetting to the global.
 */
export function getPiiStoreRuntimeOptions(): PiiStoreOptions {
  return runtimeOptions;
}

/**
 * Sample the runtime and install the capability snapshot the gate reads.
 *
 * The stores are created before any passphrase exists, so nothing installs the
 * environment until an operation runs. The UI needs the capability answer
 * BEFORE an operation, to tell "locked, enter your passphrase" apart from
 * "this environment can never protect PII" — so it calls this once at mount.
 */
export function installPiiStoreRuntimeEnvironment(): PiiStoreEnvironment {
  return installPiiStoreEnvironment(runtimeOptions);
}

/**
 * What a PII surface must render right now.
 *
 * Derived from the SAME two sources the gate already uses — hydration state and
 * `piiStoreRefusalReason` — never from a store read: a locked vault must never
 * be presented as an empty store, and this state is how the UI knows not to.
 * The reason is a compile-time constant, so it carries no PII.
 */
export type PiiVaultAccessState =
  | { status: "hydrated" }
  | { status: "locked"; reason: "profile_locked" }
  | { status: "unavailable"; reason: PiiStoreDenialReason };

/**
 * The current access state, after `installPiiStoreRuntimeEnvironment()`.
 *
 * `profile_locked` is the ONLY refusal the user can fix by entering a
 * passphrase, so it is the only one that renders the unlock form; every other
 * reason is an environment fact and gets the explanatory shell instead.
 */
export function getPiiStoreAccessState(): PiiVaultAccessState {
  const allHydrated = PII_STORE_KEYS.every(
    (key) => getPiiStoreHydrationStatus(key) === "hydrated",
  );
  if (allHydrated) return { status: "hydrated" };

  const reason = piiStoreRefusalReason(true) ?? "profile_locked";
  return reason === "profile_locked"
    ? { status: "locked", reason }
    : { status: "unavailable", reason };
}

function refusalForUnhydrated(): PiiStoreDenialReason {
  // `locked: true` is the strictest form of the existing gate: it yields a
  // typed reason for every environment, including `profile_locked` when the
  // environment itself is fine. That is the honest reason for "this store has
  // no usable key yet".
  return piiStoreRefusalReason(true) ?? "profile_locked";
}

/**
 * The tail of each key's write chain, kept OUTSIDE the vault.
 *
 * The vault owns a per-key write queue, but reading its private chain is not
 * possible from here, and a test needs a barrier that resolves AFTER the
 * store's fire-and-forget write committed. So the gate records the promise of
 * every write it PERFORMED here, and `whenPiiWritesSettled()` waits on those.
 * This is deliberately test-facing; it never gates an application read.
 */
const observedWriteTails = new Map<string, Promise<unknown>>();

function trackWrite(key: string, promise: Promise<unknown>): void {
  const observed = promise.then(
    () => undefined,
    () => undefined,
  );
  observedWriteTails.set(key, observed);
}

/**
 * Wait until every write the gate has issued so far has settled.
 *
 * A barrier, not a queue: awaiting a no-op write directly would itself be
 * serialised behind the store's pending write, so a caller that wanted to know
 * "has the action's write committed?" had to guess. This observes the write
 * promises instead.
 */
export async function whenPiiWritesSettled(): Promise<void> {
  while (observedWriteTails.size > 0) {
    const pending = [...observedWriteTails.values()];
    observedWriteTails.clear();
    await Promise.allSettled(pending);
  }
}

/**
 * Read the persisted record for one migrated key, or null.
 *
 * Fail-closed and non-throwing ON PURPOSE: the legacy migration uses this to
 * confirm the vault holds the full migrated set before it removes its durable
 * recovery marker. A locked or refused vault returns null, and the caller's
 * fail-closed branch treats that as "not durable yet".
 */
export async function readPiiPersistedRecord(
  key: string,
): Promise<string | null> {
  try {
    const value = await piiPersistStorage(key, runtimeOptions).getItem(key);
    return value === null ? null : JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Did every write issued so far COMMIT?
 *
 * `whenPiiWritesSettled()` says the writes finished; this says they finished
 * successfully. A caller that must not remove a recovery source until the data
 * is durable asks this, because "settled" includes "rejected" — and a rejected
 * write is exactly the interrupted case the recovery marker exists for.
 */
export async function didPiiWritesCommit(): Promise<boolean> {
  let allCommitted = true;
  while (observedWriteTails.size > 0) {
    const pending = [...observedWriteTails.values()];
    observedWriteTails.clear();
    const results = await Promise.allSettled(pending);
    if (results.some((result) => result.status === "rejected")) {
      allCommitted = false;
    }
  }
  return allCommitted;
}

function runObserved<T>(key: string, run: () => Promise<T>): Promise<T> {
  let attempt: Promise<T>;
  try {
    attempt = run();
  } catch (error) {
    // A synchronous throw (e.g. `createPiiStore` refusing an incapable
    // environment) becomes a rejection so the caller always sees a promise.
    attempt = Promise.reject(error);
  }
  trackWrite(key, attempt);
  // The promise is returned WITH its value intact and its rejection intact. The
  // extra no-op handler below only stops zustand's orphaned setItem promise
  // from surfacing as an unhandled rejection; it does not swallow the value,
  // which is the whole point of the hydration read.
  void attempt.catch(() => undefined);
  return attempt;
}

// ---------------------------------------------------------------------------
//  The gated persist storage
// ---------------------------------------------------------------------------

/**
 * The vault-backed storage a migrated store drops into `persist({...})`.
 *
 * `skipHydration: true` is required at the call site: this storage's `getItem`
 * is async, and a store must not begin hydrating at construction time, before a
 * passphrase exists.
 */
export function gatedPiiPersistStorage<S>(
  key: string,
): PersistStorage<S, Promise<void>> {
  function vault(): PersistStorage<S, Promise<void>> {
    return piiPersistStorage<S>(key, runtimeOptions);
  }

  function refuseUnhydrated(): PiiStoreDeniedError {
    const error = new PiiStoreDeniedError(refusalForUnhydrated());
    setLastWriteRefusal({ key, reason: error.reason });
    return error;
  }

  function recordIfDenied(error: unknown): void {
    if (error instanceof PiiStoreDeniedError) {
      setLastWriteRefusal({ key, reason: error.reason });
    }
  }

  function requireHydrated(): void {
    if (getPiiStoreHydrationStatus(key) !== "hydrated") {
      throw refuseUnhydrated();
    }
  }

  return {
    getItem(_name: string): Promise<StorageValue<S> | null> {
      return runObserved(key, async () => vault().getItem(_name));
    },

    setItem(_name: string, value: StorageValue<S>): Promise<void> {
      return runObserved(key, async () => {
        requireHydrated();
        try {
          await vault().setItem(key, value);
        } catch (error) {
          recordIfDenied(error);
          throw error;
        }
      });
    },

    removeItem(_name: string): Promise<void> {
      return runObserved(key, async () => {
        requireHydrated();
        try {
          await vault().removeItem(_name);
        } catch (error) {
          recordIfDenied(error);
          throw error;
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
//  Post-unlock rehydration
// ---------------------------------------------------------------------------

/**
 * Rehydrate every registered migrated store from the vault.
 *
 * Call this AFTER `unlockPiiStore()` for the three keys. A store whose
 * hydration does not positively complete is left fail-closed: its status is
 * `failed`, its held key is dropped, and the gate refuses further writes, so a
 * failed hydration can never be followed by a write of the store's initial
 * state.
 */
export async function rehydratePiiStores(): Promise<PiiRehydrateOutcome[]> {
  // A read must not race an in-flight write for the same key. The vault
  // serialises WRITES, but reads bypass that queue, so a store action's
  // fire-and-forget write could still be committing when hydration reads the
  // record — and hydration would restore the PRE-write value while every
  // write promise still resolves successfully. Waiting for the write barrier
  // first makes hydration read what the writes actually left behind, which is
  // what "hydrate to the exact persisted state" means.
  await whenPiiWritesSettled();

  const outcomes: PiiRehydrateOutcome[] = [];

  for (const key of PII_STORE_KEYS) {
    const handle = persistHandles.get(key);
    if (!handle) {
      outcomes.push({ key, status: "unregistered" });
      continue;
    }

    hydrationStates.set(key, "hydrating");
    let threw = false;
    try {
      await handle.rehydrate();
    } catch {
      threw = true;
    }

    if (!threw && handle.hasHydrated()) {
      hydrationStates.set(key, "hydrated");
      // A store that is now readable and writable can no longer refuse a write
      // for hydration reasons, so a refusal recorded against THIS key (locked,
      // failed, not-yet-hydrated) is stale and must stop being shown. Clearing
      // it here is what makes the notice disappear after a successful unlock.
      if (lastWriteRefusal?.key === key) setLastWriteRefusal(null);
      outcomes.push({ key, status: "hydrated" });
    } else {
      // Fail-closed: drop any held key so even a direct vault write refuses,
      // and remember the store is not hydrated so the gate refuses too. A
      // later successful unlock + rehydrate clears this.
      hydrationStates.set(key, "failed");
      lockPiiStore(key);
      outcomes.push({ key, status: "failed" });
    }
  }

  return outcomes;
}

/**
 * Unlock all three stores with one passphrase and rehydrate them.
 *
 * A convenience over the two explicit steps so a caller cannot unlock and then
 * forget to rehydrate. It performs no UI: the consent/unlock flow is a later
 * wave and calls the same primitives.
 */
export async function unlockPiiStoresAndRehydrate(
  passphrase: string,
  options: PiiStoreOptions = {},
): Promise<PiiRehydrateOutcome[]> {
  configurePiiStoreRuntime(options);
  // Unlock READS each record to recover its salt and to verify the passphrase,
  // and reads are not serialised behind the write queue. Settle any write still
  // in flight first, so the salt recovered is the one the committed record
  // carries rather than a random one chosen because the record looked absent.
  await whenPiiWritesSettled();
  for (const key of PII_STORE_KEYS) {
    await unlockPiiStore(key, passphrase, options);
  }
  return rehydratePiiStores();
}

/**
 * True when ANY of the three vault keys already holds a record.
 *
 * The locked shell's create-vs-unlock decision. A record means an EXISTING
 * profile must be unlocked (a wrong passphrase is possible, the data is
 * recoverable); no record means a NEW profile is being created (confirmation
 * and an irrecoverability warning are owed). Reads presence only: the sealed
 * value is never opened, so this is safe before a key is held. It uses the
 * same runtime options the gate was configured with, so a platform adapter or
 * a test's injected vault is honored.
 */
export async function hasExistingPiiProfile(): Promise<boolean> {
  for (const key of PII_STORE_KEYS) {
    if (await hasPiiVaultRecord(key, runtimeOptions)) return true;
  }
  return false;
}

/**
 * Wake the gate at startup when the vault is ALREADY unlocked.
 *
 * The three stores set `skipHydration: true`, so nothing hydrates them at
 * construction. A normal page load holds no key and is `locked` (the shell
 * unlocks it). But a runtime that unlocked the vault before the first render —
 * a resumed session, a platform adapter, a test — must not sit on a held key
 * and an unhydrated store. This is the production caller for
 * `rehydratePiiStores()`: it runs it only when every key is held, and returns
 * null when there is nothing to wake, so a locked profile is never rehydrated
 * into a fail-closed `failed` state by startup.
 */
export async function rehydratePiiStoresIfUnlocked(): Promise<
  PiiRehydrateOutcome[] | null
> {
  const everyKeyHeld = PII_STORE_KEYS.every((key) => isPiiStoreUnlocked(key));
  if (!everyKeyHeld) return null;
  return rehydratePiiStores();
}

// ---------------------------------------------------------------------------
//  Test-only reset
// ---------------------------------------------------------------------------

/**
 * Forget hydration status and the recorded refusal, keeping registrations.
 *
 * Registrations are created once at store-module evaluation and must survive a
 * reset, or later tests would have no handle to rehydrate.
 */
export function resetPiiStoreHydrationForTests(): void {
  hydrationStates.clear();
  lastWriteRefusal = null;
  runtimeOptions = {};
  observedWriteTails.clear();
}
