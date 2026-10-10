-- Open3DCalc — Migration 0005: historical opaque user-data residue
--
-- This table belonged to a retired recovery design for values written by old
-- storage formats. The migration stays in place to preserve existing profile
-- schemas and rows. Current code does not create, read, decode, or migrate
-- these bytes. The erasure inventory still includes the table so an explicit
-- supported deletion can cover values retained by older app versions.
--
-- Columns:
--   * `key`                  — the storage key the legacy blob was found under.
--   * `shape`                — historical format label.
--   * `blob`                 — retained bytes from the old storage row.
--   * `recovered_at`         — when the old copy was taken.
--   * `recovered_value_sha`  — historical SHA-256 metadata; it is not a key and
--                              is not used to recover or transform the blob.
--
-- ONE statement, IF NOT EXISTS: `runMigrations` (db/database.ts) executes each
-- statement on its own with NO transaction and tolerates only "…already exists"
-- and "duplicate column name:". A single idempotent statement means the only
-- reachable outcome of a partial run is "already applied".
--
-- DOWN (rollback, see db/migrate.ts):
--   DROP TABLE IF EXISTS `legacy_residue`;

CREATE TABLE IF NOT EXISTS `legacy_residue` (
  `key` TEXT PRIMARY KEY NOT NULL,
  `shape` TEXT NOT NULL,
  `blob` TEXT NOT NULL,
  `recovered_value_sha` TEXT NOT NULL,
  `recovered_at` INTEGER NOT NULL
);
