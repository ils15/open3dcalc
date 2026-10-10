/**
 * db/migrate.ts — Migration CLI with rollback + pre-migration backup.
 *
 * Usage (tsx):
 *   tsx db/migrate.ts up [dbPath]     # backup, then apply pending .sql files
 *   tsx db/migrate.ts down [dbPath]   # backup, then roll back 0002 and 0004
 *
 * `down` intentionally only reverses the two migrations that own a table of
 * their own (0002 products, 0004 pii_stage): earlier migrations are the app
 * baseline and have no recorded rollback. Nothing here replaces
 * initDatabase() — the Electron main process keeps using runMigrations().
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/**
 * Copy the live DB file to a timestamped backup. Returns the backup path.
 *
 * The WAL is checkpointed FIRST, through a short-lived connection, because the
 * backup is taken while the app may still be running: with `journal_mode=WAL`
 * every commit since the last checkpoint lives in the `-wal` sidecar, so
 * copying the main file alone yields a backup that is missing exactly the rows
 * a user would restore. A hollow backup is worse than none — it looks like a
 * safety net and is not one — so a checkpoint that cannot complete is an error
 * rather than a silent skip.
 */
export function backupDatabase(dbPath: string): string {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`[migrate] Database not found at ${dbPath}`);
  }
  // TRUNCATE folds the WAL into the main file and empties the sidecar, so the
  // copy below is self-contained. It needs its own connection: the live handle
  // belongs to the Electron main process, not to this CLI.
  const sqlite = new Database(dbPath);
  try {
    const result = sqlite.pragma("wal_checkpoint(TRUNCATE)") as Array<{
      busy: number;
    }>;
    // KNOWN LIMITATION (pre-existing, recorded not fixed) — the non-array
    // branch fails OPEN. An unexpected pragma shape (a bare number, an object, a
    // better-sqlite3 version that changes the return) silently becomes
    // `busy = 0` and the copy below is written anyway, which is the one outcome
    // this function exists to prevent: a backup that is missing every commit
    // since the last checkpoint, presented as a safety net. It should fail
    // CLOSED — an unrecognised result is an error, exactly like a non-zero
    // `busy`. `result[0]?.busy ?? 0` has the same hole one level in.
    const busy = Array.isArray(result) ? (result[0]?.busy ?? 0) : 0;
    if (busy !== 0) {
      throw new Error(
        `[migrate] Could not checkpoint the WAL of ${dbPath} (busy=${busy}); ` +
          "refusing to write an incomplete backup",
      );
    }
  } finally {
    sqlite.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.bak_${stamp}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[migrate] Backup written to ${backupPath}`);
  return backupPath;
}

function sortedMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Apply every .sql migration in order.
 *
 * Idempotent, as the docstring has always claimed: re-running against an
 * already-migrated database is the normal case (a restart, a db:import of an
 * up-to-date backup), and it takes BOTH shapes SQLite uses to say "already
 * done" — `… already exists` for DDL, and `duplicate column name:` for the
 * ALTER TABLE migrations (0003 and any after it). Tolerating only the first
 * meant `migrate up` threw on any database that had 0003 applied, which is
 * every database created after it shipped.
 */
export function migrateUp(sqlite: Database.Database): void {
  for (const file of sortedMigrationFiles()) {
    const ddl = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    try {
      sqlite.exec(ddl);
      console.log(`[migrate] Applied ${file}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /already exists/i.test(message) ||
        /^duplicate column name:/i.test(message)
      ) {
        console.warn(`[migrate] ${file} already applied, skipping`);
        continue;
      }
      throw error;
    }
  }
}

/**
 * Roll back the migrations that own a table: 0002 (products) and 0004
 * (pii_stage). Both drops are `IF EXISTS`, so the step is idempotent.
 *
 * 0004's down step may delete historical user-data rows, which is why `main()`
 * takes a checkpointed backup before calling this. Nothing here VACUUMs; the
 * caller decides whether to rewrite the file after an explicit rollback.
 */
export function migrateDown(sqlite: Database.Database): void {
  sqlite.exec("DROP TABLE IF EXISTS `products`");
  console.log("[migrate] Rolled back 0002_products (dropped `products`)");
  sqlite.exec("DROP TABLE IF EXISTS `pii_stage`");
  console.log("[migrate] Rolled back 0004_pii_stage (dropped `pii_stage`)");
}

function openDb(dbPath: string): Database.Database {
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

function main(): void {
  const [command, dbPathArg] = process.argv.slice(2);
  if (command !== "up" && command !== "down") {
    console.error("Usage: tsx db/migrate.ts <up|down> [dbPath]");
    process.exit(1);
  }
  const dbPath =
    dbPathArg ??
    process.env["OPEN3DCALC_DB_PATH"] ??
    path.join(__dirname, "..", "open3dcalc.db");
  if (!fs.existsSync(dbPath) && command === "down") {
    console.error(`[migrate] Database not found at ${dbPath}`);
    process.exit(1);
  }
  backupDatabase(dbPath);
  const sqlite = openDb(dbPath);
  try {
    if (command === "up") migrateUp(sqlite);
    else migrateDown(sqlite);
  } finally {
    sqlite.close();
  }
}

if (process.argv[1] === __filename) {
  main();
}
