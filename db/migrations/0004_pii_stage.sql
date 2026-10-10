-- Open3DCalc — Migration 0004: historical PII staging table
--
-- This table belonged to a retired data re-homing design. The migration stays
-- in place so existing SQLite profiles retain their schema and old rows are
-- not dropped by an upgrade. Current code does not create, read, or interpret
-- staged values. The erasure inventory still includes the table so an explicit
-- supported deletion can cover any rows left by an older app version.
--
-- Columns: transaction_id + generation identify WHICH preimage of WHICH
-- attempt; privacy_epoch, schema_version, envelope_version, state, and blob
-- are retained as historical fields only. There is deliberately no CHECK on
-- `state`, preserving compatibility with any values written by old versions.
--
-- ONE statement, IF NOT EXISTS: `runMigrations` (db/database.ts) executes each
-- statement on its own with NO transaction and tolerates only
-- "…already exists" and "duplicate column name:". A single idempotent
-- statement means the only reachable outcome of a partial run is "already
-- applied" — the file cannot leave half a table behind.
--
-- DOWN (rollback, see db/migrate.ts):
--   DROP TABLE IF EXISTS `pii_stage`;

CREATE TABLE IF NOT EXISTS `pii_stage` (
  `transaction_id` TEXT NOT NULL,
  `generation` INTEGER NOT NULL,
  `privacy_epoch` INTEGER NOT NULL,
  `schema_version` INTEGER NOT NULL,
  `envelope_version` INTEGER NOT NULL,
  `state` TEXT NOT NULL,
  `blob` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  PRIMARY KEY (`transaction_id`, `generation`)
);
