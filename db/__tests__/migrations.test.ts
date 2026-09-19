/**
 * @vitest-environment node
 *
 * Migration 0003 (filament tare) — re-run safety + roundtrip.
 *
 * O runner de migrations (db/database.ts) é re-executado sobre um arquivo já
 * totalmente migrado quando o usuário faz db:import de um backup já migrado
 * ou reinicia o app. Nenhuma migration do projeto tinha feito ALTER TABLE
 * antes — o SQLite responde "duplicate column name" nesses re-runs, então o
 * runner precisa tolerar esse erro específico além de "already exists".
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { initDatabase, closeDatabase } from "../database.ts";
import * as schema from "../schema/index.ts";

const MIGRATION_FILES = [
  "0000_initial.sql",
  "0001_add_theme.sql",
  "0002_products.sql",
  "0003_filament_tare.sql",
];

let tmpFile: string;

function makeTmpFile(): string {
  const file = path.join(
    os.tmpdir(),
    `open3dcalc-migrations-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`,
  );
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}-wal`, { force: true });
  fs.rmSync(`${file}-shm`, { force: true });
  return file;
}

describe("migration 0003 — filament tare", () => {
  beforeEach(() => {
    closeDatabase();
    tmpFile = makeTmpFile();
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(tmpFile, { force: true });
    fs.rmSync(`${tmpFile}-wal`, { force: true });
    fs.rmSync(`${tmpFile}-shm`, { force: true });
  });

  it("ships an ALTER TABLE file that adds the tare_grams column", () => {
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const sql = fs.readFileSync(
      path.join(migrationsDir, "0003_filament_tare.sql"),
      "utf-8",
    );
    expect(sql).toMatch(
      /ALTER\s+TABLE\s+`?filament_spools`?\s+ADD\s+COLUMN\s+`?tare_grams`?\s+REAL/i,
    );
    // Every migration the runner will apply is present on disk.
    for (const f of MIGRATION_FILES) {
      expect(fs.existsSync(path.join(migrationsDir, f))).toBe(true);
    }
  });

  it("double-init: re-running migrations on an already-migrated file does not throw", () => {
    const first = initDatabase(tmpFile);
    expect(first).toBeDefined();

    // Sanity: the column really exists after the first init.
    first.run("SELECT tare_grams FROM filament_spools LIMIT 0");
    closeDatabase();

    // Second init on the SAME already-migrated file — this is the db:import
    // scenario (backup já migrado sendo re-migrado pelo runner).
    expect(() => initDatabase(tmpFile)).not.toThrow();
  });

  it("roundtrip: persists and reads tare_grams, and defaults to NULL when absent", () => {
    const db = initDatabase(tmpFile);

    db.insert(schema.filamentSpools)
      .values({
        id: "spool_tare_1",
        dateAdded: Date.now(),
        tareGrams: 210,
      })
      .run();
    const withTare = db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.id, "spool_tare_1"))
      .get();
    expect(withTare).toBeDefined();
    expect(withTare!.tareGrams).toBe(210);

    db.insert(schema.filamentSpools)
      .values({ id: "spool_tare_2", dateAdded: Date.now() })
      .run();
    const withoutTare = db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.id, "spool_tare_2"))
      .get();
    expect(withoutTare).toBeDefined();
    expect(withoutTare!.tareGrams).toBeNull();
  });
});
