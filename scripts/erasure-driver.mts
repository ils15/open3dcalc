/**
 * Erasure saga driver (D1.1 S7) — SPEC-02 §2/§6 crash-injection harness.
 *
 * A standalone Node process (run via `tsx`) that drives the saga against a
 * REAL SQLite file with REAL journal/snapshot disk storage — no mocks. The
 * vitest crash tests spawn this driver and SIGKILL it at a chosen point
 * (`--crash-at-store` / `--crash-after-snapshot`), then re-run it and
 * assert the §2 resume rules (idempotent, no re-prompt, rescan clean).
 *
 * The snapshot capability here derives a key from a key FILE — deleting the
 * file simulates the "ephemeral key lost" scenario (§5) exactly.
 *
 * Output: prints `__ERASURE_DONE__ {receipt json}` on success,
 * `__ERASURE_ROLLED_BACK__` on rollback, and is otherwise SIGKILLed.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { processKillSelf } from "./erasure-driver-kill.mjs";
import {
  startSaga,
  resumeSaga,
  type SagaEngineOptions,
} from "../src/shared/lib/erasureSaga/engine.js";
import { diskJournalAdapter } from "../src/shared/lib/erasureSaga/journal.js";
import { diskSnapshotStore } from "../src/shared/lib/erasureSaga/snapshot.js";
import type { JournalAdapter, SnapshotCapability } from "../src/shared/lib/erasureSaga/types.js";

const MARKER = "Fernanda Sintética <fernanda@exemplo.teste>";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

// ── §5 snapshot capability: key derives from a deletable key file ───────
function fileKeyCapability(keyFile: string): SnapshotCapability {
  function derive(): Buffer {
    const secret = fs.readFileSync(keyFile);
    return crypto.pbkdf2Sync(secret, "o3dc-driver-salt", 1, 32, "sha256");
  }
  let iv: Buffer;
  return {
    keySource: "passphrase",
    async canDecrypt() {
      return fs.existsSync(keyFile);
    },
    async encrypt(bytes) {
      iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", derive(), iv);
      const enc = Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
      return new Uint8Array(Buffer.concat([iv, cipher.getAuthTag(), enc]));
    },
    async decrypt(cipherBytes) {
      const buf = Buffer.from(cipherBytes);
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        derive(),
        buf.subarray(0, 12),
      );
      decipher.setAuthTag(buf.subarray(12, 28));
      return new Uint8Array(
        Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]),
      );
    },
  };
}

function buildAdapters(
  db: Database.Database,
  opts: { failStore?: string; failures: Map<string, number> },
): StoreAdapterLike[] {
  const storagePurge = db.prepare("DELETE FROM storage");
  const storageCount = db.prepare("SELECT COUNT(*) AS c FROM storage");
  const domainPurge = db.prepare("DELETE FROM customers");
  const domainCount = db.prepare("SELECT COUNT(*) AS c FROM customers");
  const checkpoint = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)");
  const guard = (store: string, run: () => number): (() => number) => {
    if (opts.failStore === store) {
      return () => {
        const n = (opts.failures.get(store) ?? 0) + 1;
        opts.failures.set(store, n);
        throw new Error(`simulated failure #${n}`);
      };
    }
    return run;
  };
  return [
    {
      store: "sqlite_domain_tables",
      purge: guard("sqlite_domain_tables", () => {
        const changes = domainPurge.run().changes;
        db.exec("VACUUM");
        return changes;
      }),
      async rescan() {
        return (domainCount.get() as { c: number }).c > 0
          ? ["customers rows remain"]
          : [];
      },
    },
    {
      store: "sqlite_storage",
      purge: guard("sqlite_storage", () => {
        const changes = storagePurge.run().changes;
        db.exec("VACUUM");
        return changes;
      }),
      async rescan() {
        return (storageCount.get() as { c: number }).c > 0
          ? ["storage rows remain"]
          : [];
      },
    },
    {
      store: "sqlite_wal_shm",
      purge: guard("sqlite_wal_shm", () => checkpoint.run().changes),
      async rescan() {
        return [];
      },
    },
  ];
}

function main(): void {
  const dbPath = arg("db") as string;
  const sagaDir = arg("saga-dir") as string;
  const keyFile = path.join(sagaDir, "snapshot.key");
  const failStore = arg("fail-store");
  const crashAtStore = arg("crash-at-store");
  const crashAfterSnapshot = process.argv.includes("--crash-after-snapshot");

  // Seed: a fresh DB with PII rows on every run that has no DB yet.
  if (!fs.existsSync(dbPath)) {
    const seed = new Database(dbPath);
    seed.exec(
      "CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
    );
    seed.exec("CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT)");
    seed
      .prepare("INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)")
      .run("open3dcalc_customers_v1", JSON.stringify([{ name: MARKER }]), Date.now());
    seed.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c1", MARKER);
    seed.close();
  }
  if (!fs.existsSync(keyFile)) {
    fs.mkdirSync(sagaDir, { recursive: true });
    fs.writeFileSync(keyFile, crypto.randomBytes(32));
  }

  const db = new Database(dbPath);
  const failures = new Map<string, number>();
  // Deterministic crash injection: the SIGKILL fires INSIDE journal.save,
  // immediately after the atomic rename — the crash point is exactly the
  // durable journal state (SPEC-02 §2).
  const disk = diskJournalAdapter(sagaDir);
  const journal: JournalAdapter = {
    exists: () => disk.exists(),
    load: () => disk.load(),
    destroy: () => disk.destroy(),
    save(j) {
      disk.save(j);
      if (
        (crashAfterSnapshot && j.state === "snapshot_taken") ||
        (crashAtStore !== undefined &&
          j.state === "deleting" &&
          j.stores.find((r) => r.store === crashAtStore)?.state ===
            "in_progress")
      ) {
        processKillSelf();
      }
    },
  };
  const options: SagaEngineOptions = {
    platform: "electron",
    storePlan: ["sqlite_domain_tables", "sqlite_storage", "sqlite_wal_shm"],
    journal,
    snapshots: diskSnapshotStore(sagaDir),
    policyVersion: "1.1",
    adapters: buildAdapters(db, { failStore, failures }),
    snapshotCapability: fileKeyCapability(keyFile),
    collectSnapshotPayload: async () => {
      const rows = db
        .prepare("SELECT key, value FROM storage")
        .all() as Array<{ key: string; value: string }>;
      return JSON.stringify({ rows });
    },
    restoreSnapshotPayload: async (payload) => {
      const parsed = JSON.parse(payload) as Array<{ key: string; value: string }>;
      db.prepare("DELETE FROM storage").run();
      const ins = db.prepare(
        "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
      );
      for (const row of parsed) ins.run(row.key, row.value, Date.now());
    },
  };

  console.log(`__DRIVER_ENTRY__ exists=${journal.exists()} loaded=${JSON.stringify(journal.load()?.state ?? null)}`);
  const run = journal.exists() ? resumeSaga(options) : startSaga(options);
  void run
    .then((result) => {
      const { journal, receipt } = result as never;
      console.log(`__RAW_RESULT__ ${JSON.stringify({ keys: Object.keys(result ?? {}), state: (journal as { state?: string })?.state, hasReceipt: !!receipt })}`);
      if (journal?.state === "committed" && receipt) {
        console.log(`__ERASURE_DONE__ ${JSON.stringify(receipt)}`);
      } else {
        console.log(
          `__ERASURE_ROLLED_BACK__ state=${journal?.state} journal=${JSON.stringify(
            options.journal.load(),
          )}`,
        );
      }
      process.exit(0);
    })
    .catch((error) => {
      console.log(
        `__ERASURE_FAILED__ ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(0);
    });
}

main();
