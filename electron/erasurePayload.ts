/**
 * Erasure snapshot payload capture/restore (SPEC-02 §5).
 *
 * Adapted for PostgreSQL: uses async postgres.Sql instead of sync PayloadDb.
 * Restore is now wrapped in a transaction to avoid half-restored state.
 *
 * Extracted from `erasure.ts` so the payload builder is unit-testable: that
 * module imports `electron` directly (app/safeStorage) and therefore cannot be
 * imported from a node test. Nothing here touches Electron APIs — only the
 * database client — so the real implementation is exercised directly by
 * `piiDomainTables.test.ts` and `piiStageResidue.test.ts` rather than
 * re-implemented in the test bodies.
 *
 * The table loop iterates `PII_ERASURE_TABLES` — the PII domain tables plus the
 * `pii_stage` preimage table — the single source of truth shared with the §3
 * purge, the §6 rescan and the ADR-003 §2.2.2 backup redaction. `pii_stage` is
 * in it because a staged row IS a preimage: a snapshot that omitted it would
 * make a rollback unrecoverable for exactly the transaction that is mid-flight.
 *
 * One detail is worth reading before changing the restore: it is a MERGE, not a
 * replace — see `restoreSnapshotPayload`.
 */

import type postgres from "postgres";
import { PII_ERASURE_TABLES } from "./piiDomainTables.js";

/**
 * Serialize every PII-bearing row the saga is about to delete, so a failed run
 * can be rolled back. A table absent from this database yields an empty array
 * (idempotent: older profiles predate some tables).
 */
export async function snapshotPayload(sql: postgres.Sql): Promise<string> {
  const rows = await sql`SELECT key, value FROM storage`;
  const domain: Record<string, unknown[]> = {};
  for (const table of PII_ERASURE_TABLES) {
    try {
      const tableRows = await sql.unsafe(`SELECT * FROM "${table}"`);
      domain[table] = tableRows as unknown[];
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
 * - a captured row the saga deleted is put back (that is the point);
 * - a row written after the snapshot, under any key, survives;
 * - re-running the restore is a no-op, which is the SPEC-02 §2 resume rule —
 *   a plain INSERT would abort the whole restore on the second attempt.
 *
 * `updated_at` is stamped with the restore time rather than restored verbatim:
 * the payload captures (key, value) only, and a rollback genuinely does change
 * the row's write time. The sealed preimages in `pii_stage` keep their own
 * `created_at`, because there the column IS part of the captured row.
 *
 * IMPROVEMENT over SQLite version: the entire restore is now wrapped in a
 * single transaction, so a failure partway through rolls back cleanly instead
 * of leaving the database half-restored.
 */
export async function restoreSnapshotPayload(
  sql: postgres.Sql,
  payload: string,
): Promise<void> {
  const parsed = JSON.parse(payload) as {
    storage: Array<{ key: string; value: string }>;
    domain: Record<string, Array<Record<string, unknown>>>;
  };

  await sql.begin(async (tx) => {
    for (const row of parsed.storage) {
      await tx`
        INSERT INTO storage (key, value, updated_at)
        VALUES (${row.key}, ${row.value}, ${Date.now()})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `;
    }

    for (const [table, rows] of Object.entries(parsed.domain)) {
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;

        const colList = columns.map((c) => `"${c}"`).join(", ");
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const values = columns.map((c) => row[c] as string | number | boolean | null);

        let conflictClause: string;
        if (table === "pii_stage") {
          conflictClause = 'ON CONFLICT ("transaction_id", "generation") DO NOTHING';
        } else if (table === "legacy_residue") {
          conflictClause = 'ON CONFLICT ("key") DO NOTHING';
        } else {
          if (columns.includes("key")) {
            conflictClause = 'ON CONFLICT ("key") DO NOTHING';
          } else {
            conflictClause = "";
          }
        }

        await tx.unsafe(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ${conflictClause}`,
          values,
        );
      }
    }
  });
}