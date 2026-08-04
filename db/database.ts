import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// ESM compatibility: __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialises the SQLite database, runs pending migrations (raw SQL files),
 * and returns a Drizzle ORM instance.
 *
 * The database file is stored at the path returned by `getDbPath()`.
 * Migrations are loaded from `db/migrations/` relative to this file.
 *
 * Usage (Electron main process):
 *   import { initDatabase } from './db/database'
 *   const db = initDatabase()
 */

/**
 * Resolves Electron's userData path via dynamic require for ESM compatibility.
 * Returns null when not running inside Electron (test/CLI environments).
 */
function getElectronUserData(): string | null {
  try {
    // Dynamic require for ESM compatibility
    const require = createRequire(import.meta.url);
    const electron = require("electron");
    return electron?.app?.getPath("userData") ?? null;
  } catch {
    return null;
  }
}

export function getDbPath(): string {
  const testPath = process.env["OPEN3DCALC_DB_PATH"];
  if (testPath) return testPath;

  // In Electron, use app.getPath('userData') for a platform-standard location
  const userData = getElectronUserData();
  if (userData) {
    const dbPath = path.join(userData, "open3dcalc.db");
    return dbPath;
  }

  // CLI / test fallback
  const fallbackPath = path.join(__dirname, "..", "..", "..", "open3dcalc.db");
  console.log(
    "[db] No Electron userData available, using fallback:",
    fallbackPath,
  );
  return fallbackPath;
}

/**
 * Restricts the SQLite database file (and its WAL/SHM sidecars) to the
 * current user on non-Windows platforms. SQLite creates files with the
 * default umask (typically 0644), which would leave client PII
 * world-readable. Windows uses ACLs, so this is a no-op there.
 */
function restrictFilePermissions(dbPath: string): void {
  if (process.platform === "win32") return;
  for (const target of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // File may not exist yet (e.g. -wal/-shm are created lazily) — ignore
    }
  }
}

/**
 * Reads and executes SQL migration files in order.
 * Each migration file must be idempotent or guarded with IF NOT EXISTS.
 *
 * Tolerates migrations that were already applied ("table/index already
 * exists") so the database can be re-initialized after a db:import swap
 * without failing on a fully-migrated backup file.
 */
function runMigrations(sqlite: Database.Database): void {
  const migrationsDir = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "db",
    "migrations",
  );
  if (!fs.existsSync(migrationsDir)) {
    console.warn("[db] Migrations directory not found at:", migrationsDir);
    console.warn("[db] Tables will NOT be created. The database may be empty.");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      sqlite.exec(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists/i.test(message)) {
        console.warn(
          `[db] Migration ${file} already applied, skipping (${message})`,
        );
        continue;
      }
      throw error;
    }
  }
}

const TABLE_CREATE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi;

/**
 * Returns the table names declared by the current SQL migration files.
 */
function requiredTables(): string[] {
  const migrationsDir = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "db",
    "migrations",
  );
  const tables = new Set<string>();
  if (!fs.existsSync(migrationsDir)) return [];
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    for (const match of sql.matchAll(TABLE_CREATE_RE)) {
      tables.add(match[1]);
    }
  }
  return [...tables];
}

/**
 * Validates a SQLite database file before it is swapped in as the live
 * database (used by db:import). Throws with a clear message when the
 * file is not a valid SQLite database, fails integrity/foreign-key
 * checks, or is missing tables expected by the current migrations.
 *
 * Intended to run on a disposable copy (never on the live database).
 */
export function validateDatabaseFile(dbPath: string): void {
  let sqlite: Database.Database;
  try {
    sqlite = new Database(dbPath);
  } catch (error) {
    throw new Error(
      `Not a valid SQLite database file: ${(error as Error)?.message ?? String(error)}`,
    );
  }
  try {
    // Fold any sibling WAL into the main file so a single-file copy is complete
    sqlite.pragma("wal_checkpoint(TRUNCATE)");

    const integrity = sqlite.pragma("integrity_check", { simple: true }) as
      string | string[];
    // better-sqlite3 returns the scalar 'ok' (single-value pragma) or an array
    const integrityOk = Array.isArray(integrity)
      ? integrity.length === 1 && integrity[0] === "ok"
      : integrity === "ok";
    if (!integrityOk) {
      throw new Error(`Integrity check failed: ${JSON.stringify(integrity)}`);
    }

    const fkViolations = sqlite.pragma("foreign_key_check") as unknown[];
    if (fkViolations.length > 0) {
      throw new Error(
        `Foreign key check failed: ${fkViolations.length} violation(s)`,
      );
    }

    const existing = new Set(
      (
        sqlite
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as Array<{ name: string }>
      ).map((r) => r.name),
    );
    const missing = requiredTables().filter((t) => !existing.has(t));
    if (missing.length > 0) {
      throw new Error(
        `Database is missing tables required by this app version: ${missing.join(", ")}. ` +
          "Use a backup exported by the current version.",
      );
    }
  } finally {
    sqlite.close();
  }
}

// Singleton cache — initDatabase() should only be called once
let drizzleInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Closes the underlying SQLite connection and resets the singleton so
 * that initDatabase() can be called again. Used by db:import to swap
 * the database file and reconnect in-place.
 */
export function closeDatabase(): void {
  if (!drizzleInstance) return;
  try {
    drizzleInstance.$client.close();
  } catch (error) {
    console.error("[db] Failed to close database:", error);
  } finally {
    drizzleInstance = null;
  }
}

/**
 * Creates and returns a Drizzle ORM instance backed by better-sqlite3.
 *
 * In Electron's main process: call initDatabase() once at startup.
 * In tests: call initDatabase(':memory:') for an isolated in-memory DB.
 */
export function initDatabase(dbPath?: string): ReturnType<typeof drizzle> {
  if (drizzleInstance) return drizzleInstance;

  let sqlite: Database.Database | undefined;
  try {
    const resolvedPath = dbPath ?? getDbPath();
    console.log("[db] Opening database at:", resolvedPath);

    sqlite = new Database(resolvedPath);

    // Recommended performance pragmas for better-sqlite3
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");

    // Restrict permissions immediately after opening (and again after
    // migrations, when WAL/SHM sidecars have been (re)created).
    restrictFilePermissions(resolvedPath);

    runMigrations(sqlite);

    restrictFilePermissions(resolvedPath);

    drizzleInstance = drizzle(sqlite, { schema });
    // Ownership of the connection is transferred to the singleton — it must
    // NOT be closed by the error handler below.
    sqlite = undefined;
    console.log("[db] Database initialized successfully");
    return drizzleInstance;
  } catch (error) {
    // Close the connection this call opened before rethrowing. A leaked
    // handle keeps the DB file locked (Windows/macOS), which would make a
    // subsequent db:import backup restore silently fail and leave the
    // broken imported file in place.
    if (sqlite) {
      try {
        sqlite.close();
      } catch (closeError) {
        console.error(
          "[db] Failed to close connection after initialization error:",
          closeError,
        );
      }
    }
    console.error("[db] Failed to initialize database:", error);
    throw error;
  }
}

// Re-export schema for convenience
export * as schema from "./schema/index.js";
