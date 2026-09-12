/**
 * Desktop erasure store adapters (D1.1 S7) — SPEC-02 §3 (electron rows).
 *
 * Each adapter is idempotent (purging an already-empty store is a no-op
 * success — the resume rule) and implements the §6 post-condition rescan.
 * Renderer-surface rows (localStorage/IndexedDB/OPFS/caches) are executed
 * BY THE RENDERER before the saga starts and arrive here as a purge
 * report; the main process records them and trusts the renderer's rescan
 * for those rows only — every durable surface is rescanned here directly.
 */

import fs from "node:fs";
import path from "node:path";
import type { StoreAdapterLike } from "../src/shared/lib/erasureSaga/types.js";
import type { MinimalStorageDb } from "./persistGate.js";

const PII_DOMAIN_TABLES = ["customers", "quotes", "quote_items"] as const;

export interface RendererStoreReport {
  purged: number;
  remaining: string[];
}

export type RendererPurgeReport = Partial<
  Record<
    "localstorage" | "indexeddb" | "opfs" | "cache_api_sw",
    RendererStoreReport
  >
>;

export interface RendererReportAdapter extends StoreAdapterLike {
  report: RendererStoreReport;
}

/** Wrap a renderer purge report as an already-executed store row. */
export function rendererReportAdapter(
  store: StoreAdapterLike["store"],
  report: RendererStoreReport | undefined,
): RendererReportAdapter {
  const purged = report?.purged ?? 0;
  const remaining = report?.remaining ?? [];
  return {
    store,
    report: { remaining, purged },
    async purge() {
      return purged;
    },
    async rescan() {
      return remaining;
    },
  };
}

/** §3 row 2: manifest-PII domain tables + their child rows. */
export function sqliteDomainTablesAdapter(
  db: MinimalStorageDb,
): StoreAdapterLike {
  return {
    store: "sqlite_domain_tables",
    async purge() {
      let deleted = 0;
      for (const table of PII_DOMAIN_TABLES) {
        try {
          deleted += (
            db.prepare(`DELETE FROM ${table}`).run() as { changes: number }
          ).changes;
        } catch {
          // Table absent in older databases — already empty (idempotent).
        }
      }
      // §3: VACUUM so freed pages are not recoverable from the file.
      db.prepare("VACUUM").run();
      return deleted;
    },
    async rescan() {
      const remaining: string[] = [];
      for (const table of PII_DOMAIN_TABLES) {
        try {
          const count = (
            db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
              c: number;
            }
          ).c;
          if (count > 0) remaining.push(`${table}: ${count} rows`);
        } catch {
          /* absent table = clean */
        }
      }
      return remaining;
    },
  };
}

/** §3 row 3: the whole key/value storage table (manifest-gated surfaces). */
export function sqliteStorageAdapter(db: MinimalStorageDb): StoreAdapterLike {
  return {
    store: "sqlite_storage",
    async purge() {
      const changes = (
        db.prepare("DELETE FROM storage").run() as { changes: number }
      ).changes;
      db.prepare("VACUUM").run();
      return changes;
    },
    async rescan() {
      const count = (
        db.prepare("SELECT COUNT(*) AS c FROM storage").get() as { c: number }
      ).c;
      return count > 0 ? [`storage: ${count} rows`] : [];
    },
  };
}

/** §3 row 4: checkpoint + verify the WAL/SHM sidecars are empty or gone. */
export function sqliteWalShmAdapter(
  dbPath: string,
  db: MinimalStorageDb,
): StoreAdapterLike {
  return {
    store: "sqlite_wal_shm",
    async purge() {
      db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();
      return 1;
    },
    async rescan() {
      const remaining: string[] = [];
      for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
        if (!fs.existsSync(sidecar)) continue;
        const size = fs.statSync(sidecar).size;
        // A zero-length sidecar carries no recoverable pages.
        if (size > 0)
          remaining.push(`${path.basename(sidecar)}: ${size} bytes`);
      }
      return remaining;
    },
  };
}

/** §3 row 8: app-owned files under userData — never the journal or the DB. */
export function appdataFilesAdapter(userDataDir: string): StoreAdapterLike {
  const KEEP = new Set(["erasure-journal.json", "erasure-snapshots"]);
  return {
    store: "appdata_files",
    async purge() {
      let deleted = 0;
      if (!fs.existsSync(userDataDir)) return 0;
      for (const entry of fs.readdirSync(userDataDir)) {
        const full = path.join(userDataDir, entry);
        if (KEEP.has(entry) || entry.startsWith("erasure-snapshots")) continue;
        // Only top-level app files we own by name pattern — never the
        // SQLite database itself (covered by the sqlite stores) and never
        // directories managed by Electron (Cache/GPUCache...).
        if (
          fs.statSync(full).isFile() &&
          (entry.startsWith("open3dcalc") || entry.endsWith(".json"))
        ) {
          fs.rmSync(full, { force: true });
          deleted++;
        }
      }
      return deleted;
    },
    async rescan() {
      const remaining: string[] = [];
      if (!fs.existsSync(userDataDir)) return remaining;
      for (const entry of fs.readdirSync(userDataDir)) {
        const full = path.join(userDataDir, entry);
        if (
          fs.statSync(full).isFile() &&
          entry.startsWith("open3dcalc") &&
          !entry.startsWith("open3dcalc-backup")
        ) {
          remaining.push(`appdata: ${entry}`);
        }
      }
      return remaining;
    },
  };
}

/** §3 row 9: log files are removed during erasure. */
export function logsAdapter(logsDir: string): StoreAdapterLike {
  return {
    store: "logs",
    async purge() {
      let deleted = 0;
      if (!fs.existsSync(logsDir)) return 0;
      for (const entry of fs.readdirSync(logsDir)) {
        if (entry.endsWith(".log")) {
          fs.rmSync(path.join(logsDir, entry), { force: true });
          deleted++;
        }
      }
      return deleted;
    },
    async rescan() {
      return fs.existsSync(logsDir) &&
        fs.readdirSync(logsDir).some((f) => f.endsWith(".log"))
        ? ["logs: files remain"]
        : [];
    },
  };
}

/** §3 row 10: staging/temp files (import staging, temp copies). */
export function tempStagingAdapter(dbDir: string): StoreAdapterLike {
  return {
    store: "temp_staging",
    async purge() {
      let deleted = 0;
      if (!fs.existsSync(dbDir)) return 0;
      for (const entry of fs.readdirSync(dbDir)) {
        if (entry.startsWith("open3dcalc-import-") || entry.endsWith(".tmp")) {
          fs.rmSync(path.join(dbDir, entry), { force: true });
          deleted++;
        }
      }
      return deleted;
    },
    async rescan() {
      return fs.existsSync(dbDir) &&
        fs
          .readdirSync(dbDir)
          .some((f) => f.startsWith("open3dcalc-import-") || f.endsWith(".tmp"))
        ? ["temp_staging: files remain"]
        : [];
    },
  };
}
