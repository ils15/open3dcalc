/** @vitest-environment node */

/**
 * Desktop erasure store adapters (SPEC-02 §3).
 *
 * Delete-all is gated unavailable, but each adapter remains the boundary that
 * decides what it deletes and what it reports as residue. These specs drive
 * them directly: the report is telemetry (never proof), the domain-table purge
 * counts before deleting, and the file adapters share one in-scope predicate
 * between purge and rescan so they cannot drift.
 */

import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appdataFilesAdapter,
  logsAdapter,
  rendererReportAdapter,
  sqliteDomainTablesAdapter,
  sqliteStorageAdapter,
  sqliteWalShmAdapter,
  tempStagingAdapter,
} from "../erasureStores.js";
import type { MinimalStorageDb } from "../storageRows.js";

const dirs: string[] = [];

function fixtureDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-erasure-stores-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fakeDb(
  options: {
    counts?: Record<string, number>;
    throwTables?: string[];
  } = {},
): { db: MinimalStorageDb; deleted: string[] } {
  const deleted: string[] = [];
  const db = {
    prepare(sql: string) {
      const match = /FROM (\w+)/.exec(sql);
      const table = match?.[1] ?? "";
      if (options.throwTables?.includes(table)) {
        throw new Error(`no such table: ${table}`);
      }
      return {
        get() {
          return { c: options.counts?.[table] ?? 0 };
        },
        run() {
          if (sql.startsWith("DELETE FROM ")) {
            const target = sql.replace("DELETE FROM ", "");
            deleted.push(target);
            return { changes: options.counts?.[target] ?? 0 };
          }
          return {};
        },
      };
    },
  };
  return { db: db as unknown as MinimalStorageDb, deleted };
}

describe("rendererReportAdapter", () => {
  it("keeps a renderer report as telemetry but never as rescan proof", async () => {
    const adapter = rendererReportAdapter("localstorage", {
      purged: 3,
      remaining: ["open3dcalc_customers_v1"],
    });

    expect(adapter.report).toEqual({
      purged: 3,
      remaining: ["open3dcalc_customers_v1"],
    });
    await expect(adapter.purge()).resolves.toBe(3);
    await expect(adapter.rescan()).rejects.toThrow(
      /independent.*verification/i,
    );
  });

  it("defaults a missing report to zero purged and no residue", async () => {
    const adapter = rendererReportAdapter("indexeddb", undefined);
    expect(adapter.report).toEqual({ purged: 0, remaining: [] });
    await expect(adapter.purge()).resolves.toBe(0);
  });
});

describe("sqliteDomainTablesAdapter", () => {
  it("counts before deleting and never issues DELETE for an empty table", async () => {
    const { db, deleted } = fakeDb({
      counts: {
        customers: 2,
        quotes: 0,
        quote_items: 0,
        history_entries: 1,
        pii_stage: 0,
        legacy_residue: 0,
      },
    });

    await expect(sqliteDomainTablesAdapter(db).purge()).resolves.toBe(3);
    expect(deleted).toEqual(["customers", "history_entries"]);
  });

  it("names only tables that still hold rows and treats absent tables as clean", async () => {
    const { db } = fakeDb({
      counts: { history_entries: 3 },
      throwTables: ["legacy_residue"],
    });

    await expect(sqliteDomainTablesAdapter(db).rescan()).resolves.toEqual([
      "history_entries: 3 rows",
    ]);
  });
});

describe("sqliteStorageAdapter", () => {
  it("purges and rescans the whole key/value storage table", async () => {
    const { db } = fakeDb({ counts: { storage: 4 } });
    await expect(sqliteStorageAdapter(db).purge()).resolves.toBe(4);
    await expect(sqliteStorageAdapter(db).rescan()).resolves.toEqual([
      "storage: 4 rows",
    ]);
  });

  it("reports a clean storage table", async () => {
    const { db } = fakeDb({ counts: { storage: 0 } });
    await expect(sqliteStorageAdapter(db).rescan()).resolves.toEqual([]);
  });
});

describe("sqliteWalShmAdapter", () => {
  it("checkpoints and reports only non-empty sidecars", async () => {
    const dir = fixtureDir();
    const dbPath = path.join(dir, "open3dcalc.db");
    fs.writeFileSync(`${dbPath}-wal`, "abc");
    fs.writeFileSync(`${dbPath}-shm`, "");

    const { db } = fakeDb();
    const adapter = sqliteWalShmAdapter(dbPath, db);
    await expect(adapter.purge()).resolves.toBe(1);
    await expect(adapter.rescan()).resolves.toEqual([
      "open3dcalc.db-wal: 3 bytes",
    ]);

    fs.rmSync(`${dbPath}-wal`, { force: true });
    await expect(adapter.rescan()).resolves.toEqual([]);
  });
});

describe("appdataFilesAdapter", () => {
  it("removes only app-owned top-level files and keeps the saga's own state", async () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, "open3dcalc.db.backup-1"), "backup");
    fs.writeFileSync(path.join(dir, "erasure-journal.json"), "{}");
    fs.writeFileSync(path.join(dir, "notes.json"), "notes");
    fs.writeFileSync(path.join(dir, "keep.txt"), "keep");
    fs.mkdirSync(path.join(dir, "erasure-snapshots"));
    fs.mkdirSync(path.join(dir, "Cache"));

    const adapter = appdataFilesAdapter(dir);
    await expect(adapter.purge()).resolves.toBe(2);
    expect(fs.existsSync(path.join(dir, "open3dcalc.db.backup-1"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "notes.json"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "erasure-journal.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "keep.txt"))).toBe(true);

    fs.writeFileSync(path.join(dir, "open3dcalc-new.json"), "x");
    await expect(adapter.rescan()).resolves.toEqual([
      "appdata: open3dcalc-new.json",
    ]);
  });

  it("is a no-op when the profile directory is absent", async () => {
    const adapter = appdataFilesAdapter(path.join(fixtureDir(), "missing"));
    await expect(adapter.purge()).resolves.toBe(0);
    await expect(adapter.rescan()).resolves.toEqual([]);
  });
});

describe("logsAdapter", () => {
  it("removes .log files and reports whether any remain", async () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, "a.log"), "log");
    fs.writeFileSync(path.join(dir, "b.txt"), "keep");

    const adapter = logsAdapter(dir);
    await expect(adapter.purge()).resolves.toBe(1);
    expect(fs.existsSync(path.join(dir, "b.txt"))).toBe(true);
    await expect(adapter.rescan()).resolves.toEqual([]);

    fs.writeFileSync(path.join(dir, "c.log"), "log");
    await expect(adapter.rescan()).resolves.toEqual(["logs: files remain"]);
  });

  it("is a no-op when the logs directory is absent", async () => {
    const adapter = logsAdapter(path.join(fixtureDir(), "missing"));
    await expect(adapter.purge()).resolves.toBe(0);
    await expect(adapter.rescan()).resolves.toEqual([]);
  });
});

describe("tempStagingAdapter", () => {
  it("removes import staging and .tmp files and reports whether any remain", async () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, "open3dcalc-import-1"), "stage");
    fs.writeFileSync(path.join(dir, "scratch.tmp"), "tmp");
    fs.writeFileSync(path.join(dir, "keep.db"), "db");

    const adapter = tempStagingAdapter(dir);
    await expect(adapter.purge()).resolves.toBe(2);
    expect(fs.existsSync(path.join(dir, "keep.db"))).toBe(true);
    await expect(adapter.rescan()).resolves.toEqual([]);

    fs.writeFileSync(path.join(dir, "open3dcalc-import-2"), "stage");
    await expect(adapter.rescan()).resolves.toEqual([
      "temp_staging: files remain",
    ]);
  });

  it("is a no-op when the staging directory is absent", async () => {
    const adapter = tempStagingAdapter(path.join(fixtureDir(), "missing"));
    await expect(adapter.purge()).resolves.toBe(0);
    await expect(adapter.rescan()).resolves.toEqual([]);
  });
});
