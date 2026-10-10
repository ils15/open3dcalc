/**
 * The canonical SQLite PII cleanup coverage list (SPEC-02 §3 row 2) — ONE
 * source of truth for Electron erasure, rollback and diagnostic redaction.
 *
 * `history_entries` was missing from several hardcoded lists that used to
 * exist (erasure purge + rescan, erasure snapshot payload, diagnostic-backup
 * redaction). Its `resultJson` / `snapshotJson` / `name` columns are PII-bearing, so the
 * SPEC-02 `rescan` post-condition reported "clean" while those rows survived —
 * silent plaintext residue in an already-shipped feature.
 *
 * Every erasure/backup site imports this constant, so those lists cannot drift.
 * Active content tables are declared in SPEC-01. The retired staging/residue
 * tables are intentionally absent from the current data manifest: current code
 * neither creates nor reads them, but erasure/backup still accounts for old
 * rows if an authorized operation encounters them.
 *
 * Adapters MUST treat a missing table as already-empty (idempotent): profiles
 * created before a table was introduced do not have it.
 */

/**
 * The normalized active PII-bearing USER CONTENT tables (db/schema/index.ts).
 *
 * Every row in one of these tables is readable at rest. Keep the inventory
 * explicit because deletion and diagnostic redaction must cover all rows.
 */
export const PII_CONTENT_TABLES = [
  "customers",
  "quotes",
  "quote_items",
  "history_entries",
] as const;

/**
 * The retired `pii_stage` table (migration 0004).
 *
 * Historical table retained in cleanup/backup coverage for compatibility with
 * old profiles. Current code does not create or read rows from it, and the
 * retired table is not a current application data destination.
 */
export const PII_STAGE_TABLE = "pii_stage";

/**
 * The `legacy_residue` table (Beta5 Wave 2, migration 0005).
 *
 * Historical table retained in the erasure inventory so an explicit deletion
 * can remove opaque user-data remnants left by older app versions. Current code
 * does not create, decode, or migrate these records.
 *
 * Historical table retained in cleanup/backup coverage for compatibility with
 * old profiles. Current code does not create, decode, or migrate these rows.
 */
export const LEGACY_RESIDUE_TABLE = "legacy_residue";

/**
 * Active content plus retired migration tables included in cleanup coverage.
 * Only active content is part of the current manifest inventory; the two
 * retired tables stay here so old profile data is covered without reading it.
 */
export const PII_DOMAIN_TABLES = [
  ...PII_CONTENT_TABLES,
  PII_STAGE_TABLE,
  LEGACY_RESIDUE_TABLE,
] as const;

/**
 * Every SQLite table the erasure, snapshot and backup paths must handle,
 * including retired tables for compatibility with older profile files.
 *
 * Active content plus retired migration tables. Kept as a separate alias to
 * make the erasure coverage's purpose explicit at call sites.
 */
export const PII_ERASURE_TABLES = PII_DOMAIN_TABLES;
