/**
 * @vitest-environment node
 *
 * Crash-injection contract tests (D1.1 S7) — TEST-MATRIX §6 rows 6.2/6.3/6.5.
 *
 * "Process death" is simulated at the EXACT durable point: a JournalAdapter
 * wrapper that throws after the atomic journal save persists a chosen state
 * — the equivalent of a SIGKILL landing right after the journal rename (the
 * purge side effects that already happened stay on disk, the in-memory
 * engine state is gone). The resume run uses a fresh engine over the SAME
 * journal storage and REAL better-sqlite3 rows, and must commit idempotently
 * without re-prompting (SPEC-02 §2).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { join } from "node:path";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  startSaga,
  resumeSaga,
  type SagaEngineOptions,
} from "@/shared/lib/erasureSaga/engine";
import type {
  JournalAdapter,
  SnapshotCapability,
  SnapshotStore,
  SagaJournal,
  StoreAdapterLike,
} from "@/shared/lib/erasureSaga/ports";
import { diskJournalAdapter } from "@/shared/lib/erasureSaga/journal";
import { diskSnapshotStore } from "@/shared/lib/erasureSaga/snapshot";

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

class ProcessKilledError extends Error {
  constructor(readonly persistedState: string) {
    super(`process killed after journal state "${persistedState}"`);
    this.name = "ProcessKilledError";
  }
}

let dir: string;
let dbPath: string;
let db: Database.Database;
let sagaDir: string;

function seedDb(): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT)",
  );
  db.prepare(
    "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
  ).run(
    "open3dcalc_customers_v1",
    JSON.stringify([{ name: MARKER }]),
    Date.now(),
  );
  db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(
    "c1",
    MARKER,
  );
}

/** Real better-sqlite3 adapters over the live temp DB. */
function makeAdapters(): StoreAdapterLike[] {
  return [
    {
      store: "sqlite_domain_tables",
      async purge() {
        const changes = db.prepare("DELETE FROM customers").run().changes;
        db.exec("VACUUM");
        return changes;
      },
      async rescan() {
        const c = (
          db.prepare("SELECT COUNT(*) AS c FROM customers").get() as {
            c: number;
          }
        ).c;
        return c > 0 ? [`customers: ${c} rows`] : [];
      },
    },
    {
      store: "sqlite_storage",
      async purge() {
        const changes = db.prepare("DELETE FROM storage").run().changes;
        db.exec("VACUUM");
        return changes;
      },
      async rescan() {
        const c = (
          db.prepare("SELECT COUNT(*) AS c FROM storage").get() as { c: number }
        ).c;
        return c > 0 ? [`storage: ${c} rows`] : [];
      },
    },
    {
      store: "sqlite_wal_shm",
      async purge() {
        db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").run();
        return 1;
      },
      async rescan() {
        return [];
      },
    },
  ];
}

function capability(): SnapshotCapability {
  return {
    keySource: "passphrase",
    canDecrypt: async () => true,
    async encrypt(bytes) {
      return new Uint8Array(
        Buffer.from(`enc:${Buffer.from(bytes).toString("base64")}`),
      );
    },
    async decrypt(cipher) {
      const text = Buffer.from(cipher).toString("utf8");
      return new Uint8Array(Buffer.from(text.slice(4), "base64"));
    },
  };
}

/**
 * Journal wrapper that simulates process death: the atomic save completes
 * (the state IS durable on disk), then the "process" dies.
 */
function crashingJournal(crashWhen: (journal: SagaJournal) => boolean): {
  adapter: JournalAdapter;
  durable: () => SagaJournal | null;
} {
  const disk = diskJournalAdapter(sagaDir);
  let durableState: SagaJournal | null = null;
  return {
    adapter: {
      exists: () => disk.exists(),
      load: () => durableState ?? disk.load(),
      save(j) {
        disk.save(j);
        durableState = j;
        if (crashWhen(j)) throw new ProcessKilledError(j.state);
      },
      destroy: () => disk.destroy(),
    },
    durable: () => durableState,
  };
}

function makeOptions(journal: JournalAdapter): SagaEngineOptions {
  const snapshots: SnapshotStore = diskSnapshotStore(sagaDir);
  return {
    platform: "electron",
    storePlan: ["sqlite_domain_tables", "sqlite_storage", "sqlite_wal_shm"],
    journal,
    snapshots,
    policyVersion: "1.1",
    adapters: makeAdapters(),
    snapshotCapability: capability(),
    collectSnapshotPayload: async () => {
      const rows = db.prepare("SELECT key, value FROM storage").all() as Array<{
        key: string;
        value: string;
      }>;
      return JSON.stringify({ rows });
    },
    restoreSnapshotPayload: async (payload) => {
      const parsed = JSON.parse(payload) as Array<{
        key: string;
        value: string;
      }>;
      db.prepare("DELETE FROM storage").run();
      const ins = db.prepare(
        "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
      );
      for (const row of parsed) ins.run(row.key, row.value, Date.now());
    },
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "o3dc-s7-"));
  sagaDir = join(dir, "saga");
  dbPath = join(dir, "live.sqlite3");
  db = new Database(dbPath);
  seedDb();
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("erasure saga crash + resume (SPEC-02 §2, real SQLite)", () => {
  it("6.2: death after snapshot_taken ⇒ idempotent resume commits, journal destroyed", async () => {
    const crash = crashingJournal((j) => j.state === "snapshot_taken");
    await expect(startSaga(makeOptions(crash.adapter))).rejects.toThrow(
      ProcessKilledError,
    );
    // The snapshot_taken journal IS durable on disk after the "crash".
    expect(fs.existsSync(path.join(sagaDir, "erasure-journal.json"))).toBe(
      true,
    );
    const durable = JSON.parse(
      readFileSync(path.join(sagaDir, "erasure-journal.json"), "utf8"),
    ) as SagaJournal;
    expect(durable.state).toBe("snapshot_taken");
    expect(durable.confirmation.scope).toBe("delete_all");

    // Resume with a FRESH engine over the same durable journal (the
    // "process" came back up — no crash injection on resume):
    const resumeOptions = makeOptions(diskJournalAdapter(sagaDir));
    const result = await resumeSaga(resumeOptions);
    console.log(
      "RESUME:",
      JSON.stringify({
        state: result.journal?.state,
        hasReceipt: !!result.receipt,
        disk: fs.existsSync(path.join(sagaDir, "erasure-journal.json")),
        diskState: (diskJournalAdapter(sagaDir).load() as SagaJournal | null)
          ?.state,
      }),
    );
    const { journal, receipt } = result;
    expect(receipt?.stores_completed).toEqual([
      "sqlite_domain_tables",
      "sqlite_storage",
      "sqlite_wal_shm",
    ]);
    expect(journal?.state).toBe("committed");
    // Terminal: journal destroyed, PII gone from the real DB file.
    expect(fs.existsSync(path.join(sagaDir, "erasure-journal.json"))).toBe(
      false,
    );
    expect(readFileSync(dbPath).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );
  });

  it("6.3: death mid-deleting (one store done) ⇒ resumes from the first incomplete store", async () => {
    // Crash exactly when the SECOND store row (sqlite_storage) is journaled
    // in_progress — the first store's purge is already durable.
    const crash = crashingJournal(
      (j) =>
        j.state === "deleting" &&
        (j.stores.find((r) => r.store === "sqlite_storage")?.state ?? "") ===
          "in_progress",
    );
    await expect(startSaga(makeOptions(crash.adapter))).rejects.toThrow(
      ProcessKilledError,
    );

    const durable = JSON.parse(
      readFileSync(path.join(sagaDir, "erasure-journal.json"), "utf8"),
    ) as SagaJournal;
    expect(durable.state).toBe("deleting");
    expect(
      durable.stores.find((r) => r.store === "sqlite_domain_tables")?.state,
    ).toBe("done");

    const { journal, receipt } = await resumeSaga(
      makeOptions(diskJournalAdapter(sagaDir)),
    );
    expect(receipt?.stores_completed).toEqual([
      "sqlite_domain_tables",
      "sqlite_storage",
      "sqlite_wal_shm",
    ]);
    expect(journal?.state).toBe("committed");
    expect(readFileSync(dbPath).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );
  });

  it("6.5: post-erasure rescan — zero PII rows and the marker gone from the file", async () => {
    const { journal } = await startSaga(
      makeOptions(diskJournalAdapter(sagaDir)),
    );
    expect(journal.state).toBe("committed");
    const storageCount = (
      db.prepare("SELECT COUNT(*) AS c FROM storage").get() as { c: number }
    ).c;
    expect(storageCount).toBe(0);
    expect(readFileSync(dbPath).includes(Buffer.from(MARKER, "utf8"))).toBe(
      false,
    );
  });
});
