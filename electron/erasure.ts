/**
 * Desktop erasure orchestration (D1.1 S7) — SPEC-02 §2–§7.
 *
 * The renderer purges its own surfaces first (rendererSweep) and passes the
 * report here; the main process runs the saga over every durable surface
 * with a safeStorage-backed snapshot capability. Journal + snapshots live
 * under `<userData>/erasure/`.
 */

import { app, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import {
  startSaga,
  resumeSaga,
  type SagaEngineOptions,
} from "../src/shared/lib/erasureSaga/engine.js";
import { diskJournalAdapter } from "../src/shared/lib/erasureSaga/journal.js";
import { diskSnapshotStore } from "../src/shared/lib/erasureSaga/snapshot.js";
import type {
  SagaJournal,
  SagaReceipt,
} from "../src/shared/lib/erasureSaga/types.js";
import type { SnapshotCapability } from "../src/shared/lib/erasureSaga/ports.js";
import {
  appdataFilesAdapter,
  logsAdapter,
  rendererReportAdapter,
  sqliteDomainTablesAdapter,
  sqliteStorageAdapter,
  sqliteWalShmAdapter,
  tempStagingAdapter,
  type RendererPurgeReport,
} from "./erasureStores.js";
import { getDbPath } from "../db/database.js";

export function erasureDir(): string {
  return path.join(app.getPath("userData"), "erasure");
}

/** ADR-001 capability for the snapshot: safeStorage on desktop. */
export function safeStorageSnapshotCapability(): SnapshotCapability {
  return {
    keySource: "safeStorage",
    async canDecrypt() {
      try {
        return safeStorage.isEncryptionAvailable() === true;
      } catch {
        return false;
      }
    },
    async encrypt(bytes: Uint8Array) {
      return new Uint8Array(
        safeStorage.encryptString(Buffer.from(bytes).toString("latin1")),
      );
    },
    async decrypt(cipher: Uint8Array) {
      return new Uint8Array(
        Buffer.from(safeStorage.decryptString(Buffer.from(cipher)), "latin1"),
      );
    },
  };
}

function snapshotPayload(db: {
  $client: {
    prepare(sql: string): {
      get(...p: unknown[]): unknown;
      all(...p: unknown[]): unknown[];
    };
  };
}): string {
  const rows = db.$client
    .prepare("SELECT key, value FROM storage")
    .all() as Array<{ key: string; value: string }>;
  const domain: Record<string, unknown[]> = {};
  for (const table of ["customers", "quotes", "quote_items"]) {
    try {
      domain[table] = db.$client
        .prepare(`SELECT * FROM ${table}`)
        .all() as unknown[];
    } catch {
      domain[table] = [];
    }
  }
  return JSON.stringify({ storage: rows, domain });
}

function restoreSnapshotPayload(
  db: { $client: { prepare(sql: string): { run(...p: unknown[]): unknown } } },
  payload: string,
): void {
  const parsed = JSON.parse(payload) as {
    storage: Array<{ key: string; value: string }>;
    domain: Record<string, Array<Record<string, unknown>>>;
  };
  db.$client.prepare("DELETE FROM storage").run();
  const insertStorage = db.$client.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
  );
  for (const row of parsed.storage) {
    insertStorage.run(row.key, row.value, Date.now());
  }
  for (const [table, rows] of Object.entries(parsed.domain)) {
    // Rows are restored verbatim into their origin tables (column sets are
    // unchanged — the payload was captured moments earlier).
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const placeholders = columns.map(() => "?").join(", ");
      db.$client
        .prepare(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        )
        .run(...columns.map((c) => (row as Record<string, unknown>)[c]));
    }
  }
}

function buildAdapters(
  db: {
    $client: {
      prepare(sql: string): {
        get(...p: unknown[]): unknown;
        run(...p: unknown[]): unknown;
        all(...p: unknown[]): unknown[];
      };
    };
  },
  rendererReport: RendererPurgeReport | undefined,
): SagaEngineOptions["adapters"] {
  const dbPath = getDbPath();
  const userData = app.getPath("userData");
  const snapStore = diskSnapshotStore(erasureDir());
  return [
    rendererReportAdapter("localstorage", rendererReport?.localstorage),
    sqliteDomainTablesAdapter(db.$client),
    sqliteStorageAdapter(db.$client),
    sqliteWalShmAdapter(dbPath, db.$client),
    rendererReportAdapter("indexeddb", rendererReport?.indexeddb),
    rendererReportAdapter("opfs", rendererReport?.opfs),
    rendererReportAdapter("cache_api_sw", rendererReport?.cache_api_sw),
    appdataFilesAdapter(userData),
    logsAdapter(path.join(userData, "logs")),
    tempStagingAdapter(path.dirname(dbPath)),
    {
      store: "snapshots",
      async purge() {
        snapStore.destroyAll();
        return 1;
      },
      async rescan() {
        return fs.existsSync(path.join(erasureDir(), "erasure-snapshots"))
          ? ["snapshots directory remains"]
          : [];
      },
    },
  ];
}

function engineOptions(
  db: Parameters<typeof buildAdapters>[0],
  rendererReport: RendererPurgeReport | undefined,
): SagaEngineOptions {
  const sagaDir = erasureDir();
  const snapStore = diskSnapshotStore(sagaDir);
  return {
    platform: "electron",
    journal: diskJournalAdapter(sagaDir),
    snapshots: snapStore,
    policyVersion: "1.1",
    adapters: buildAdapters(db, rendererReport),
    snapshotCapability: safeStorageSnapshotCapability(),
    collectSnapshotPayload: async () => snapshotPayload(db),
    restoreSnapshotPayload: async (payload) =>
      restoreSnapshotPayload(db, payload),
    externalCopiesNotice: [
      "Pacotes de exportação (arquivos .open3dcalc) criados anteriormente continuam onde você os salvou — apague-os manualmente.",
      "Backups diagnósticos feitos por operadores seguem a política de retenção de 14 dias.",
      "Outros dispositivos onde você importou um pacote de sincronização precisam executar o apagamento localmente.",
    ],
  };
}

/** Run (or resume) the desktop erasure saga. Returns the completion receipt. */
export async function runDesktopErasure(
  db: Parameters<typeof buildAdapters>[0],
  rendererReport: RendererPurgeReport | undefined,
): Promise<{ receipt: SagaReceipt; rolledBack: boolean }> {
  const options = engineOptions(db, rendererReport);
  const { journal, receipt } = journalFileHasSaga(options)
    ? await resumeSaga(options)
    : await startSaga(options);
  if (!journal || !receipt) {
    throw new Error("[erasure] saga ended without a receipt");
  }
  return {
    receipt,
    rolledBack: journal.state === "rolled_back",
  };
}

function journalFileHasSaga(options: SagaEngineOptions): boolean {
  return options.journal.exists();
}

/** Startup resume: a non-terminal journal continues automatically (§2). */
export async function resumeErasureIfNeeded(
  db: Parameters<typeof buildAdapters>[0],
): Promise<{ resumed: boolean; receipt?: SagaReceipt; journal?: SagaJournal }> {
  if (!erasureDirHasJournal()) return { resumed: false };
  const { journal, receipt } = await resumeSaga(engineOptions(db, undefined));
  return { resumed: journal !== null, receipt, journal: journal ?? undefined };
}

function erasureDirHasJournal(): boolean {
  return diskJournalAdapter(erasureDir()).exists();
}

/** Metadata-only journal state for the UI. */
export function erasureStatus(): {
  active: boolean;
  state?: string;
  stores?: Array<{ store: string; state: string; attempts: number }>;
} {
  const journal = diskJournalAdapter(erasureDir()).load();
  if (!journal) return { active: false };
  return {
    active: journal.state !== "committed" && journal.state !== "rolled_back",
    state: journal.state,
    stores: journal.stores.map((r) => ({
      store: r.store,
      state: r.state,
      attempts: r.attempts,
    })),
  };
}
