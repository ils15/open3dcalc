import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the PostgreSQL connection string from environment variables.
 * Falls back to localhost for development if not set.
 */
export function getConnectionString(): string {
  return process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/open3dcalc";
}

/**
 * Resolves the directory holding the raw SQL migration files.
 */
function resolveMigrationsDir(): string | null {
  const candidates = [
    path.join(__dirname, "..", "..", "..", "db", "migrations"),
    path.join(__dirname, "migrations"),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

/**
 * Splits a SQL script into individual statements, respecting quotes and comments.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | "]" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote !== null) {
      const closing = quote === "]" ? "]" : quote;
      if (char === closing) {
        if (next === closing && quote !== "]") {
          index++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      index++;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      index++;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
    } else if (char === "[") {
      quote = "]";
    } else if (char === ";") {
      const statement = sql.slice(start, index + 1).trim();
      if (statement.length > 0) statements.push(statement);
      start = index + 1;
    }
  }

  const remainder = sql.slice(start).trim();
  if (remainder.length > 0) statements.push(remainder);
  return statements;
}

/**
 * Runs pending SQL migrations against the PostgreSQL database.
 */
export async function runMigrations(
  sql: postgres.Sql,
  migrationsDir: string | null = resolveMigrationsDir(),
): Promise<void> {
  if (migrationsDir === null || !fs.existsSync(migrationsDir)) {
    throw new Error(
      "Database migrations directory is missing; startup aborted.",
    );
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    throw new Error(
      "Database migrations directory contains no SQL files; startup aborted.",
    );
  }

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    for (const statement of splitSqlStatements(content)) {
      try {
        await sql.unsafe(statement);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isAlreadyApplied =
          /already exists/i.test(message) ||
          /duplicate column/i.test(message) ||
          /relation .* already exists/i.test(message);
        if (isAlreadyApplied) {
          console.warn(
            `[db] Migration ${file} statement already applied, continuing (${message})`,
          );
          continue;
        }
        throw new Error(`Failed to execute migration ${file}: ${message}`, {
          cause: error,
        });
      }
    }
  }
}

const TABLE_CREATE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi;

const IMPORT_EXEMPT_TABLES: ReadonlySet<string> = new Set([
  "pii_stage",
  "legacy_residue",
]);

function requiredTables(): string[] {
  const migrationsDir = resolveMigrationsDir();
  const tables = new Set<string>();
  if (migrationsDir === null) return [];
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
  return [...tables].filter((table) => !IMPORT_EXEMPT_TABLES.has(table));
}

/**
 * Validates connectivity and schema completeness against PostgreSQL.
 */
export async function validateConnection(sql: postgres.Sql): Promise<void> {
  try {
    await sql`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Failed to connect to PostgreSQL: ${(error as Error)?.message ?? String(error)}`,
    );
  }

  const existingRows = await sql`
    SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'
  `;
  const existing = new Set(existingRows.map((r) => r.name as string));
  const missing = requiredTables().filter((t) => !existing.has(t));
  if (missing.length > 0) {
    throw new Error(
      `Database is missing tables required by this app version: ${missing.join(", ")}. ` +
        "Run migrations or restore from a compatible backup.",
    );
  }
}

let drizzleInstance: ReturnType<typeof drizzle> | null = null;
let sqlClient: postgres.Sql | null = null;

/**
 * Closes the PostgreSQL connection pool and resets the singleton.
 */
export async function closeDatabase(): Promise<void> {
  if (!drizzleInstance) return;
  try {
    if (sqlClient) await sqlClient.end();
  } catch (error) {
    console.error("[db] Failed to close database:", error);
  } finally {
    drizzleInstance = null;
    sqlClient = null;
  }
}

export interface InitDatabaseOptions {
  migrationsDir?: string;
}

/**
 * Creates and returns a Drizzle ORM instance backed by postgres.js.
 */
export async function initDatabase(
  connectionString?: string,
  options: InitDatabaseOptions = {},
): Promise<ReturnType<typeof drizzle>> {
  if (drizzleInstance) return drizzleInstance;

  const url = connectionString ?? getConnectionString();
  console.log("[db] Connecting to PostgreSQL at:", url.replace(/\/\/.*@/, "//***@"));

  try {
    const sql = postgres(url);
    sqlClient = sql;

    await runMigrations(sql, options.migrationsDir ?? resolveMigrationsDir());

    drizzleInstance = drizzle(sql, { schema });
    console.log("[db] Database initialized successfully");
    return drizzleInstance;
  } catch (error) {
    if (sqlClient) {
      try {
        await sqlClient.end();
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

/**
 * Returns the raw postgres.js client for advanced operations.
 */
export function getSqlClient(): postgres.Sql {
  if (!sqlClient) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return sqlClient;
}

export * as schema from "./schema/index.js";