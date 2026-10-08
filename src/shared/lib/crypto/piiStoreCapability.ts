/**
 * Capability decision for the browser PII vault — ADR-001 §2.3, SPEC-01.
 *
 * Pure and platform-agnostic, like `capability.ts` next door: the probes are
 * injected and this module decides. It is the decision function the
 * `manifestStorage` choke point composes with the existing demo-session
 * suppression predicate, so there is exactly ONE place that answers "may PII
 * be read or written right now?".
 *
 * ## Why a separate function from `resolveCryptoCapability`
 *
 * `capability.ts` answers the ADR-001 §2.3 table: safeStorage (electron) or a
 * session passphrase (both). That table is about WHICH key protects the value.
 * The vault needs two more axes that table does not carry:
 *
 *  - a **place to write**. `encrypted_at_rest` is a promise about bytes; a
 *    browser with no IndexedDB cannot keep that promise, and a refusal to
 *    write would be a silent no-op that reads as "saved". So an absent store
 *    is its own reason, distinct from an absent key.
 *  - **the user's decision**. `consent_declined` is not a capability failure;
 *    a perfectly capable browser that the user asked not to persist PII in is
 *    denied, and conflating the two would make the UI say "unsupported"
 *    instead of "you said no".
 *
 * ## Fail-closed
 *
 * An `undefined` probe resolves to DENIED, never to "probably fine". A gate
 * that treats an unknown as allowed turns a browser gap into plaintext-by-
 * accident the moment any fallback is ever added to it.
 */

export type PiiStoreDenialReason =
  /** A demo session owns the stores: ephemeral by definition (LGPD). */
  | "demo_session"
  /** No capability probe was ever installed — nothing is known. */
  | "capability_unknown"
  /**
   * There is no browser here at all — the Electron main process, a worker, or
   * plain Node. Distinct from `insecure_context` on purpose: the main process
   * is not an insecure context, it is simply not a context, and telling a
   * desktop user their context is insecure when the real answer is "this code
   * path does not belong in this process" sends them looking for a TLS
   * problem they do not have.
   */
  | "not_a_browser"
  /** The user declined PII persistence. */
  | "consent_declined"
  /** `window.isSecureContext` is false, or was not observable. */
  | "insecure_context"
  /** Web Crypto (`crypto.subtle`) is not reachable. */
  | "web_crypto_unavailable"
  /** No IndexedDB to write sealed records into. */
  | "indexeddb_unavailable"
  /** A passphrase-derived key is not held in memory for this store. */
  | "profile_locked"
  /**
   * A withdrawal/revocation operation is pending or incomplete. New PII writes
   * must not land in a surface that is mid-erasure, and reads are blocked too
   * so a half-erased state is never presented as the user's data.
   */
  | "withdrawal_pending";

/**
 * An install-time capability SNAPSHOT. Not a live probe: these are facts about
 * the runtime that do not change while a page is alive, and re-probing per
 * read would make a vault write depend on a `getRandomValues` round trip.
 *
 * `declined` is deliberately NOT here — consent changes at runtime and is read
 * live by the choke point, so a withdrawal takes effect immediately.
 */
export interface PiiStoreEnvironment {
  /**
   * Whether a `window` with a security origin exists at all. Undefined is a
   * denial: a runtime that cannot report a window is not a browser.
   */
  browser: boolean | undefined;
  secureContext: boolean | undefined;
  webCryptoAvailable: boolean | undefined;
  indexedDbAvailable: boolean | undefined;
}

export interface PiiStoreGateInput {
  /** The existing demo-session suppression predicate. */
  demoSuppressed: boolean;
  /** Installed capability snapshot, or null if none was ever installed. */
  environment: PiiStoreEnvironment | null;
  /** Live user decision. */
  declined: boolean;
  /** Whether the store currently holds no derived key. */
  locked: boolean;
  /**
   * Whether a withdrawal/revocation is pending or incomplete. Optional so
   * existing callers keep their exact behavior; absent means "not pending".
   */
  withdrawalPending?: boolean;
}

/**
 * The decision table, most fundamental refusal first.
 *
 * Order is load-bearing and asserted by a test: "you cannot write here at all"
 * outranks "you are locked out right now", and the locked state is last
 * because it is the only one the user can fix by unlocking. Masking an
 * insecure context behind `profile_locked` would send the user to type a
 * passphrase that could never help.
 */
export function resolvePiiStoreRefusal(
  input: PiiStoreGateInput,
): PiiStoreDenialReason | null {
  if (input.demoSuppressed) return "demo_session";
  if (input.environment === null) return "capability_unknown";
  if (input.environment.browser !== true) return "not_a_browser";
  // A destructive operation in flight outranks every other refusal: it is not
  // fixable by the user (unlike `profile_locked`) and must not be masked by
  // the live consent decision (which the withdrawal itself is changing).
  if (input.withdrawalPending === true) return "withdrawal_pending";
  if (input.declined) return "consent_declined";
  if (input.environment.secureContext !== true) return "insecure_context";
  if (input.environment.webCryptoAvailable !== true) {
    return "web_crypto_unavailable";
  }
  if (input.environment.indexedDbAvailable !== true) {
    return "indexeddb_unavailable";
  }
  if (input.locked) return "profile_locked";
  return null;
}

// ---------------------------------------------------------------------------
//  The gate's mutable state
// ---------------------------------------------------------------------------
//
// Why the state lives HERE and not in `manifestStorage.ts`: the Electron main
// process compiles this directory with `lib: ["ES2023"]` and no DOM, and a
// vault that reached for a zustand-and-`window` module would drag a renderer
// dependency into the main bundle. This module is pure data and one decision
// function, so both builds can load it.
//
// The demo-session flag is still OWNED by `manifestStorage` and still set in
// one place; `setDemoPersistenceSuppressed` mirrors the boolean in here rather
// than a second gate being allowed to grow next to the first. A mirror cannot
// drift the way two independent predicates can, which was the whole point of
// the single choke point.

let piiStoreEnvironment: PiiStoreEnvironment | null = null;
let piiPersistenceDeclined = false;
let demoSuppressed = false;
let withdrawalPending = false;

/** Install (or clear, with null) the vault's capability snapshot. */
export function setPiiStoreEnvironment(
  environment: PiiStoreEnvironment | null,
): void {
  piiStoreEnvironment = environment;
}

/** Record that the user declined PII persistence (consent withdrawn/opt-out). */
export function setPiiPersistenceDeclined(value: boolean): void {
  piiPersistenceDeclined = value;
}

/** True while the user has declined PII persistence. */
export function isPiiPersistenceDeclined(): boolean {
  return piiPersistenceDeclined;
}

/**
 * Engage/release the withdrawal lock. Set while a withdrawal/revocation
 * journal is non-completed (see `withdrawalBlocksPiiWrites`), so no new PII is
 * written into a surface that is mid-erasure. This is a mirror of the journal's
 * state, not a second owner of it.
 */
export function setWithdrawalPending(value: boolean): void {
  withdrawalPending = value;
}

/** True while a withdrawal/revocation is pending or incomplete. */
export function isWithdrawalPending(): boolean {
  return withdrawalPending;
}

/**
 * Mirror the demo-session suppression flag owned by `manifestStorage`.
 * Called only by `setDemoPersistenceSuppressed`.
 */
export function setDemoSuppressedForPiiGate(value: boolean): void {
  demoSuppressed = value;
}

/**
 * Why the PII vault must refuse, or null when it may proceed.
 *
 * `locked` is passed in by the caller because the held key is per-store state,
 * not a module-level flag.
 */
export function piiStoreRefusalReason(
  locked: boolean,
): PiiStoreDenialReason | null {
  return resolvePiiStoreRefusal({
    demoSuppressed,
    environment: piiStoreEnvironment,
    declined: piiPersistenceDeclined,
    locked,
    withdrawalPending,
  });
}

/** True when the vault may read or write PII right now. */
export function isPiiStoreAllowed(locked: boolean): boolean {
  return piiStoreRefusalReason(locked) === null;
}

/** Test-only: forget every installed fact, so one test cannot leak into the next. */
export function resetPiiStoreGateForTests(): void {
  piiStoreEnvironment = null;
  piiPersistenceDeclined = false;
  demoSuppressed = false;
  withdrawalPending = false;
}
