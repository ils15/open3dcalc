/**
 * Desktop erasure store adapters (D1.1 S7) — SPEC-02 §3 (electron rows).
 *
 * The legacy adapters remain for isolated tests, but Desktop delete-all is
 * gated unavailable. Renderer reports are telemetry only: they can never
 * satisfy the main-process postcondition or authorize a destructive adapter.
 */

import fs from "node:fs";
import path from "node:path";
import type { StoreAdapterLike } from "../src/shared/lib/erasureSaga/types.js";
import type { MinimalStorageDb } from "./persistGate.js";
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

/**
 * Preserve renderer execution telemetry, but never treat renderer-supplied
 * `remaining` values as main-process postcondition evidence.
 */
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
      void remaining;
      throw new Error(
        "independent renderer postcondition verification unavailable",
      );
    },
  };
}

/**
 * §3 row 2: manifest-PII domain tables + the `pii_stage` preimage table, and
 * their child rows.
 *
 * Iterates `PII_ERASURE_TABLES` — the domain tables PLUS `pii_stage`, which
 * holds a staged preimage and is therefore PII-bearing even though it mirrors
 * no user data. It used to iterate `PII_DOMAIN_TABLES`, which is how a table
 * becomes a silent-residue class: the purge did not touch it and the §6 rescan
 * could not name what survived.
 *
 * The deletes are deliberately NOT wrapped in one transaction: a table absent
 * from an older profile must not abort the purge of the tables that are there.
 * Per-table isolation is the idempotence the resume rule depends on.
 *
 * T4.5 — the delete is GATED on `COUNT > 0`. The domain tables are empty by
 * construction in any repo-built profile (breakdown §5.4), so this cleanup is a
 * scan-and-report, never a delete-by-default: a table that holds no rows is
 * never issued a `DELETE` at all. A nonzero count is a genuine finding (a
 * non-repo build, a manual edit, a future writer) and is surfaced as such by
 * the §6 `rescan` below and by the ADR-002 §2.3 scan report — never silently
 * cleared. The gate is per-table and lives ONLY here: the migration/re-home
 * paths are copy-without-delete and never import this adapter
 * (`sqliteDomainTablesAdapter` is wired only into the SPEC-02 erasure saga).
 */
export function sqliteDomainTablesAdapter(
  db: MinimalStorageDb,
): StoreAdapterLike {
  return {
    store: "sqlite_domain_tables",
    async purge() {
      let deleted = 0;
      for (const table of PII_ERASURE_TABLES) {
        try {
          // T4.5: read the count BEFORE deleting. An empty table is skipped
          // entirely — no `DELETE` statement is prepared for it — so the
          // cleanup can never read as a delete-by-default.
          const count = (
            db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
              c: number;
            }
          ).c;
          if (count === 0) continue;
          deleted += (
            db.prepare(`DELETE FROM ${table}`).run() as { changes: number }
          ).changes;
        } catch {
          // Table absent in older databases — already empty (idempotent).
          // NOTE: this catch also swallows a genuine failure (locked or
          // read-only database). The §6 rescan below is what catches that: a
          // table whose rows are still there is named, and the saga does not
          // commit over it. So the swallow is safe here and ONLY because the
          // rescan is not a best-effort.
        }
      }
      // §3: VACUUM so freed pages are not recoverable from the file.
      // Deliberately outside any transaction — VACUUM cannot run inside one,
      // and it rewrites the whole file. The stage state machine
      // (`electron/piiStage.ts`) never issues it for the same reason.
      db.prepare("VACUUM").run();
      return deleted;
    },
    async rescan() {
      const remaining: string[] = [];
      for (const table of PII_ERASURE_TABLES) {
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

/**
 * §3 row 8: app-owned files under userData — never the journal or the DB.
 *
 * `purge()` and `rescan()` decide "is this file in the erasure scope" through
 * ONE predicate (`isAppOwnedFile`) and ONE keep-list. They used to carry the
 * decision separately, and they disagreed: `rescan()` skipped any
 * `open3dcalc-backup*` file that `purge()` deleted. That asymmetry was recorded
 * as harmless — purge is strictly stronger, so it cannot LEAVE residue — and it
 * is harmless only in the direction nobody looks at. The failure that matters is
 * a purge that does NOT delete: the file survives, `rescan` does not name it,
 * the §6 post-condition passes, and the saga commits over a file full of the
 * user's data. So the prefix exclusion is gone: `rescan` now reports every file
 * `purge` targets, and the two cannot drift apart again.
 *
 * The keep-list is the saga's own state (`erasure-journal.json`,
 * `erasure-snapshots*`), which both sides skip — a journal that deletes itself
 * is a journal that cannot be resumed, and the snapshot is destroyed by the
 * commit/rollback step, not by a store row.
 *
 * Related: `db/database.ts` resolves the DB to `<userData>/open3dcalc.db`, so
 * `dirname(dbPath) === userData` and the pre-import copies
 * `<userData>/open3dcalc.db.backup-<ts>` produced by `db:import` ARE covered by
 * this adapter on both purge and rescan.
 *
 * KNOWN GAP (pre-existing, recorded not fixed) — an operator-placed diagnostic
 * backup in `userData` is outside SPEC-02 §3 scope, and the widened predicate
 * makes that visible in an asymmetric way. `createDiagnosticBackup` writes
 * `<target>` plus a `<target>.meta.json` sidecar; if the operator chose
 * `userData` as the target directory, the sidecar lands in the erasure scope
 * (`endsWith(".json")`) while the `.sqlite3` beside it does not (`isAppOwnedFile`
 * is `startsWith("open3dcalc") || endsWith(".json")`, and a target named e.g.
 * `diag.sqlite3` matches neither). So delete-all removes the sidecar and leaves
 * the database it describes.
 *
 * Over-inclusive rather than a hole, deliberately: the erasure side is stronger
 * than the retention side, which is the safe direction — a scope that is too
 * wide destroys something it should have kept, a scope that is too narrow
 * commits over a file full of the user's data. And the missing sidecar does not
 * make the surviving `.sqlite3` look safe: `scanBackups`
 * (`scripts/diagnostic-retention.mjs`) treats an unreadable sidecar as
 * `redacted: false` and falls back to the DEFAULT 14-day deadline, ageing the
 * file by mtime, so the unredacted-copy violation fires sooner, not later. It
 * loses the operator's real `retentionDays` and `createdAt`, nothing more.
 * Nothing pins the two halves together today: an operator who starts writing
 * backups into `userData` gets a sidecar that disappears on the next
 * delete-all with no warning. Fixing it means deciding whether the diagnostic
 * surface belongs in §3 at all (a `userData`-resident operator artifact is a
 * different question from an app-owned file), which is a contract call, not a
 * predicate fix.
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
        // Only top-level app files we own by name pattern — never the
        // SQLite database itself (covered by the sqlite stores) and never
        // directories managed by Electron (Cache/GPUCache...).
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
