/**
 * @vitest-environment node
 *
 * Migration 0004 — schema compatibility for the retired `pii_stage` table.
 *
 * The table was added for a retired data re-homing design. Keep its migration
 * so existing profiles remain compatible and historical rows are preserved.
 * The current app does not interpret, read, or write those rows.
 *
 *  - `persistence-bridge.deleteStaleKeys()` runs every `AUTO_SAVE_INTERVAL_MS`
 *    (10 s) and DELETES every `storage` key that is absent from renderer
 *    `localStorage`, so a stage row stored there is gone within one poll;
 *  - `loadFromDatabase()` materializes manifest-allowed `storage` rows into
 *    renderer `localStorage`.
 *
 * The dedicated table is outside the generic storage route and remains in the
 * erasure inventory for explicit supported deletion.
 *
 * The runner (`db/database.ts runMigrations`, :160-206) executes statements ONE
 * AT A TIME with no transaction and tolerates only two error shapes
 * ("…already exists", "duplicate column name:"), so this file must be a single
 * `CREATE TABLE IF NOT EXISTS`: after a partial run the only reachable failure
 * is "already applied".
 *
 * The last block pins the `requiredTables()` consequence: adding a table makes
 * it mandatory for `db:import` validation, and the decision recorded here is
 * that the stage table is EXEMPT (see the reasoning in that describe block).
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  initDatabase,
  runMigrations,
  validateDatabaseFile,
} from "../database.js";
import { backupDatabase, migrateDown, migrateUp } from "../migrate.js";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "migrations");
const MIGRATION_FILE = "0004_pii_stage.sql";

/** The documented column contract of the stage table, in order. */
const STAGE_COLUMNS = [
  "transaction_id",
  "generation",
  "privacy_epoch",
  "schema_version",
  "envelope_version",
  "state",
  "blob",
  "created_at",
] as const;

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

let tmpDir: string;

function freshFile(name: string): string {
  return path.join(tmpDir, name);
}

/** Copy a subset of the shipped migrations into an isolated directory. */
function migrationsSubset(files: string[]): string {
  const dir = path.join(tmpDir, `migrations-${files.join("_")}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(MIGRATIONS_DIR, file), path.join(dir, file));
  }
  return dir;
}

function open(file: string): Database.Database {
  const sqlite = new Database(file);
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

/** Executable statements of a migration file, comments removed. */
function statementsOf(file: string): string[] {
  const sql = fs
    .readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

beforeEach(() => {
  closeDatabase();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "open3dcalc-pii-stage-"));
});

afterEach(() => {
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("migration 0004 — file shape", () => {
  it("is exactly one CREATE TABLE IF NOT EXISTS, so a partial run can only be 'already applied'", () => {
    const statements = statementsOf(MIGRATION_FILE);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(
      /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?pii_stage`?\s*\(/i,
    );
    // Nothing that mutates rows or ALTERs: re-running a historical migration
    // must preserve existing profile data.
    expect(statements[0]).not.toMatch(/\b(ALTER|INSERT|UPDATE|DELETE|DROP)\b/i);
  });

  it("documents a reversible down step", () => {
    const sql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, MIGRATION_FILE),
      "utf-8",
    );
    expect(sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+`?pii_stage`?/i);
  });

  it("declares the state machine columns, NOT NULL, keyed by transaction + generation", () => {
    const sqlite = open(freshFile("shape.db"));
    try {
      runMigrations(sqlite, MIGRATIONS_DIR);
      const info = sqlite.pragma("table_info('pii_stage')") as Array<{
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>;
      expect(info.map((column) => column.name)).toEqual([...STAGE_COLUMNS]);
      // Preserve the historical column contract for existing database files.
      for (const column of info) {
        expect(column.notnull, `${column.name} must be NOT NULL`).toBe(1);
      }
      // The historical identity is transaction + generation.
      const keyed = info.filter((column) => column.pk > 0);
      expect(keyed.map((column) => [column.name, column.pk])).toEqual([
        ["transaction_id", 1],
        ["generation", 2],
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("re-running the runner preserves an existing legacy row byte-identically", () => {
    const file = freshFile("idempotent.db");
    const sqlite = open(file);
    try {
      runMigrations(sqlite, MIGRATIONS_DIR);
      const blob = `legacy:${Buffer.from(MARKER, "utf8").toString("base64")}`;
      sqlite
        .prepare(
          "INSERT INTO pii_stage (transaction_id, generation, privacy_epoch, schema_version, envelope_version, state, blob, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run("tx-1", 1, 2, 1, 3, "staged", blob, 1_700_000_000_000);
      const before = sqlite
        .prepare("SELECT * FROM pii_stage")
        .all() as unknown[];

      // The db:import / restart case: the same profile is opened again.
      runMigrations(sqlite, MIGRATIONS_DIR);

      expect(sqlite.prepare("SELECT * FROM pii_stage").all()).toEqual(before);
      expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    } finally {
      sqlite.close();
    }
  });
});

describe("migration 0004 — the pre-remediation database is forward-migrated", () => {
  it("creates the stage table on a 0000-0003 database", () => {
    // The exemption recorded below is only sound while this holds: a file that
    // predates 0004 gains the table from the runner alone, with no data at risk.
    const file = freshFile("pre-0004.db");
    const preDir = migrationsSubset([
      "0000_initial.sql",
      "0001_add_theme.sql",
      "0002_products.sql",
      "0003_filament_tare.sql",
    ]);
    const sqlite = open(file);
    try {
      runMigrations(sqlite, preDir);
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pii_stage'",
          )
          .get(),
      ).toBeUndefined();
    } finally {
      sqlite.close();
    }

    const migrated = open(file);
    try {
      runMigrations(migrated, MIGRATIONS_DIR);
      expect(
        migrated
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pii_stage'",
          )
          .get(),
      ).toEqual({ name: "pii_stage" });
    } finally {
      migrated.close();
    }
  });
});

describe("requiredTables() — the db:import consequence of a new table", () => {
  /**
   * DECISION: `pii_stage` is EXEMPT from `requiredTables()`, so older valid
   * profiles remain importable and the migration runner can restore the schema.
   *
   * The reasoning, in order of weight:
   *
   *  1. The check cannot prevent a bad swap. `db:import` validates a temp copy,
   *     swaps it in, and then calls `initDatabase()` — which re-runs the
   *     migration runner against the swapped file. Requiring the table in the
   *     candidate adds no safety; the runner creates it either way.
   *  2. Rejecting it would prevent importing older valid profiles. The
   *     regular migration runner recreates the schema without modifying their
   *     remaining user data.
   *  3. The check is a legitimacy test on the user's DATA schema, not a
   *     "is this the newest migration" test. A missing historical table does
   *     not make a profile invalid.
   *
   * The cost of the exemption is bounded and pinned below: a candidate that is
   * missing any REAL table is still refused, and the exemption covers exactly
   * one table.
   */
  it("accepts a fully migrated database", () => {
    const file = freshFile("current.db");
    initDatabase(file, { migrationsDir: MIGRATIONS_DIR });
    closeDatabase();
    expect(() => validateDatabaseFile(file)).not.toThrow();
  });

  it("accepts a 0000-0003 database that has no pii_stage yet", () => {
    const file = freshFile("pre-remediation.db");
    initDatabase(file, {
      migrationsDir: migrationsSubset([
        "0000_initial.sql",
        "0001_add_theme.sql",
        "0002_products.sql",
        "0003_filament_tare.sql",
      ]),
    });
    closeDatabase();

    // The state a real pre-remediation file is in.
    const seeded = open(file);
    try {
      expect(
        seeded
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pii_stage'",
          )
          .get(),
      ).toBeUndefined();
      seeded
        .prepare("INSERT INTO storage VALUES (?, ?, ?)")
        .run("open3dcalc_customers_v1", MARKER, 1_700_000_000_000);
    } finally {
      seeded.close();
    }

    expect(() => validateDatabaseFile(file)).not.toThrow();

    // …and importing it really does yield a usable database: the runner adds
    // the table and the user's row is still there.
    initDatabase(file, { migrationsDir: MIGRATIONS_DIR });
    closeDatabase();
    const after = open(file);
    try {
      expect(
        after.prepare("SELECT COUNT(*) AS c FROM pii_stage").get() as {
          c: number;
        },
      ).toEqual({ c: 0 });
      expect(
        after
          .prepare("SELECT value FROM storage WHERE key = ?")
          .get("open3dcalc_customers_v1") as { value: string },
      ).toEqual({ value: MARKER });
    } finally {
      after.close();
    }
  });

  it("accepts a 0000-0004 database that has no legacy_residue yet", () => {
    // The same compatibility rule one migration over: an older valid profile
    // need not already contain `legacy_residue` (0005).
    const preDir = migrationsSubset([
      "0000_initial.sql",
      "0001_add_theme.sql",
      "0002_products.sql",
      "0003_filament_tare.sql",
      "0004_pii_stage.sql",
    ]);
    const file = freshFile("pre-0005.db");
    initDatabase(file, { migrationsDir: preDir });
    closeDatabase();

    const seeded = open(file);
    try {
      expect(
        seeded
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='legacy_residue'",
          )
          .get(),
      ).toBeUndefined();
      seeded
        .prepare("INSERT INTO storage VALUES (?, ?, ?)")
        .run("open3dcalc_customers_v1", MARKER, 1_700_000_000_000);
    } finally {
      seeded.close();
    }

    expect(() => validateDatabaseFile(file)).not.toThrow();

    // The runner creates the table empty and the user's row is still there.
    initDatabase(file, { migrationsDir: MIGRATIONS_DIR });
    closeDatabase();
    const after = open(file);
    try {
      expect(
        after.prepare("SELECT COUNT(*) AS c FROM legacy_residue").get() as {
          c: number;
        },
      ).toEqual({ c: 0 });
      expect(
        after
          .prepare("SELECT value FROM storage WHERE key = ?")
          .get("open3dcalc_customers_v1") as { value: string },
      ).toEqual({ value: MARKER });
    } finally {
      after.close();
    }
  });

  it("still refuses a candidate that is missing a real table", () => {
    // Pins the exemption to ONE table: a user-data table the migrations do not
    // recreate is still a hard refusal, so the exemption cannot be widened into
    // a blanket "accept anything old".
    for (const dropped of ["products", "customers", "storage"]) {
      const file = freshFile(`missing-${dropped}.db`);
      initDatabase(file, { migrationsDir: MIGRATIONS_DIR });
      closeDatabase();
      const sqlite = open(file);
      try {
        sqlite.exec(`DROP TABLE \`${dropped}\``);
      } finally {
        sqlite.close();
      }
      expect(() => validateDatabaseFile(file)).toThrow(
        /Database is missing tables required by this app version/,
      );
    }
  });
});

describe("db/migrate.ts — down step and pre-migration backup", () => {
  it("up applies every shipped migration, down reverses 0002 AND 0004", () => {
    const file = freshFile("migrate-cli.db");
    const sqlite = open(file);
    try {
      migrateUp(sqlite);
      const tables = new Set(
        (
          sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .all() as Array<{ name: string }>
        ).map((row) => row.name),
      );
      expect(tables.has("pii_stage")).toBe(true);
      expect(tables.has("products")).toBe(true);

      migrateDown(sqlite);
      const after = new Set(
        (
          sqlite
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .all() as Array<{ name: string }>
        ).map((row) => row.name),
      );
      expect(after.has("pii_stage")).toBe(false);
      expect(after.has("products")).toBe(false);
      // The app baseline is not this CLI's to reverse.
      expect(after.has("storage")).toBe(true);
      expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");

      // And the down step is reversible.
      migrateUp(sqlite);
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pii_stage'",
          )
          .get(),
      ).toEqual({ name: "pii_stage" });
    } finally {
      sqlite.close();
    }
  });

  it("backupDatabase checkpoints the WAL before copying, so the copy is complete", () => {
    // A pre-migration backup is only a safety net if it contains the data. With
    // the page still in the WAL, `copyFileSync` of the main file alone produces
    // a backup that silently lacks every uncheckpointed commit.
    const file = freshFile("wal.db");
    const holder = open(file);
    holder.pragma("journal_mode = WAL");
    // No automatic checkpoint: the committed row stays in the WAL until an
    // explicit one, which is the state a live app is in between checkpoints.
    holder.pragma("wal_autocheckpoint = 0");
    holder.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)");
    const payload = `${MARKER}${"y".repeat(64 * 1024)}`;
    holder.prepare("INSERT INTO notes (body) VALUES (?)").run(payload);

    // Precondition: the main file does NOT carry the row yet.
    expect(fs.statSync(`${file}-wal`).size).toBeGreaterThan(0);
    expect(readFileSync(file).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );

    const backup = backupDatabase(file);
    holder.close();

    expect(fs.existsSync(backup)).toBe(true);
    expect(readFileSync(backup).includes(Buffer.from(MARKER, "utf8"))).toBe(
      true,
    );
    // The backup is a usable database, not a truncated fragment.
    const restored = open(backup);
    try {
      expect(
        restored.prepare("SELECT COUNT(*) AS c FROM notes").get() as {
          c: number;
        },
      ).toEqual({ c: 1 });
      expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
    } finally {
      restored.close();
    }
  });

  it("backupDatabase refuses a path that is not a database, instead of writing a hollow backup", () => {
    const missing = freshFile("does-not-exist.db");
    expect(() => backupDatabase(missing)).toThrow(/does-not-exist\.db/);
  });
});

function readFileSync(file: string): Buffer {
  return fs.readFileSync(file);
}
