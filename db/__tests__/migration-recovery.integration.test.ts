/** @vitest-environment node */

import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  getDbPath,
  initDatabase,
  runMigrations,
  validateDatabaseFile,
} from "../database.js";

type MigrationFile =
  | "0000_initial.sql"
  | "0001_add_theme.sql"
  | "0002_products.sql"
  | "0003_filament_tare.sql";

const INITIAL_TABLE_COLUMNS: Record<string, string[]> = {
  app_settings: ["key", "value"],
  calculator_state: ["id", "state_json", "updated_at"],
  catalog_marketplaces: [
    "id",
    "name",
    "fee_percent",
    "fee_fixed",
    "has_free_shipping",
    "shipping_fee_percent",
    "custom",
  ],
  catalog_materials: ["id", "name", "density", "avg_price", "type", "custom"],
  catalog_printers: [
    "id",
    "name",
    "brand",
    "power",
    "value",
    "useful_life",
    "maintenance_per_hour",
    "image",
    "max_filaments",
    "custom",
  ],
  customers: [
    "id",
    "name",
    "company",
    "email",
    "phone",
    "address",
    "notes",
    "created_at",
    "updated_at",
  ],
  filament_spools: [
    "id",
    "brand",
    "material",
    "color",
    "color_hex",
    "weight_grams",
    "original_weight_grams",
    "cost_per_kg",
    "diameter_mm",
    "date_added",
    "notes",
    "status",
    "purchase_store",
  ],
  history_entries: [
    "id",
    "timestamp",
    "type",
    "name",
    "summary",
    "total_cost",
    "sell_price",
    "profit",
    "result_json",
    "snapshot_json",
  ],
  quote_items: [
    "id",
    "quote_id",
    "history_entry_id",
    "name",
    "quantity",
    "unit_price",
    "total_price",
    "discount_percent",
  ],
  quotes: [
    "id",
    "number",
    "title",
    "customer_id",
    "customer_snapshot",
    "global_discount_percent",
    "subtotal",
    "discount_amount",
    "total",
    "status",
    "valid_until",
    "payment_terms",
    "delivery_estimate",
    "footer_note",
    "created_at",
    "updated_at",
    "exported_at",
  ],
  storage: ["key", "value", "updated_at"],
};

const INITIAL_INDEXES = [
  "idx_catalog_materials_type",
  "idx_catalog_printers_brand",
  "idx_customers_email",
  "idx_history_profit",
  "idx_history_timestamp",
  "idx_history_total_cost",
  "idx_history_type",
  "idx_quote_items_quote_id",
  "idx_quotes_created_at",
  "idx_quotes_customer_id",
  "idx_quotes_status",
  "idx_spools_brand",
  "idx_spools_material",
  "idx_spools_status",
  "sqlite_autoindex_app_settings_1",
  "sqlite_autoindex_catalog_marketplaces_1",
  "sqlite_autoindex_catalog_materials_1",
  "sqlite_autoindex_catalog_printers_1",
  "sqlite_autoindex_customers_1",
  "sqlite_autoindex_filament_spools_1",
  "sqlite_autoindex_history_entries_1",
  "sqlite_autoindex_quotes_1",
  "sqlite_autoindex_quotes_2",
  "sqlite_autoindex_storage_1",
].sort();

const PRODUCTS_COLUMNS = [
  "id",
  "name",
  "weight_grams",
  "filament_type",
  "cost_price",
  "sale_price",
  "sold",
  "created_at",
  "updated_at",
];
const PRODUCTS_INDEXES = [
  "idx_products_name",
  "idx_products_sold",
  "sqlite_autoindex_products_1",
].sort();
const OLD_SPOOL_COLUMNS = [
  "id",
  "brand",
  "material",
  "color",
  "color_hex",
  "weight_grams",
  "original_weight_grams",
  "cost_per_kg",
  "diameter_mm",
  "date_added",
  "notes",
  "status",
  "purchase_store",
];
const OLD_SPOOL_CREATE = `CREATE TABLE filament_spools (
  id TEXT PRIMARY KEY NOT NULL,
  brand TEXT DEFAULT '',
  material TEXT DEFAULT 'PLA',
  color TEXT DEFAULT '',
  color_hex TEXT DEFAULT '',
  weight_grams REAL DEFAULT 0,
  original_weight_grams REAL DEFAULT 1000,
  cost_per_kg REAL DEFAULT 0,
  diameter_mm REAL DEFAULT 1.75,
  date_added INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'on_the_way', 'empty')),
  purchase_store TEXT DEFAULT ''
);
CREATE INDEX idx_spools_brand ON filament_spools (brand);
CREATE INDEX idx_spools_material ON filament_spools (material);
CREATE INDEX idx_spools_status ON filament_spools (status);`;

let tmpDir: string;
let dbPath: string;
let migrationDir: string;

function resetTempDirectory(): void {
  closeDatabase();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "open3dcalc-db-recovery-"));
  dbPath = path.join(tmpDir, "synthetic.db");
  migrationDir = path.join(tmpDir, "migrations");
  fs.mkdirSync(migrationDir);
}

function copyMigration(file: MigrationFile): void {
  const source = path.join(import.meta.dirname, "..", "migrations", file);
  fs.copyFileSync(source, path.join(migrationDir, file));
}

function openSeedDatabase(): Database.Database {
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

function tableColumns(sqlite: Database.Database, table: string): string[] {
  return (
    sqlite.pragma(`table_info('${table}')`) as Array<{ name: string }>
  ).map((column) => column.name);
}

function tableNames(sqlite: Database.Database): string[] {
  return (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((table) => table.name);
}

function indexes(sqlite: Database.Database): string[] {
  return (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((index) => index.name);
}

function rows(
  sqlite: Database.Database,
  table: string,
): Record<string, unknown>[] {
  return (
    sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<
      string,
      unknown
    >[]
  ).sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function fullSnapshot(sqlite: Database.Database): {
  tables: Array<{
    name: string;
    columns: string[];
    rows: Record<string, unknown>[];
  }>;
  indexes: string[];
} {
  const tableNames = (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map((table) => table.name);
  return {
    tables: tableNames.map((name) => ({
      name,
      columns: tableColumns(sqlite, name),
      rows: rows(sqlite, name),
    })),
    indexes: indexes(sqlite),
  };
}

function assertHealthy(sqlite: Database.Database): void {
  expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
  expect(sqlite.pragma("foreign_key_check")).toEqual([]);
}

describe("production SQLite startup migration recovery", () => {
  beforeEach(resetTempDirectory);
  afterEach(() => {
    closeDatabase();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails closed for absent or empty migration directories", () => {
    const sqlite = openSeedDatabase();
    try {
      expect(() => runMigrations(sqlite, null)).toThrow(
        "Database migrations directory is missing",
      );
      expect(() =>
        runMigrations(sqlite, path.join(tmpDir, "missing-migrations")),
      ).toThrow("Database migrations directory is missing");
      expect(() => runMigrations(sqlite, migrationDir)).toThrow(
        "Database migrations directory contains no SQL files",
      );
    } finally {
      sqlite.close();
    }
  });

  it("splits statements around comments and semicolons inside quoted SQL", () => {
    fs.writeFileSync(
      path.join(migrationDir, "0000_parser.sql"),
      `-- a line comment; must not end a statement
       CREATE TABLE parser_table (
         id INTEGER PRIMARY KEY,
         [bracket;name] TEXT,
         "double;name" TEXT,
         \`tick;name\` TEXT,
         note TEXT CHECK(note <> 'semi;colon' AND note <> 'it''s;fine')
       );
       /* a block comment; between statements */
       CREATE TABLE parser_after_comments (id INTEGER);`,
    );

    const sqlite = openSeedDatabase();
    try {
      runMigrations(sqlite, migrationDir);
      expect(tableColumns(sqlite, "parser_table")).toEqual([
        "id",
        "bracket;name",
        "double;name",
        "tick;name",
        "note",
      ]);
      expect(tableColumns(sqlite, "parser_after_comments")).toEqual(["id"]);
    } finally {
      sqlite.close();
    }
  });

  it("validates a full SQLite snapshot and rejects invalid, incomplete, or FK-invalid files", () => {
    initDatabase(dbPath);
    closeDatabase();
    expect(() => validateDatabaseFile(dbPath)).not.toThrow();

    const invalidPath = path.join(tmpDir, "not-sqlite.db");
    fs.writeFileSync(invalidPath, "synthetic non-SQLite bytes");
    expect(() => validateDatabaseFile(invalidPath)).toThrow(
      "file is not a database",
    );

    const incompletePath = path.join(tmpDir, "incomplete.db");
    const incomplete = new Database(incompletePath);
    incomplete.close();
    expect(() => validateDatabaseFile(incompletePath)).toThrow(
      "Database is missing tables required by this app version",
    );

    const invalidForeignKey = new Database(dbPath);
    invalidForeignKey.pragma("foreign_keys = OFF");
    invalidForeignKey.exec(`
      CREATE TABLE synthetic_parent (id INTEGER PRIMARY KEY);
      CREATE TABLE synthetic_child (
        parent_id INTEGER REFERENCES synthetic_parent(id)
      );
      INSERT INTO synthetic_child VALUES (404);
    `);
    invalidForeignKey.close();
    expect(() => validateDatabaseFile(dbPath)).toThrow(
      "Foreign key check failed",
    );
  });

  it("resolves an explicit test DB path and the non-Electron fallback", () => {
    const previousPath = process.env["OPEN3DCALC_DB_PATH"];
    try {
      process.env["OPEN3DCALC_DB_PATH"] = dbPath;
      expect(getDbPath()).toBe(dbPath);
      delete process.env["OPEN3DCALC_DB_PATH"];
      expect(getDbPath()).toMatch(/open3dcalc\.db$/);
    } finally {
      if (previousPath === undefined) {
        delete process.env["OPEN3DCALC_DB_PATH"];
      } else {
        process.env["OPEN3DCALC_DB_PATH"] = previousPath;
      }
    }
  });

  it("resumes a physical multi-statement migration after a durable partial write", () => {
    const legacy = openSeedDatabase();
    legacy.exec(`
      CREATE TABLE legacy_fixture (id TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO legacy_fixture VALUES ('preimage', 'preserve exactly');
      CREATE TRIGGER injected_one_shot_failure
      BEFORE INSERT ON legacy_fixture WHEN NEW.id = 'migrated'
      BEGIN SELECT RAISE(ABORT, 'synthetic one-shot migration interruption'); END;
    `);
    legacy.close();
    const preimageHandle = new Database(dbPath);
    const preimage = fullSnapshot(preimageHandle);
    expect(preimage).toEqual({
      tables: [
        {
          name: "legacy_fixture",
          columns: ["id", "value"],
          rows: [{ id: "preimage", value: "preserve exactly" }],
        },
      ],
      indexes: ["sqlite_autoindex_legacy_fixture_1"],
    });
    assertHealthy(preimageHandle);
    preimageHandle.close();
    const dbIdentity = fs.statSync(dbPath);

    fs.writeFileSync(
      path.join(migrationDir, "0000_synthetic.sql"),
      `CREATE TABLE migration_stage (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
       INSERT OR IGNORE INTO migration_stage VALUES ('stage-1', '{"label":"old; row — сохранён"}', 1700000000123);
       CREATE INDEX idx_migration_stage_created ON migration_stage(created_at);
       INSERT OR IGNORE INTO legacy_fixture VALUES ('migrated', 'preserve every field');
       CREATE TABLE migration_tail (id TEXT PRIMARY KEY, note TEXT NOT NULL);
       INSERT OR IGNORE INTO migration_tail VALUES ('tail-1', 'complete');
       CREATE INDEX idx_migration_tail_note ON migration_tail(note);`,
    );
    const fault = new Error("synthetic one-shot migration interruption");

    expect(() => initDatabase(dbPath, { migrationsDir: migrationDir })).toThrow(
      fault.message,
    );
    // initDatabase must close the failed startup connection; opening the same
    // physical file here proves no new/replaced database was used for retry.
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.statSync(dbPath).ino).toBe(dbIdentity.ino);
    const interrupted = new Database(dbPath);
    expect(rows(interrupted, "migration_stage")).toEqual([
      {
        id: "stage-1",
        payload: '{"label":"old; row — сохранён"}',
        created_at: 1700000000123,
      },
    ]);
    expect(
      interrupted.prepare("SELECT * FROM legacy_fixture ORDER BY id").all(),
    ).toEqual([{ id: "preimage", value: "preserve exactly" }]);
    expect(
      interrupted
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_tail'",
        )
        .get(),
    ).toBeUndefined();
    const interruptedSnapshot = fullSnapshot(interrupted);
    expect(interruptedSnapshot).toEqual({
      tables: [
        {
          name: "legacy_fixture",
          columns: ["id", "value"],
          rows: [{ id: "preimage", value: "preserve exactly" }],
        },
        {
          name: "migration_stage",
          columns: ["id", "payload", "created_at"],
          rows: [
            {
              id: "stage-1",
              payload: '{"label":"old; row — сохранён"}',
              created_at: 1700000000123,
            },
          ],
        },
      ],
      indexes: [
        "idx_migration_stage_created",
        "sqlite_autoindex_legacy_fixture_1",
        "sqlite_autoindex_migration_stage_1",
      ],
    });
    assertHealthy(interrupted);
    interrupted.exec("DROP TRIGGER injected_one_shot_failure");
    interrupted.close();

    expect(fs.statSync(dbPath).ino).toBe(dbIdentity.ino);
    const recovered = initDatabase(dbPath, { migrationsDir: migrationDir });
    expect(recovered).toBeDefined();
    closeDatabase();
    expect(fs.statSync(dbPath).ino).toBe(dbIdentity.ino);

    const complete = new Database(dbPath);
    expect(
      complete
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all(),
    ).toEqual([
      { name: "legacy_fixture" },
      { name: "migration_stage" },
      { name: "migration_tail" },
    ]);
    expect(rows(complete, "migration_stage")).toEqual([
      {
        id: "stage-1",
        payload: '{"label":"old; row — сохранён"}',
        created_at: 1700000000123,
      },
    ]);
    expect(rows(complete, "legacy_fixture")).toEqual([
      { id: "migrated", value: "preserve every field" },
      { id: "preimage", value: "preserve exactly" },
    ]);
    expect(rows(complete, "migration_tail")).toEqual([
      { id: "tail-1", note: "complete" },
    ]);
    expect(indexes(complete)).toEqual([
      "idx_migration_stage_created",
      "idx_migration_tail_note",
      "sqlite_autoindex_legacy_fixture_1",
      "sqlite_autoindex_migration_stage_1",
      "sqlite_autoindex_migration_tail_1",
    ]);
    const postimage = fullSnapshot(complete);
    expect(postimage).toEqual({
      tables: [
        {
          name: "legacy_fixture",
          columns: ["id", "value"],
          rows: [
            { id: "migrated", value: "preserve every field" },
            { id: "preimage", value: "preserve exactly" },
          ],
        },
        {
          name: "migration_stage",
          columns: ["id", "payload", "created_at"],
          rows: [
            {
              id: "stage-1",
              payload: '{"label":"old; row — сохранён"}',
              created_at: 1700000000123,
            },
          ],
        },
        {
          name: "migration_tail",
          columns: ["id", "note"],
          rows: [{ id: "tail-1", note: "complete" }],
        },
      ],
      indexes: [
        "idx_migration_stage_created",
        "idx_migration_tail_note",
        "sqlite_autoindex_legacy_fixture_1",
        "sqlite_autoindex_migration_stage_1",
        "sqlite_autoindex_migration_tail_1",
      ],
    });
    assertHealthy(complete);
    complete.close();

    expect(initDatabase(dbPath, { migrationsDir: migrationDir })).toBeDefined();
    closeDatabase();
    const repeated = new Database(dbPath);
    expect(fullSnapshot(repeated)).toEqual(postimage);
    assertHealthy(repeated);
    repeated.close();
  });

  it("applies the shipped initial migration on an on-disk database without losing old storage rows", () => {
    copyMigration("0000_initial.sql");
    const seed = openSeedDatabase();
    seedStorage(seed);
    const before = fullSnapshot(seed);
    expect(before).toEqual({
      tables: [
        {
          name: "storage",
          columns: ["key", "value", "updated_at"],
          rows: [
            {
              key: "legacy_pref",
              value: '{"units":"mm","note":"pré-beta"}',
              updated_at: 1712345678901,
            },
          ],
        },
      ],
      indexes: ["sqlite_autoindex_storage_1"],
    });
    seed.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const sqlite = new Database(dbPath);
    expect(
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all(),
    ).toEqual(
      Object.keys(INITIAL_TABLE_COLUMNS)
        .sort()
        .map((name) => ({ name })),
    );
    for (const [table, expectedColumns] of Object.entries(
      INITIAL_TABLE_COLUMNS,
    )) {
      expect(tableColumns(sqlite, table), table).toEqual(expectedColumns);
    }
    expect(indexes(sqlite)).toEqual(INITIAL_INDEXES);
    expect(rows(sqlite, "storage")).toEqual([
      {
        key: "legacy_pref",
        value: '{"units":"mm","note":"pré-beta"}',
        updated_at: 1712345678901,
      },
    ]);
    expect(
      fullSnapshot(sqlite).tables.filter((table) => table.name !== "storage"),
    ).toEqual(
      Object.keys(INITIAL_TABLE_COLUMNS)
        .filter((table) => table !== "storage")
        .sort()
        .map((name) => ({
          name,
          columns: INITIAL_TABLE_COLUMNS[name],
          rows: [],
        })),
    );
    const postimage = fullSnapshot(sqlite);
    expect(
      postimage.tables.find((table) => table.name === "storage")?.rows,
    ).toEqual(before.tables[0]?.rows);
    assertHealthy(sqlite);
    sqlite.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const repeated = new Database(dbPath);
    expect(fullSnapshot(repeated)).toEqual(postimage);
    assertHealthy(repeated);
    repeated.close();
  });

  it("applies the shipped theme migration without changing existing storage values", () => {
    copyMigration("0001_add_theme.sql");
    const seed = openSeedDatabase();
    seedStorage(seed);
    const before = fullSnapshot(seed);
    expect(before).toEqual({
      tables: [
        {
          name: "storage",
          columns: ["key", "value", "updated_at"],
          rows: [
            {
              key: "legacy_pref",
              value: '{"units":"mm","note":"pré-beta"}',
              updated_at: 1712345678901,
            },
          ],
        },
      ],
      indexes: ["sqlite_autoindex_storage_1"],
    });
    seed.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const sqlite = new Database(dbPath);
    expect(tableNames(sqlite)).toEqual(["storage"]);
    expect(tableColumns(sqlite, "storage")).toEqual([
      "key",
      "value",
      "updated_at",
    ]);
    expect(indexes(sqlite)).toEqual(["sqlite_autoindex_storage_1"]);
    expect(
      sqlite
        .prepare("SELECT key, value, updated_at FROM storage ORDER BY key")
        .all(),
    ).toEqual([
      {
        key: "legacy_pref",
        value: '{"units":"mm","note":"pré-beta"}',
        updated_at: 1712345678901,
      },
      { key: "open3dcalc_theme", value: "system", updated_at: 0 },
    ]);
    expect(before.tables[0]?.rows).toEqual([
      {
        key: "legacy_pref",
        value: '{"units":"mm","note":"pré-beta"}',
        updated_at: 1712345678901,
      },
    ]);
    const postimage = fullSnapshot(sqlite);
    expect(postimage).toEqual({
      tables: [
        {
          name: "storage",
          columns: ["key", "value", "updated_at"],
          rows: [
            {
              key: "legacy_pref",
              value: '{"units":"mm","note":"pré-beta"}',
              updated_at: 1712345678901,
            },
            { key: "open3dcalc_theme", value: "system", updated_at: 0 },
          ],
        },
      ],
      indexes: ["sqlite_autoindex_storage_1"],
    });
    assertHealthy(sqlite);
    sqlite.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const repeated = new Database(dbPath);
    expect(fullSnapshot(repeated)).toEqual(postimage);
    assertHealthy(repeated);
    repeated.close();
  });

  it("repairs a partially present products table and preserves every old row field", () => {
    copyMigration("0002_products.sql");
    const seed = openSeedDatabase();
    seed.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, weight_grams REAL DEFAULT 0,
        filament_type TEXT DEFAULT '', cost_price REAL DEFAULT 0, sale_price REAL DEFAULT 0,
        sold INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      INSERT INTO products VALUES ('legacy-product-7', 'Шестерня β', 42.75, 'PETG-CF', 12.5, 29.99, 1, 1690000000123, 1690000000456);
    `);
    const before = fullSnapshot(seed);
    expect(before).toEqual({
      tables: [
        {
          name: "products",
          columns: PRODUCTS_COLUMNS,
          rows: [
            {
              id: "legacy-product-7",
              name: "Шестерня β",
              weight_grams: 42.75,
              filament_type: "PETG-CF",
              cost_price: 12.5,
              sale_price: 29.99,
              sold: 1,
              created_at: 1690000000123,
              updated_at: 1690000000456,
            },
          ],
        },
      ],
      indexes: ["sqlite_autoindex_products_1"],
    });
    seed.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const sqlite = new Database(dbPath);
    expect(tableNames(sqlite)).toEqual(["products"]);
    expect(tableColumns(sqlite, "products")).toEqual(PRODUCTS_COLUMNS);
    expect(indexes(sqlite)).toEqual(PRODUCTS_INDEXES);
    expect(rows(sqlite, "products")).toEqual([
      {
        id: "legacy-product-7",
        name: "Шестерня β",
        weight_grams: 42.75,
        filament_type: "PETG-CF",
        cost_price: 12.5,
        sale_price: 29.99,
        sold: 1,
        created_at: 1690000000123,
        updated_at: 1690000000456,
      },
    ]);
    const postimage = fullSnapshot(sqlite);
    expect(postimage).toEqual({
      tables: [
        {
          name: "products",
          columns: PRODUCTS_COLUMNS,
          rows: [
            {
              id: "legacy-product-7",
              name: "Шестерня β",
              weight_grams: 42.75,
              filament_type: "PETG-CF",
              cost_price: 12.5,
              sale_price: 29.99,
              sold: 1,
              created_at: 1690000000123,
              updated_at: 1690000000456,
            },
          ],
        },
      ],
      indexes: PRODUCTS_INDEXES,
    });
    expect(
      postimage.tables.find((table) => table.name === "products")?.rows,
    ).toEqual(before.tables[0]?.rows);
    assertHealthy(sqlite);
    sqlite.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const repeated = new Database(dbPath);
    expect(fullSnapshot(repeated)).toEqual(postimage);
    assertHealthy(repeated);
    repeated.close();
  });

  it("adds tare to the literal legacy spool schema without changing any old field", () => {
    copyMigration("0003_filament_tare.sql");
    const seed = openSeedDatabase();
    seed.exec(OLD_SPOOL_CREATE);
    seed.exec(`INSERT INTO filament_spools VALUES (
      'legacy-spool-π', 'Prusament', 'PLA+', 'Ocean Blue', '#176B87', 812.5,
      1000, 89.95, 1.75, 1689999999000, 'legacy batch 🧵', 'in_stock', 'Synthetic shop'
    )`);
    const before = fullSnapshot(seed);
    expect(before).toEqual({
      tables: [
        {
          name: "filament_spools",
          columns: OLD_SPOOL_COLUMNS,
          rows: [
            {
              id: "legacy-spool-π",
              brand: "Prusament",
              material: "PLA+",
              color: "Ocean Blue",
              color_hex: "#176B87",
              weight_grams: 812.5,
              original_weight_grams: 1000,
              cost_per_kg: 89.95,
              diameter_mm: 1.75,
              date_added: 1689999999000,
              notes: "legacy batch 🧵",
              status: "in_stock",
              purchase_store: "Synthetic shop",
            },
          ],
        },
      ],
      indexes: [
        "idx_spools_brand",
        "idx_spools_material",
        "idx_spools_status",
        "sqlite_autoindex_filament_spools_1",
      ],
    });
    seed.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const sqlite = new Database(dbPath);
    expect(tableNames(sqlite)).toEqual(["filament_spools"]);
    expect(tableColumns(sqlite, "filament_spools")).toEqual([
      ...OLD_SPOOL_COLUMNS,
      "tare_grams",
    ]);
    expect(indexes(sqlite)).toEqual([
      "idx_spools_brand",
      "idx_spools_material",
      "idx_spools_status",
      "sqlite_autoindex_filament_spools_1",
    ]);
    expect(rows(sqlite, "filament_spools")).toEqual([
      {
        id: "legacy-spool-π",
        brand: "Prusament",
        material: "PLA+",
        color: "Ocean Blue",
        color_hex: "#176B87",
        weight_grams: 812.5,
        original_weight_grams: 1000,
        cost_per_kg: 89.95,
        diameter_mm: 1.75,
        date_added: 1689999999000,
        notes: "legacy batch 🧵",
        status: "in_stock",
        purchase_store: "Synthetic shop",
        tare_grams: null,
      },
    ]);
    const postimage = fullSnapshot(sqlite);
    expect(postimage).toEqual({
      tables: [
        {
          name: "filament_spools",
          columns: [...OLD_SPOOL_COLUMNS, "tare_grams"],
          rows: [
            {
              id: "legacy-spool-π",
              brand: "Prusament",
              material: "PLA+",
              color: "Ocean Blue",
              color_hex: "#176B87",
              weight_grams: 812.5,
              original_weight_grams: 1000,
              cost_per_kg: 89.95,
              diameter_mm: 1.75,
              date_added: 1689999999000,
              notes: "legacy batch 🧵",
              status: "in_stock",
              purchase_store: "Synthetic shop",
              tare_grams: null,
            },
          ],
        },
      ],
      indexes: [
        "idx_spools_brand",
        "idx_spools_material",
        "idx_spools_status",
        "sqlite_autoindex_filament_spools_1",
      ],
    });
    expect(postimage.tables[0]?.rows[0]).toMatchObject(
      before.tables[0]?.rows[0] ?? {},
    );
    assertHealthy(sqlite);
    sqlite.close();

    initDatabase(dbPath, { migrationsDir: migrationDir });
    closeDatabase();
    const repeated = new Database(dbPath);
    expect(fullSnapshot(repeated)).toEqual(postimage);
    assertHealthy(repeated);
    repeated.close();
  });
});

function seedStorage(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE storage (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO storage VALUES ('legacy_pref', '{"units":"mm","note":"pré-beta"}', 1712345678901);
  `);
}
