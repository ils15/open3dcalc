/**
 * Erasure snapshot payload capture/restore (SPEC-02 §5).
 *
 * Extracted from `erasure.ts` so the payload builder is unit-testable: that
 * module imports Electron directly and therefore cannot be
 * imported from a node test. Nothing here touches Electron APIs — only the
 * SQLite client — so the real implementation is exercised directly by
 * `piiDomainTables.test.ts` and `piiStageResidue.test.ts` rather than
 * re-implemented in the test bodies.
 *
 * The table loop iterates `PII_ERASURE_TABLES` — the PII domain tables plus the
 * `pii_stage` and `legacy_residue` tables. They remain included so erasure and
 * rollback also cover rows left by older app versions.
 *
 * One detail is worth reading before changing the restore: it is a MERGE, not a
 * replace — see `restoreSnapshotPayload`.
 */

import { PII_ERASURE_TABLES } from "./piiDomainTables.js";

/** The subset of the drizzle/better-sqlite3 client the payload path needs. */
export interface PayloadDb {
  $client: {
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): unknown;
    };
  };
}

/**
 * Serialize every PII-bearing row the saga is about to delete, so a failed run
 * can be rolled back. A table absent from this database yields an empty array
 * (idempotent: older profiles predate some tables).
 */
export function snapshotPayload(db: PayloadDb): string {
  const rows = db.$client
    .prepare("SELECT key, value FROM storage")
    .all() as Array<{ key: string; value: string }>;
  const domain: Record<string, unknown[]> = {};
  for (const table of PII_ERASURE_TABLES) {
    try {
      domain[table] = db.$client
        .prepare(`SELECT * FROM ${table}`)
        .all() as unknown[];
    } catch {
      domain[table] = [];
    }
  }
  return JSON.stringify({ storage: rows, domain });
}

/**
 * Restore a payload into its origin tables (SPEC-02 §5 rollback).
 *
 * A MERGE, deliberately. The previous implementation ran `DELETE FROM storage`
 * and then re-inserted the captured rows, which made the recovery path itself a
 * source of data loss: anything written between `snapshot_taken` and the
 * failure — a save from the 10 s auto-save pass, a row the renderer mirrored
 * back — was annihilated by the rollback that was supposed to be rescuing the
 * user. Rollback owes the user the rows the saga deleted, not the state the
 * database happened to be in at the moment of failure.
 *
 * So captured rows are upserted by their own key and nothing else is touched:
 *
 *  - a captured row the saga deleted is put back (that is the point);
 *  - a row written after the snapshot, under any key, survives;
 *  - re-running the restore is a no-op, which is the SPEC-02 §2 resume rule —
 *    a plain INSERT would abort the whole restore on the second attempt.
 *
 * `updated_at` is stamped with the restore time rather than restored verbatim:
 * the payload captures (key, value) only, and a rollback genuinely does change
 * the row's write time. The preimages in `pii_stage` keep their own
 * `created_at`, because there the column IS part of the captured row.
 *
 * KNOWN LIMITATION (pre-existing, recorded not fixed) — this restore is NOT
 * wrapped in a transaction. A failure partway through leaves the database
 * half-restored: some captured rows are back and the rest are not, and the
 * caller cannot tell which from the return value. The resume rule (§2) means a
 * second run converges — the merge upserts by key, so re-running finishes the
 * job — but a crash between the two runs leaves the profile in an intermediate
 * state that no single code path observes. The former stage state machine
 * handled its writes separately; this compatibility code remains for existing
 * journal and data contracts.
 */
export function restoreSnapshotPayload(db: PayloadDb, payload: string): void {
  const parsed = JSON.parse(payload) as {
    storage: Array<{ key: string; value: string }>;
    domain: Record<string, Array<Record<string, unknown>>>;
  };
  const insertStorage = db.$client.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  );
  for (const row of parsed.storage) {
    insertStorage.run(row.key, row.value, Date.now());
  }
  for (const [table, rows] of Object.entries(parsed.domain)) {
    // Rows are restored verbatim into their origin tables (column sets are
    // unchanged — the payload was captured moments earlier). REPLACE rather
    // than INSERT so a re-drive converges instead of throwing on the primary
    // key and leaving the restore half-applied.
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const placeholders = columns.map(() => "?").join(", ");
      db.$client
        .prepare(
          `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        )
        .run(...columns.map((c) => (row as Record<string, unknown>)[c]));
    }
  }
}
