/**
 * Persistence gate (D1.1 S3) — ADR-002 §2.1 default-deny at the write path.
 *
 * Every `db:save`/`db:load` of a manifest-known key is classified before it
 * touches the storage table:
 *
 *  - unknown key ⇒ DENIED (SPEC-01 default-deny);
 *  - `pii: false` ⇒ passthrough (manifest enforces plaintext_allowed only
 *    for non-PII keys);
 *  - `pii: true` ⇒ the value MUST go through the ADR-001 capability layer
 *    (`encryptForStorage`); when no capability exists the write is REFUSED
 *    (fail-closed), never downgraded to plaintext.
 *
 * Legacy plaintext PII (written before D1.1) stays READABLE on load
 * (ADR-002 §2.2.1 — the user must be able to see what exists and choose);
 * the startup scanner (`legacyScan.ts`) is what flags it for the S4
 * quarantine regime. Logs carry key NAMES only, never values (§3.2).
 */

import {
  type ManifestEntry,
  isKnownKey,
  getEntry,
} from "../src/shared/lib/dataManifest.js";
import { loadManifestFromDisk } from "./manifestSource.js";
import {
  CryptoDeniedError,
  encryptForStorage,
  decryptFromStorage,
  UnknownBlobError,
} from "./cryptoCapability.js";

export interface KeyPolicy {
  allowed: boolean;
  entry?: ManifestEntry;
}

/** Manifest policy for a key (main-process index; fail-closed on load errors). */
export function resolveKeyPolicy(key: string): KeyPolicy {
  try {
    const manifest = loadManifestFromDisk();
    if (!isKnownKey(manifest, key)) return { allowed: false };
    return { allowed: true, entry: getEntry(manifest, key) };
  } catch {
    return { allowed: false };
  }
}

export type PersistOutcome =
  | { action: "passthrough"; value: string }
  | { action: "encrypted"; value: string }
  | {
      action: "denied";
      reason: "unknown_key" | "no_capability" | "manifest_unavailable";
    };

/**
 * Decide and transform a value about to be persisted under `key`.
 * Returns the value to write, or a denial (the caller MUST refuse).
 */
export async function gatePersist(
  key: string,
  value: string,
): Promise<PersistOutcome> {
  const policy = resolveKeyPolicy(key);
  if (!policy.allowed) return { action: "denied", reason: "unknown_key" };
  const entry = policy.entry;
  if (!entry || !entry.pii) return { action: "passthrough", value };
  try {
    const blob = await encryptForStorage(key, value);
    return { action: "encrypted", value: blob };
  } catch (error) {
    if (error instanceof CryptoDeniedError) {
      return { action: "denied", reason: "no_capability" };
    }
    throw error;
  }
}

export type LoadOutcome =
  | { action: "passthrough"; value: string }
  | { action: "decrypted"; value: string }
  | { action: "legacy_plaintext"; value: string }
  | {
      action: "denied";
      reason: "unknown_key" | "locked" | "manifest_unavailable";
    };

/**
 * Decide and transform a stored value being read back under `key`.
 * Legacy plaintext PII loads as `legacy_plaintext` (readable — the S4
 * quarantine makes it read-only and surfaces it in the privacy screen).
 */
export async function gateLoad(
  key: string,
  stored: string,
): Promise<LoadOutcome> {
  const policy = resolveKeyPolicy(key);
  if (!policy.allowed) return { action: "denied", reason: "unknown_key" };
  const entry = policy.entry;
  if (!entry || !entry.pii) return { action: "passthrough", value: stored };
  try {
    const plaintext = await decryptFromStorage(key, stored);
    return { action: "decrypted", value: plaintext };
  } catch (error) {
    if (error instanceof UnknownBlobError) {
      return { action: "legacy_plaintext", value: stored };
    }
    if (error instanceof CryptoDeniedError) {
      return { action: "denied", reason: "locked" };
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Storage-table operations used by the IPC handlers and the selftest */
/* ------------------------------------------------------------------ */

export interface MinimalStorageDb {
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
}

const STORAGE_COLUMNS = "value FROM storage WHERE key = ?";

/**
 * Gate and write a key/value pair into the storage table.
 * Throws on denial (fail-closed refusal — ADR-002 §2.1) and on SQL errors.
 */
export async function saveGated(
  db: MinimalStorageDb,
  key: string,
  value: string,
): Promise<void> {
  const outcome = await gatePersist(key, value);
  if (outcome.action === "denied") {
    throw new CryptoDeniedError(outcome.reason);
  }
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(key, outcome.value, Date.now());
}

/**
 * Read a key from the storage table through the gate.
 * Returns null when the key is unknown (denied) or absent.
 */
export async function loadGated(
  db: MinimalStorageDb,
  key: string,
): Promise<string | null> {
  const row = db.prepare(`SELECT ${STORAGE_COLUMNS}`).get(key) as
    { value: string } | undefined;
  if (!row) return null;
  const outcome = await gateLoad(key, row.value);
  if (outcome.action === "denied") return null;
  return outcome.value;
}
