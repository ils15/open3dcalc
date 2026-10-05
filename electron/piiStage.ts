/**
 * Beta5 Wave 1 — the `pii_stage` preimage state machine (data-structure layer).
 *
 * Adapted for PostgreSQL: uses async postgres.Sql with sql.begin() for
 * transactional verification instead of sync better-sqlite3 transactions.
 *
 * Four durable steps, one transaction each, in this order:
 *
 * S2 stagePreimage — park the SEALED preimage in `pii_stage`
 * S4 writeDestination — write that sealed blob to its destination row
 * S6 discardStage — retire the stage row
 * S8 deleteSourceRow — drop one plaintext source row, one transaction each
 *
 * Why `pii_stage` is a table and not a `storage` row is recorded in
 * `db/migrations/0004_pii_stage.sql`: the 10 s `deleteStaleKeys` sweep deletes
 * every `storage` key the renderer does not have, and `loadFromDatabase`
 * re-materializes a manifest-allowed one into `localStorage` as plaintext. A
 * stage row parked in `storage` is destroyed within one poll, or mirrored back
 * to the renderer — never a race, always a certainty.
 *
 * Two rules hold across every step here, and both exist because the weaker
 * version of them has already shipped somewhere in this codebase:
 *
 * 1. `result.count` is NOT proof that anything was written. A statement that
 *    matched no row and a statement that stored the wrong bytes both report a
 *    count. Every step therefore RE-READS the stored bytes and throws when
 *    they differ from what was written — inside the transaction, so an
 *    unverifiable write is rolled back rather than left standing.
 * 2. There is no `VACUUM` in this module. It cannot run inside a transaction
 *    and it rewrites the whole table; the caller compacts after the sequence
 *    commits, once, deliberately.
 *
 * This layer never sees plaintext and never encrypts: `blob` is an ADR-001
 * sealed envelope produced by the caller, written and retired verbatim.
 */
import type postgres from "postgres";
import { PII_STAGE_TABLE } from "./piiDomainTables.js";

/**
 * Lifecycle of one staged preimage.
 *
 * - `staged` the preimage is durable; the destination row is not written yet
 * - `applied` the destination row is written AND verified; the stage row is
 *   still here, so a crash before S6 knows the work is done
 *
 * No `failed` state: a stage row that cannot be applied is discarded (S6), not
 * annotated, so a resuming reader never has to interpret a half-state.
 */
export type PiiStageState = "staged" | "applied";

export interface PiiStageRow {
  /** The re-homing transaction this preimage belongs to. */
  transactionId: string;
  /** Which attempt of that transaction; a retry writes the next generation. */
  generation: number;
  /** Privacy policy epoch the preimage was sealed under. */
  privacyEpoch: number;
  /** ADR-001 `S` — logical schema of the protected value. */
  schemaVersion: number;
  /** ADR-001 envelope format version. */
  envelopeVersion: number;
  state: PiiStageState;
  /** The sealed envelope (`enc1:…`). Never plaintext. */
  blob: string;
  createdAt: number;
}

/** A verification that failed: the bytes on disk are not the bytes written. */
export class PiiStageVerificationError extends Error {
  readonly code = "pii_stage_unverified";
  constructor(
    readonly target: string,
    detail: string,
  ) {
    super(
      `[piiStage] ${target} did not store the bytes it was given: ${detail}`,
    );
    this.name = "PiiStageVerificationError";
  }
}

interface RawStageRow {
  transaction_id: string;
  generation: number;
  privacy_epoch: number;
  schema_version: number;
  envelope_version: number;
  state: string;
  blob: string;
  created_at: number;
}

function toStageRow(row: RawStageRow): PiiStageRow {
  return {
    transactionId: row.transaction_id,
    generation: row.generation,
    privacyEpoch: row.privacy_epoch,
    schemaVersion: row.schema_version,
    envelopeVersion: row.envelope_version,
    state: row.state as PiiStageState,
    blob: row.blob,
    createdAt: row.created_at,
  };
}

/** The stored value of a destination `storage` row, or null when absent. */
async function readStoredValue(
  sql: postgres.TransactionSql,
  key: string,
): Promise<string | null> {
  const rows = await sql`SELECT value FROM storage WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as string) : null;
}

async function readStageRow(
  sql: postgres.TransactionSql,
  transactionId: string,
  generation: number,
): Promise<RawStageRow | undefined> {
  const rows = await sql.unsafe(
    `SELECT transaction_id, generation, privacy_epoch, schema_version, envelope_version, state, blob, created_at FROM ${PII_STAGE_TABLE} WHERE transaction_id = $1 AND generation = $2`,
    [transactionId, generation],
  );
  const row = rows[0];
if (!row) return undefined;
return {
  transaction_id: String(row.transaction_id),
  generation: Number(row.generation),
  privacy_epoch: Number(row.privacy_epoch),
  schema_version: Number(row.schema_version),
  envelope_version: Number(row.envelope_version),
  state: String(row.state),
  blob: String(row.blob),
  created_at: Number(row.created_at),
} as RawStageRow;
}

/**
 * S2 — park the sealed preimage. One transaction, proof by re-read.
 *
 * The INSERT is a plain INSERT, not an upsert: re-staging the same
 * (transaction, generation) is a caller bug, and failing loudly beats
 * overwriting a preimage that may already have been applied. A retry uses the
 * next generation.
 *
 * Returns the row as it reads back from disk, not the row that was passed in —
 * the return value IS the proof.
 *
 * KNOWN LIMITATION — the re-read verifies `blob` and NOTHING ELSE. `state`,
 * `privacy_epoch`, `schema_version`, `envelope_version`, `generation` and
 * `created_at` are written and returned without being compared, so a store that
 * corrupted any of them would still pass this proof and the caller would get a
 * row back that does not say what it says. That is a deliberate trade: the blob
 * is the payload, and the blob is what a silent corruption would actually lose
 * or mangle. The metadata is either a caller-supplied literal (a schema version
 * does not drift under a transport) or is re-verified where it is load-bearing —
 * `markStageApplied` compares `state` on its own round trip. Anyone who makes
 * the remaining columns matter to a correctness decision has to widen this
 * comparison; do not read "it returned a row" as "every column is proven".
 */
export async function stagePreimage(
  sql: postgres.Sql,
  row: PiiStageRow,
): Promise<PiiStageRow> {
  return sql.begin(async (tx) => {
    await tx.unsafe(
      `INSERT INTO ${PII_STAGE_TABLE} (transaction_id, generation, privacy_epoch, schema_version, envelope_version, state, blob, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.transactionId,
        row.generation,
        row.privacyEpoch,
        row.schemaVersion,
        row.envelopeVersion,
        row.state,
        row.blob,
        row.createdAt,
      ],
    );
    // Re-read INSIDE the transaction: a mismatch throws, and the throw rolls
    // the INSERT back, so an unproven stage row is never left on disk.
    const stored = await readStageRow(tx, row.transactionId, row.generation);
    if (!stored) {
      throw new PiiStageVerificationError(
        PII_STAGE_TABLE,
        `no row for transaction ${row.transactionId} generation ${row.generation}`,
      );
    }
    if (stored.blob !== row.blob) {
      throw new PiiStageVerificationError(
        PII_STAGE_TABLE,
        "stored blob differs from the sealed preimage",
      );
    }
    return toStageRow(stored);
  });
}

/** The newest generation staged for a transaction, or null. */
export async function readStage(
  sql: postgres.Sql,
  transactionId: string,
): Promise<PiiStageRow | null> {
  const rows = await sql.unsafe(
    `SELECT transaction_id, generation, privacy_epoch, schema_version, envelope_version, state, blob, created_at FROM ${PII_STAGE_TABLE} WHERE transaction_id = $1 ORDER BY generation DESC LIMIT 1`,
    [transactionId],
  );
  const row = rows[0];
  if (!row) return null;
  return toStageRow({
    transaction_id: String(row.transaction_id),
    generation: Number(row.generation),
    privacy_epoch: Number(row.privacy_epoch),
    schema_version: Number(row.schema_version),
    envelope_version: Number(row.envelope_version),
    state: String(row.state),
    blob: String(row.blob),
    created_at: Number(row.created_at),
  } as RawStageRow);
}

/**
 * Move a staged preimage to `applied` — the destination write is done and
 * verified, the stage row is not retired yet. One transaction, proof by re-read.
 */
export async function markStageApplied(
  sql: postgres.Sql,
  transactionId: string,
  generation: number,
): Promise<PiiStageRow> {
  return sql.begin(async (tx) => {
    await tx.unsafe(
      `UPDATE ${PII_STAGE_TABLE} SET state = 'applied' WHERE transaction_id = $1 AND generation = $2`,
      [transactionId, generation],
    );
    const stored = await readStageRow(tx, transactionId, generation);
    if (!stored || stored.state !== "applied") {
      throw new PiiStageVerificationError(
        PII_STAGE_TABLE,
        `state is not "applied" for transaction ${transactionId} generation ${generation}`,
      );
    }
    return toStageRow(stored);
  });
}

/**
 * S4 — write the sealed preimage to its destination row. One transaction,
 * proof by re-read.
 *
 * `blob` is written VERBATIM: it is already an ADR-001 envelope, so it must not
 * go through the persistence gate a second time (that would seal a ciphertext
 * and produce a blob no reader can open). Nothing here decrypts anything.
 *
 * Returns the value as it reads back from disk.
 */
export async function writeDestination(
  sql: postgres.Sql,
  key: string,
  blob: string,
  updatedAt: number = Date.now(),
): Promise<string> {
  return sql.begin(async (tx) => {
    await tx`
      INSERT INTO storage (key, value, updated_at)
      VALUES (${key}, ${blob}, ${updatedAt})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `;
    const stored = await readStoredValue(tx, key);
    if (stored !== blob) {
      throw new PiiStageVerificationError(
        "storage",
        `destination row for ${key} does not read back as written`,
      );
    }
    return stored;
  });
}

/**
 * S6 — retire the stage row. One transaction, proof by re-read absence.
 *
 * Idempotent: retiring an already-retired (transaction, generation) is a no-op
 * success, which is the SPEC-02 §2 resume rule — a resumed run must be able to
 * re-drive any step without treating it as a failure.
 */
export async function discardStage(
  sql: postgres.Sql,
  transactionId: string,
  generation: number,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    await tx.unsafe(
      `DELETE FROM ${PII_STAGE_TABLE} WHERE transaction_id = $1 AND generation = $2`,
      [transactionId, generation],
    );
    const still = await readStageRow(tx, transactionId, generation);
    if (still) {
      throw new PiiStageVerificationError(
        PII_STAGE_TABLE,
        `row for transaction ${transactionId} generation ${generation} survived the delete`,
      );
    }
    return true;
  });
}

/**
 * S8 — delete ONE plaintext source row. One transaction, proof by re-read
 * absence.
 *
 * One row per call, on purpose: each source commits independently, so a
 * failure on the third source cannot roll back the two already deleted, and a
 * resumed run re-drives only what is left. The destination row is never
 * touched here — S4 owns it.
 */
export async function deleteSourceRow(
  sql: postgres.Sql,
  key: string,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    await tx`DELETE FROM storage WHERE key = ${key}`;
    const remaining = await readStoredValue(tx, key);
    if (remaining !== null) {
      throw new PiiStageVerificationError(
        "storage",
        `source row ${key} survived the delete`,
      );
    }
    return true;
  });
}