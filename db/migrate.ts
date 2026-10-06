/**
 * db/migrate.ts — PostgreSQL Migration CLI.
 *
 * Usage:
 *   tsx db/migrate.ts [up]          # apply all pending .sql migrations (default)
 *   tsx db/migrate.ts down          # no-op placeholder (PG rollback is manual)
 *
 * Reads DATABASE_URL from env (defaults to postgresql://localhost:5432/open3dcalc).
 * Applies every .sql file in db/migrations/ in sorted order.
 * Idempotent: uses CREATE TABLE IF NOT EXISTS / DO $$ blocks so re-runs are safe.
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function getConnectionString(): string {
  return process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/open3dcalc";
}

function sortedMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function migrateUp(sql: postgres.Sql): Promise<void> {
  const files = sortedMigrationFiles();
  if (files.length === 0) {
    console.log("[migrate] No migration files found in", MIGRATIONS_DIR);
    return;
  }

  for (const file of files) {
    const ddl = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    try {
      await sql.unsafe(ddl);
      console.log(`[migrate] Applied ${file}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Tolerate "already exists" errors for idempotent re-runs
      if (/already exists/i.test(message)) {
        console.warn(`[migrate] ${file} already applied, skipping`);
        continue;
      }
      throw new Error(`[migrate] Failed to apply ${file}: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  const [command = "up"] = process.argv.slice(2);

  if (command !== "up" && command !== "down") {
    console.error("Usage: tsx db/migrate.ts [up|down] (default: up)");
    process.exit(1);
  }

  const url = getConnectionString();
  console.log("[migrate] Connecting to:", url.replace(/\/\/.*@/, "//***@"));

  const sql = postgres(url);

  try {
    if (command === "up") {
      await migrateUp(sql);
      console.log("[migrate] All migrations applied successfully.");
    } else {
      console.warn("[migrate] 'down' is not implemented for PostgreSQL.");
      console.warn("Rollback must be done manually or via pg_dump restore.");
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1] === __filename || import.meta.url.endsWith(process.argv[1])) {
  main().catch((error) => {
    console.error("[migrate] Fatal error:", error);
    process.exit(1);
  });
}