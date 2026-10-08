/**
 * SPEC-01 manifest gate (D1.1 S1).
 *
 * Narrow choke point between stores and storage: every persisted key is
 * checked against the manifest index before use. Unknown keys are denied:
 * an explicit ManifestError in development, a safe deny (no throw — never
 * crash production) otherwise. Logs carry the key NAME only, never values.
 *
 * Fail-closed: if the manifest cannot be loaded, every key is denied.
 * Rollback (OWNERS-RUNBOOK §7): flipping the gate off returns stores to
 * direct-key behavior; the manifest file itself is inert (read-only doc).
 */

import {
  type ManifestDocument,
  type ManifestEntry,
  type ManifestIndex,
  ManifestError,
  loadManifest,
} from "./dataManifest.js";
import {
  getShippedPolicyVersion,
  loadShippedManifest,
} from "./shippedManifest.js";

export { ManifestError };

/** Policy version of the loaded manifest (binds SPEC-04 receipts). */
export let MANIFEST_POLICY_VERSION = "0.0";

let cachedIndex: ManifestIndex | null = null;
let loadFailed = false;

/**
 * Log a gate event with key NAME metadata only. Values are NEVER logged,
 * so PII cannot leak through this path (TEST-MATRIX 3.2).
 */
function logGateEvent(message: string): void {
  console.warn(`[manifestGate] ${message}`);
}

function isDev(): boolean {
  if (typeof process !== "undefined" && process?.env?.NODE_ENV) {
    return process.env.NODE_ENV !== "production";
  }
  return typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
}

function ensureLoaded(): ManifestIndex | null {
  if (cachedIndex || loadFailed) return cachedIndex;
  try {
    cachedIndex = loadShippedManifest();
    MANIFEST_POLICY_VERSION = getShippedPolicyVersion();
  } catch {
    // Fail-closed: manifest unreadable ⇒ deny everything, log once.
    loadFailed = true;
    cachedIndex = null;
    logGateEvent("manifest load failed; all keys denied");
  }
  return cachedIndex;
}

/** Test-only: inject a manifest document into the gate. */
function injectForTests(doc: ManifestDocument): void {
  cachedIndex = loadManifest(doc);
  loadFailed = false;
  MANIFEST_POLICY_VERSION =
    typeof doc.policy_version === "string"
      ? doc.policy_version
      : MANIFEST_POLICY_VERSION;
}

export interface GateDecision {
  allowed: boolean;
  entry?: ManifestEntry;
}

/**
 * Check a storage key against the manifest. Unknown keys are denied:
 * throws ManifestError outside production, returns { allowed:false }
 * in production (safe fallback — never crashes the app).
 */
export function checkKey(key: string): GateDecision {
  const index = ensureLoaded();
  const entry = index?.get(key);
  if (entry) return { allowed: true, entry };
  logGateEvent(`denied unknown storage key "${key}"`);
  if (isDev()) {
    throw new ManifestError(
      `unknown storage key "${key}" — register it in docs/privacy/SPEC-01-manifest-fixture.json`,
    );
  }
  return { allowed: false };
}

/**
 * Non-throwing variant for bulk paths that must not let one unknown key
 * abort the whole operation (e.g. the desktop persistence-bridge backup
 * loop): returns false for unknown/failed-load keys, logging the key NAME.
 */
export function isKeyAllowed(key: string): boolean {
  const index = ensureLoaded();
  if (index?.has(key)) return true;
  logGateEvent(`denied unknown storage key "${key}"`);
  return false;
}

/**
 * Manifest entry for a key, or undefined. Non-throwing and fail-closed on an
 * unloadable manifest. Used by write guards that need the key's class, not
 * just its `pii` flag.
 */
export function getKeyEntry(key: string): ManifestEntry | undefined {
  return ensureLoaded()?.get(key);
}

/**
 * Whether the manifest declares `key` as carrying PII (`pii: true`).
 *
 * Non-throwing and fail-closed on an unknown key or an unloadable manifest:
 * only an entry that positively says `pii: true` returns true. This is the
 * predicate the sync write guard composes with the key allowlist, so a
 * declared PII key can never be placed on a plaintext surface while every
 * non-PII key keeps its current behaviour. Reads the key NAME only.
 */
export function isPiiKey(key: string): boolean {
  const index = ensureLoaded();
  return index?.get(key)?.pii === true;
}

/**
 * Whether the manifest ITSELF could not be loaded, so the gate is denying
 * every key (fail-closed).
 *
 * This is deliberately not `!isKeyAllowed(k)`: that is true for a key the
 * manifest loaded and simply does not declare, which is a different fact with
 * different consequences. A caller that DELETES (the bridge's stale-key sweep)
 * or that decides how to surface a refusal must tell "this key is denied" from
 * "no key could be classified at all" — the two are indistinguishable from the
 * per-key boolean, and reading them as one is what turned an unloadable
 * manifest into the deletion of every stored row.
 *
 * Triggers the lazy load for the same reason `isKeyAllowed` does: a caller must
 * not have to know that the flag is only ever set by a first lookup.
 */
export function isManifestUnavailable(): boolean {
  ensureLoaded();
  return loadFailed;
}

/** Test-only reset: inject a document, or null to simulate load failure. */
export function resetManifestForTests(
  doc: ManifestDocument | null | undefined,
): void {
  if (doc === undefined) {
    cachedIndex = null;
    loadFailed = false;
    MANIFEST_POLICY_VERSION = "0.0";
    return;
  }
  if (doc === null) {
    cachedIndex = null;
    loadFailed = true;
    return;
  }
  injectForTests(doc);
}
