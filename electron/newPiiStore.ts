/**
 * Exact new-namespace storage-row helpers (Beta12 follow-up) — main-only.
 *
 * The passwordless new-PII records live in the generic `storage` table, one row
 * per authorised key. Every helper here is an EXACT-key operation: the key is
 * asserted against the `newPiiNamespace` allowlist BEFORE any SQL is prepared,
 * so a legacy key, a domain table, or an invented prefix-only name can never
 * reach the statement. This is the dedicated primitive the new-PII erasure uses
 * instead of the broad `sqliteStorageAdapter`, which deletes the whole table.
 *
 * Reads and deletes are parameterised (`WHERE key = ?`); the table name is the
 * literal `storage`. No other table is ever named here.
 */

import {
  NEW_PII_STORAGE_KEYS,
  assertNewPiiStorageKey,
  type NewPiiStorageKey,
} from "../src/shared/lib/crypto/newPiiNamespace.js";
import { readStoredRow, type MinimalStorageDb } from "./persistGate.js";

/** The raw stored bytes for an authorised key, or null when absent. */
export function readNewPiiRow(
  db: MinimalStorageDb,
  key: NewPiiStorageKey,
): string | null {
  assertNewPiiStorageKey(key);
  return readStoredRow(db, key);
}

/** Delete exactly one authorised new-PII row. Refuses a non-authorised key. */
export function deleteNewPiiRow(
  db: MinimalStorageDb,
  key: NewPiiStorageKey,
): void {
  assertNewPiiStorageKey(key);
  db.prepare("DELETE FROM storage WHERE key = ?").run(key);
}

/**
 * The raw stored bytes of every authorised key, keyed by storage key.
 *
 * Values are the sealed `enc1:profileKey:` envelopes already on disk (never
 * plaintext), so this is a PII-only snapshot of the three new rows: no other
 * row, no other table.
 */
export function snapshotNewPiiRows(
  db: MinimalStorageDb,
): Record<string, string | null> {
  const rows: Record<string, string | null> = {};
  for (const key of NEW_PII_STORAGE_KEYS) {
    rows[key] = readStoredRow(db, key);
  }
  return rows;
}

/**
 * The authorised keys that STILL hold a row, in declaration order. An empty
 * array is the trusted-process proof that the purge is complete.
 *
 * `keys` defaults to all three; the withdrawal purge passes the exact keys in
 * its receipt scope so the postcondition is scoped the same way as the purge.
 */
export function remainingNewPiiRows(
  db: MinimalStorageDb,
  keys: readonly NewPiiStorageKey[] = NEW_PII_STORAGE_KEYS,
): string[] {
  const remaining: string[] = [];
  for (const key of keys) {
    assertNewPiiStorageKey(key);
    if (readStoredRow(db, key) !== null) remaining.push(key);
  }
  return remaining;
}
