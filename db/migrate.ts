/**
 * db/migrate.ts — Migration CLI for PostgreSQL.
 *
 * Usage (tsx):
 *   tsx db/migrate.ts up    # apply pending .sql files to PG
 *   tsx db/migrate.ts down  # roll back 0002 and 0004
 *
 * Requires DATABASE_URL env var or defaults to localhost:5432/open3dcalc.
 * Backup strategy changed from SQLite WAL checkpoint+copy to pg_dump
 * recommendation (not automated here — run pg_dump manually before migrations).
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
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Apply every .sql migration in order against PostgreSQL.
 * Idempotent: tolerates "already exists" and "duplicate column" errors.
 */
export async function migrateUp(sql: postgres.Sql): Promise<void> {
  for (const file of sortedMigrationFiles()) {
    const ddl = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    try {
      await sql.unsafe(ddl);
      console.log(`[migrate] Applied ${file}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /already exists/i.test(message) ||
        /duplicate column/i.test(message) ||
        /relation .* already exists/i.test(message)
      ) {
        console.warn(`[migrate] ${file} already applied, skipping`);
        continue;
      }
      throw new Error(`Failed to execute migration ${file}: ${message}`, {
        cause: error,
      });
    }
  }
}

/**
 * Roll back the migrations that own a table: 0002 (products) and 0004
 * (pii_stage). Both drops are IF EXISTS, so the step is idempotent.
 */
export async function migrateDown(sql: postgres.Sql): Promise<void> {
  await sql.unsafe("DROP TABLE IF EXISTS products");
  console.log("[migrate] Rolled back 0002_products (dropped products)");
  await sql.unsafe("DROP TABLE IF EXISTS pii_stage");
  console.log("[migrate] Rolled back 0004_pii_stage (dropped pii_stage)");
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  if (command !== "up" && command !== "down") {
    console.error("Usage: tsx db/migrate.ts <up|down>");
    console.error("Set DATABASE_URL env var or defaults to localhost:5432/open3dcalc");
    process.exit(1);
  }

  const url = getConnectionString();
  console.log(`[migrate] Connecting to PostgreSQL at: ${url.replace(/\/\/.*@/, "//***@")}`);

  const sql = postgres(url);
  try {
    if (command === "up") {
      console.log("[migrate] TIP: Run 'pg_dump' manually before applying migrations for backup.");
      await migrateUp(sql);
    } else {
      await migrateDown(sql);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error("[migrate] Fatal error:", error);
    process.exit(1);
  });
}