/** Parameterized access to the generic key/value table. */

export interface MinimalStorageDb {
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  /** Optional for callers like the real better-sqlite3 client (VACUUM etc.). */
  exec?(sql: string): void;
}

const STORAGE_COLUMNS = "value FROM storage WHERE key = ?";

export function writeStoredRow(
  db: MinimalStorageDb,
  key: string,
  value: string,
): void {
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(key, value, Date.now());
}

/** Read raw bytes for one key. Callers must authorize the key before use. */
export function readStoredRow(
  db: MinimalStorageDb,
  key: string,
): string | null {
  const row = db.prepare(`SELECT ${STORAGE_COLUMNS}`).get(key) as
    { value: string } | undefined;
  return row ? row.value : null;
}
