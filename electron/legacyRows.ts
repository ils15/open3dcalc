/**
 * Read-only access to the legacy plaintext PII rows (Beta5 desktop re-home).
 *
 * Adapted for PostgreSQL: uses async postgres.Sql instead of sync MinimalStorageDb.
 */

import type postgres from "postgres";

export const LEGACY_PII_STORAGE_KEYS = [
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
] as const;

export type LegacyPiiStorageKey = (typeof LEGACY_PII_STORAGE_KEYS)[number];

export type LegacyPiiRowStatus =
  | "legacy_plaintext"
  | "already_encrypted"
  | "absent";

export interface LegacyPiiRow {
  key: LegacyPiiStorageKey;
  value: string | null;
  status: LegacyPiiRowStatus;
}

export interface LegacyPiiRowsReport {
  scannedAt: string;
  rows: LegacyPiiRow[];
}

const ENCRYPTED_PREFIX = "enc1:";

async function readStoredValue(
  sql: postgres.Sql,
  key: string,
): Promise<string | null> {
  const rows = await sql`SELECT value FROM storage WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as string) : null;
}

export async function readLegacyPiiRows(
  sql: postgres.Sql,
): Promise<LegacyPiiRowsReport> {
  const rows: LegacyPiiRow[] = [];
  for (const key of LEGACY_PII_STORAGE_KEYS) {
    const stored = await readStoredValue(sql, key);
    if (stored === null) {
      rows.push({ key, value: null, status: "absent" });
    } else if (stored.startsWith(ENCRYPTED_PREFIX)) {
      rows.push({ key, value: null, status: "already_encrypted" });
    } else {
      rows.push({ key, value: stored, status: "legacy_plaintext" });
    }
  }
  return { scannedAt: new Date().toISOString(), rows };
}