/**
 * Historical reader for legacy plaintext PII rows; its desktop IPC route is disabled.
 * There is no current production caller and no startup migration/re-home path.
 *
 * ## Why this exists
 *
 * This module documents the historical Beta5 plan where old PII keys remained
 * in SQLite `storage` rows but were no longer hydrated by `persistence-bridge`.
 * The former web/desktop migration and re-home consumers have since been removed;
 * no current handler or startup path copies these values into the vault:
 *
 *  - `privacy:scan-report` / `privacy:quarantine-report` are metadata only
 *    (key NAMES and counts, never values — TEST-MATRIX §3.2);
 *  - `db:load` is refused for these keys or would surface an unreadable blob;
 *  - `privacy:recover-key` is ADR-001 §3.6 recovery of a CIPHERTEXT blob, not
 *    the plaintext residue.
 *
 * ## Historical behavior of this disabled reader
 *
 * If directly invoked (currently by tests only), `readLegacyPiiRows()` reads EXACTLY the three declared keys — never an
 * arbitrary key supplied by the renderer — and returns the RAW value verbatim
 * for one that is legacy plaintext. A row that is already an ADR-001 envelope
 * (`enc1:`) carries nothing to re-home and is reported `already_encrypted` with
 * no value; an absent row is `absent`. It is READ-ONLY: no INSERT, UPDATE,
 * DELETE or VACUUM is issued.
 *
 * The values are PII. The former IPC route was read-only and did not log them,
 * but that route is disabled and is not an active data-transfer contract.
 *
 * The key list is a local literal so this module stays importable from the
 * Node main process with no renderer dependency (it must not pull in
 * `manifestStorage`'s zustand/`window` chain). `legacyRows.test.ts` pins it
 * against the canonical `LEGACY_PII_PLAINTEXT_KEYS` so the two cannot drift.
 */

import type { MinimalStorageDb } from "./persistGate.js";

/** The three plaintext `storage` keys the encrypted vault replaces. */
export const LEGACY_PII_STORAGE_KEYS = [
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
] as const;

export type LegacyPiiStorageKey = (typeof LEGACY_PII_STORAGE_KEYS)[number];

/**
 * Why a declared key has (or has not) a value to re-home.
 *
 *  - `legacy_plaintext` — a plaintext row; `value` carries it.
 *  - `already_encrypted` — an ADR-001 envelope (`enc1:`); nothing to re-home.
 *  - `absent` — there is no row.
 */
export type LegacyPiiRowStatus =
  "legacy_plaintext" | "already_encrypted" | "absent";

export interface LegacyPiiRow {
  key: LegacyPiiStorageKey;
  /**
   * The RAW legacy value verbatim, for `legacy_plaintext` only; `null` for
   * `already_encrypted` and `absent` (nothing is opened or decrypted here).
   */
  value: string | null;
  status: LegacyPiiRowStatus;
}

export interface LegacyPiiRowsReport {
  scannedAt: string;
  rows: LegacyPiiRow[];
}

const ENCRYPTED_PREFIX = "enc1:";

/** The stored bytes for one key, or null when there is no row. */
function readStoredValue(db: MinimalStorageDb, key: string): string | null {
  const row = db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row ? row.value : null;
}

/**
 * Read the three declared legacy PII rows. Read-only; logs nothing.
 *
 * The returned `rows` are always in `LEGACY_PII_STORAGE_KEYS` order, one entry
 * per declared key, so a caller can map them deterministically.
 */
export function readLegacyPiiRows(db: MinimalStorageDb): LegacyPiiRowsReport {
  const rows: LegacyPiiRow[] = LEGACY_PII_STORAGE_KEYS.map((key) => {
    const stored = readStoredValue(db, key);
    if (stored === null) return { key, value: null, status: "absent" };
    if (stored.startsWith(ENCRYPTED_PREFIX)) {
      return { key, value: null, status: "already_encrypted" };
    }
    return { key, value: stored, status: "legacy_plaintext" };
  });
  return { scannedAt: new Date().toISOString(), rows };
}
