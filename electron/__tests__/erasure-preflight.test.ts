/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  userDataDir: { value: "" },
  getDbPath: vi.fn(() => "/synthetic/profile.sqlite3"),
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((value: Buffer) => value.toString()),
  },
}));

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") return mocks.userDataDir.value;
      throw new Error(`unexpected path: ${name}`);
    },
  },
  safeStorage: mocks.safeStorage,
}));

vi.mock("../../db/database.js", () => ({ getDbPath: mocks.getDbPath }));

import {
  authorizeDesktopErasure,
  claimDesktopErasure,
  erasureStatus,
  resumeErasureIfNeeded,
  runDesktopErasure,
  safeStorageSnapshotCapability,
  verifySqliteDomainTables,
} from "../erasure.js";
import { buildStorePlan } from "../../src/shared/lib/erasureSaga/types.js";

const DIAGNOSTIC =
  "[erasure] durable journal invalid or lacks delete_all authorization; preserved; no erasure resumed";
let dbReads = 0;
let originalWarn: typeof console.warn;
let warn: ReturnType<typeof vi.spyOn>;

function inaccessibleDb(): Parameters<typeof runDesktopErasure>[0] {
  return new Proxy(
    {},
    {
      get() {
        dbReads++;
        throw new Error("DB must not be accessed during preflight");
      },
    },
  ) as Parameters<typeof runDesktopErasure>[0];
}

beforeEach(() => {
  mocks.userDataDir.value = fs.mkdtempSync(
    path.join(os.tmpdir(), "o3dc-erasure-preflight-"),
  );
  dbReads = 0;
  vi.clearAllMocks();
  originalWarn = console.warn;
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  console.warn = originalWarn;
  fs.rmSync(mocks.userDataDir.value, { recursive: true, force: true });
});

describe("desktop durable erasure preflight", () => {
  it("refuses authorization before writing a journal when exact PII-only scope is unsupported", () => {
    expect(() => authorizeDesktopErasure()).toThrow(
      "Desktop delete-all is unavailable",
    );
    expect(
      fs.existsSync(
        path.join(mocks.userDataDir.value, "erasure", "erasure-journal.json"),
      ),
    ).toBe(false);
  });

  it.each([
    ["absent", undefined],
    ["invalid", { token: "not-an-opaque-token" }],
    ["expired", "synthetic-expired-token"],
    ["replayed", "synthetic-replayed-token"],
  ])(
    "does not authorize a renderer purge with %s authorization",
    async (_name, token) => {
      await expect(claimDesktopErasure(token)).rejects.toThrow(
        "Desktop delete-all is unavailable",
      );
      await expect(claimDesktopErasure(token)).rejects.toThrow(
        "Desktop delete-all is unavailable",
      );
      expect(
        fs.existsSync(
          path.join(mocks.userDataDir.value, "erasure", "erasure-journal.json"),
        ),
      ).toBe(false);
      expect(dbReads).toBe(0);
      expect(mocks.getDbPath).not.toHaveBeenCalled();
    },
  );

  it("rejects a fabricated empty renderer report before any main-process purge setup", async () => {
    const report = {
      localstorage: { purged: 0, remaining: [] },
      indexeddb: { purged: 0, remaining: [] },
      opfs: { purged: 0, remaining: [] },
      cache_api_sw: { purged: 0, remaining: [] },
    };

    await expect(
      runDesktopErasure(inaccessibleDb(), "fabricated-token", report),
    ).rejects.toThrow("Desktop delete-all is unavailable");

    expect(dbReads).toBe(0);
    expect(mocks.getDbPath).not.toHaveBeenCalled();
    expect(mocks.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(mocks.userDataDir.value, "erasure"))).toBe(
      false,
    );
  });

  it("allows no-journal startup without dereferencing the database", async () => {
    const result = await resumeErasureIfNeeded(inaccessibleDb());

    expect(result).toEqual({ resumed: false });
    expect(dbReads).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("defers valid delete_all journals until renderer verification, without DB access", async () => {
    const sagaDir = path.join(mocks.userDataDir.value, "erasure");
    fs.mkdirSync(sagaDir, { recursive: true });
    const journalPath = path.join(sagaDir, "erasure-journal.json");
    const journal = {
      saga_id: "authorized-saga",
      state: "prepared",
      policy_version: "1.1",
      started_at: "2026-10-06T00:00:00.000Z",
      confirmation: {
        confirmed_at: "2026-10-05T23:59:00.000Z",
        scope: "delete_all",
      },
      rollback_window: { ttl_days: 7, key_source: "safeStorage" },
      stores: buildStorePlan("electron"),
    } as const;
    const raw = JSON.stringify(journal, null, 2);
    fs.writeFileSync(journalPath, raw, "utf8");

    const result = await resumeErasureIfNeeded(inaccessibleDb());

    expect(result).toMatchObject({ resumed: false, journal });
    expect(result.receipt).toBeUndefined();
    expect(fs.readFileSync(journalPath, "utf8")).toBe(raw);
    expect(dbReads).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      "[erasure] durable delete_all resume deferred; renderer verification required",
    );
  });

  it("does not treat SQLite verification failures as absent, already-erased tables", async () => {
    const get = vi.fn(() => {
      throw new Error("database is locked");
    });
    const db = {
      $client: {
        prepare: vi.fn(() => ({ get })),
      },
    } as unknown as Parameters<typeof verifySqliteDomainTables>[0];

    await expect(verifySqliteDomainTables(db)).rejects.toThrow(
      "SQLite domain table verification failed",
    );
    expect(get).toHaveBeenCalledOnce();
  });

  it("preserves an unknown-scope journal and refuses before DB/snapshot/vault setup", async () => {
    const sagaDir = path.join(mocks.userDataDir.value, "erasure");
    fs.mkdirSync(sagaDir, { recursive: true });
    const journalPath = path.join(sagaDir, "erasure-journal.json");
    const raw = JSON.stringify(
      {
        saga_id: "synthetic-saga",
        state: "prepared",
        policy_version: "1.1",
        started_at: "2026-10-06T00:00:00.000Z",
        confirmation: {
          confirmed_at: "2026-10-06T00:00:00.000Z",
          scope: "withdraw_consent",
        },
        rollback_window: { ttl_days: 7, key_source: "safeStorage" },
        stores: [
          { store: "localstorage", state: "pending", attempts: 0 },
          { store: "sqlite_domain_tables", state: "pending", attempts: 0 },
          { store: "sqlite_storage", state: "pending", attempts: 0 },
          { store: "sqlite_wal_shm", state: "pending", attempts: 0 },
          { store: "indexeddb", state: "pending", attempts: 0 },
          { store: "opfs", state: "pending", attempts: 0 },
          { store: "cache_api_sw", state: "pending", attempts: 0 },
          { store: "appdata_files", state: "pending", attempts: 0 },
          { store: "logs", state: "pending", attempts: 0 },
          { store: "temp_staging", state: "pending", attempts: 0 },
          { store: "snapshots", state: "pending", attempts: 0 },
        ],
      },
      null,
      2,
    );
    fs.writeFileSync(journalPath, raw, "utf8");
    const db = inaccessibleDb();

    await expect(runDesktopErasure(db, undefined)).rejects.toThrow(DIAGNOSTIC);
    await expect(resumeErasureIfNeeded(db)).rejects.toThrow(DIAGNOSTIC);

    expect(fs.readFileSync(journalPath, "utf8")).toBe(raw);
    expect(dbReads).toBe(0);
    expect(mocks.getDbPath).not.toHaveBeenCalled();
    expect(mocks.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(sagaDir, "erasure-snapshots"))).toBe(false);
    expect(warn).toHaveBeenCalledWith(DIAGNOSTIC);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("withdraw_consent"),
    );
  });
});

describe("desktop erasure status and snapshot capability", () => {
  function writeJournal(value: unknown): void {
    const sagaDir = path.join(mocks.userDataDir.value, "erasure");
    fs.mkdirSync(sagaDir, { recursive: true });
    fs.writeFileSync(
      path.join(sagaDir, "erasure-journal.json"),
      JSON.stringify(value, null, 2),
      "utf8",
    );
  }

  function baseJournal(): Record<string, unknown> {
    return {
      saga_id: "status-saga",
      state: "prepared",
      policy_version: "1.1",
      started_at: "2026-10-06T00:00:00.000Z",
      confirmation: {
        confirmed_at: "2026-10-05T23:59:00.000Z",
        scope: "delete_all",
      },
      rollback_window: { ttl_days: 7, key_source: "safeStorage" },
      stores: buildStorePlan("electron"),
    };
  }

  it("reports no active erasure without a journal", () => {
    expect(erasureStatus()).toMatchObject({
      active: false,
      available: false,
    });
  });

  it("reports an invalid journal as active but unavailable", () => {
    const sagaDir = path.join(mocks.userDataDir.value, "erasure");
    fs.mkdirSync(sagaDir, { recursive: true });
    fs.writeFileSync(
      path.join(sagaDir, "erasure-journal.json"),
      "{ not a journal",
      "utf8",
    );

    expect(erasureStatus()).toMatchObject({
      active: true,
      available: false,
      state: "invalid",
      stores: [],
    });
  });

  it("maps a valid journal's store progress for the UI", () => {
    writeJournal(baseJournal());

    const status = erasureStatus();
    expect(status.active).toBe(true);
    expect(status.available).toBe(false);
    expect(status.state).toBe("prepared");
    expect(status.stores?.length).toBeGreaterThan(0);
    expect(status.stores?.[0]).toMatchObject({
      store: expect.any(String),
      state: expect.any(String),
      attempts: expect.any(Number),
    });
  });

  it("returns a terminal committed journal on resume without resuming it", async () => {
    const journal = {
      ...baseJournal(),
      state: "committed",
      stores: buildStorePlan("electron").map((row) => ({
        ...row,
        state: "done" as const,
        attempts: 1,
      })),
    };
    writeJournal(journal);

    const result = await resumeErasureIfNeeded(inaccessibleDb());
    expect(result).toMatchObject({ resumed: false, journal });
    expect(result.receipt).toBeUndefined();
  });

  it("exposes a safeStorage snapshot capability that round-trips bytes", async () => {
    const capability = safeStorageSnapshotCapability();
    expect(capability.keySource).toBe("safeStorage");
    await expect(capability.canDecrypt()).resolves.toBe(true);

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const cipher = await capability.encrypt(bytes);
    await expect(capability.decrypt(cipher)).resolves.toEqual(bytes);

    mocks.safeStorage.isEncryptionAvailable.mockReturnValueOnce(false);
    await expect(capability.canDecrypt()).resolves.toBe(false);
  });

  it("counts remaining rows and treats an absent table as already clean", async () => {
    const db = {
      $client: {
        prepare: vi.fn((sql: string) => ({
          get: () => {
            if (sql.includes("customers")) return { c: 2 };
            if (sql.includes("quotes"))
              throw new Error("no such table: quotes");
            return { c: 0 };
          },
        })),
      },
    } as unknown as Parameters<typeof verifySqliteDomainTables>[0];

    await expect(verifySqliteDomainTables(db)).resolves.toEqual([
      "customers: 2 rows",
    ]);
  });

  it("rejects an invalid count result rather than reporting clean", async () => {
    const db = {
      $client: { prepare: () => ({ get: () => ({ c: -1 }) }) },
    } as unknown as Parameters<typeof verifySqliteDomainTables>[0];

    await expect(verifySqliteDomainTables(db)).rejects.toThrow(
      "SQLite domain table verification failed",
    );
  });
});
