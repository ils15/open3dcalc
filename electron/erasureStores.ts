/**
 * Desktop erasure store adapters (D1.1 S7) — SPEC-02 §3 (electron rows).
 *
 * Adapted for PostgreSQL: uses async postgres.Sql instead of sync MinimalStorageDb.
 * SQLite-specific adapters (WAL/SHM checkpoint) removed as PG handles its own WAL.
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
import type postgres from "postgres";
import type { StoreAdapterLike } from "../src/shared/lib/erasureSaga/types.js";
import { PII_ERASURE_TABLES } from "./piiDomainTables.js";

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

/**
 * §3 row 2: manifest-PII domain tables + the `pii_stage` preimage table.
 *
 * Iterates `PII_ERASURE_TABLES` — the domain tables PLUS `pii_stage`.
 * Per-table isolation is the idempotence the resume rule depends on.
 *
 * T4.5 — the delete is GATED on `COUNT > 0`. An empty table is skipped
 * entirely — no `DELETE` statement is issued — so the cleanup can never
 * read as a delete-by-default.
 */
export function pgDomainTablesAdapter(sql: postgres.Sql): StoreAdapterLike {
  return {
    store: "pg_domain_tables",
    async purge() {
      let deleted = 0;
      for (const table of PII_ERASURE_TABLES) {
        try {
          const countRows = await sql.unsafe(
            `SELECT COUNT(*) AS c FROM "${table}"`,
          );
          const count = Number(countRows[0]?.c ?? 0);
          if (count === 0) continue;
          const result = await sql.unsafe(`DELETE FROM "${table}"`);
          deleted += result.count ?? 0;
        } catch {
          // Table absent in older databases — already empty (idempotent).
        }
      }
      try {
        await sql.unsafe("VACUUM");
      } catch {
        // VACUUM may fail in some contexts; non-fatal for erasure purposes.
      }
      return deleted;
    },
    async rescan() {
      const remaining: string[] = [];
      for (const table of PII_ERASURE_TABLES) {
        try {
          const countRows = await sql.unsafe(
            `SELECT COUNT(*) AS c FROM "${table}"`,
          );
          const count = Number(countRows[0]?.c ?? 0);
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
export function pgStorageAdapter(sql: postgres.Sql): StoreAdapterLike {
  return {
    store: "pg_storage",
    async purge() {
      const result = await sql.unsafe("DELETE FROM storage");
      try {
        await sql.unsafe("VACUUM storage");
      } catch {
        // Non-fatal
      }
      return result.count ?? 0;
    },
    async rescan() {
      const countRows = await sql.unsafe(
        "SELECT COUNT(*) AS c FROM storage",
      );
      const count = Number(countRows[0]?.c ?? 0);
      return count > 0 ? [`storage: ${count} rows`] : [];
    },
  };
}

/**
 * §3 row 8: app-owned files under userData — never the journal or the DB.
 *
 * The keep-list is the saga's own state (`erasure-journal.json`,
 * `erasure-snapshots*`), which both sides skip.
 *
 * KNOWN GAP (pre-existing, recorded not fixed) — an operator-placed diagnostic
 * backup in `userData` is outside SPEC-02 §3 scope.
 */
export function appdataFilesAdapter(userDataDir: string): StoreAdapterLike {
  const KEEP = new Set(["erasure-journal.json", "erasure-snapshots"]);
  const isAppOwnedFile = (entry: string): boolean =>
    entry.startsWith("open3dcalc") || entry.endsWith(".json");
  const isInScope = (entry: string): boolean =>
    !KEEP.has(entry) &&
    !entry.startsWith("erasure-snapshots") &&
    fs.statSync(path.join(userDataDir, entry)).isFile() &&
    isAppOwnedFile(entry);
  return {
    store: "appdata_files",
    async purge() {
      let deleted = 0;
      if (!fs.existsSync(userDataDir)) return 0;
      for (const entry of fs.readdirSync(userDataDir)) {
        if (isInScope(entry)) {
          fs.rmSync(path.join(userDataDir, entry), { force: true });
          deleted++;
        }
      }
      return deleted;
    },
    async rescan() {
      const remaining: string[] = [];
      if (!fs.existsSync(userDataDir)) return remaining;
      for (const entry of fs.readdirSync(userDataDir)) {
        if (isInScope(entry)) remaining.push(`appdata: ${entry}`);
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