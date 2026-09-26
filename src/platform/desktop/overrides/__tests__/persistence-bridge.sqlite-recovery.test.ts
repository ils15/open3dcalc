// @vitest-environment jsdom

import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isKeyAllowed } from "@/shared/lib/manifestGate";
import { closeDatabase, initDatabase } from "../../../../../db/database";
import { writeStoredRow } from "../../../../../electron/persistGate";
import type { ElectronAPI } from "@/platform/desktop/types/electron";
import { initPersistenceBridge } from "../persistence-bridge";

interface ManifestKey {
  key: string;
  surface: string;
  platforms: string[];
}

const manifestPath = path.resolve(
  import.meta.dirname,
  "../../../../../docs/privacy/SPEC-01-manifest-fixture.json",
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
  keys: ManifestKey[];
};
const ALLOWED_RENDERER_KEYS = manifest.keys
  .filter(
    ({ key, surface, platforms }) =>
      key.startsWith("open3dcalc_") &&
      surface === "localStorage" &&
      platforms.includes("electron"),
  )
  .map(({ key }) => key)
  .filter(isKeyAllowed)
  .sort();
const UNKNOWN_KEY = "open3dcalc_synthetic_unknown";
const FIRST_BRIDGE_KEY = "open3dcalc_settings_v2";
const FIXED_TIME = 1_700_000_123_456;

interface StorageSnapshot {
  key: string;
  valueBytes: string;
  updated_at: number;
}

function storageSnapshot(sqlite: Database.Database): StorageSnapshot[] {
  return (
    sqlite
      .prepare("SELECT key, value, updated_at FROM storage ORDER BY key")
      .all() as Array<{ key: string; value: string; updated_at: number }>
  ).map(({ key, value, updated_at }) => ({
    key,
    valueBytes: Buffer.from(value, "utf8").toString("hex"),
    updated_at,
  }));
}

function localStorageSnapshot(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key !== null) entries.push([key, localStorage.getItem(key)!]);
  }
  return entries.sort(([left], [right]) => left.localeCompare(right));
}

function expectedLocalStorage(): Map<string, string> {
  return new Map(
    ALLOWED_RENDERER_KEYS.map((key, index) => [
      key,
      JSON.stringify({
        key,
        recordId: `synthetic-${index + 1}`,
        fields: {
          label: `βeta row ${index + 1} 🧵`,
          count: index * 7 + 3,
          enabled: index % 2 === 0,
          nested: { raw: `literal-${index + 1}`, amount: 12.375 },
        },
      }),
    ]),
  );
}

describe("production Electron persistence bridge over on-disk SQLite", () => {
  let tmpDir: string;
  let dbPath: string;
  let sqlite: ReturnType<typeof initDatabase>;
  let source: Map<string, string>;
  let failureArmed: boolean;
  let failedOnce: boolean;
  let dbApi: ElectronAPI["db"];

  beforeEach(() => {
    closeDatabase();
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "open3dcalc-bridge-recovery-"),
    );
    dbPath = path.join(tmpDir, "synthetic.db");
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    localStorage.clear();
    source = expectedLocalStorage();
    for (const [key, value] of source) localStorage.setItem(key, value);
    localStorage.setItem(UNKNOWN_KEY, "must stay local only");

    sqlite = initDatabase(dbPath);
    // The shipped theme migration seeds this one valid row on a fresh DB.
    // It must not make the bridge mistake a partial/empty import for a fully
    // migrated localStorage source.
    failureArmed = true;
    failedOnce = false;
    const realBackend = makeSqliteBackend(sqlite.$client);
    dbApi = {
      ...realBackend,
      save: async (key, value) => {
        await realBackend.save(key, value);
        if (failureArmed && !failedOnce) {
          failedOnce = true;
          failureArmed = false;
          throw new Error("synthetic post-write bridge interruption");
        }
      },
    } as ElectronAPI["db"];
    setElectronDb(dbApi);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    closeDatabase();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails closed after one durable save, then recovers every source key on the same DB", async () => {
    expect(ALLOWED_RENDERER_KEYS.length).toBeGreaterThan(10);
    const sourcePreimage = localStorageSnapshot();
    const databasePreimage = storageSnapshot(sqlite.$client);
    const dbIdentity = fs.statSync(dbPath);
    expect(databasePreimage).toEqual([
      {
        key: "open3dcalc_theme",
        valueBytes: Buffer.from("system", "utf8").toString("hex"),
        updated_at: 0,
      },
    ]);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clearStorage = vi.spyOn(Storage.prototype, "clear");

    await expect(initPersistenceBridge()).rejects.toThrow(
      "synthetic post-write bridge interruption",
    );
    expect(failedOnce).toBe(true);
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.statSync(dbPath).ino).toBe(dbIdentity.ino);
    expect(localStorageSnapshot()).toEqual(sourcePreimage);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clearStorage).not.toHaveBeenCalled();
    const partial = storageSnapshot(sqlite.$client);
    expect(partial).toEqual([
      {
        key: "open3dcalc_settings_v2",
        valueBytes: Buffer.from(source.get(FIRST_BRIDGE_KEY)!, "utf8").toString(
          "hex",
        ),
        updated_at: FIXED_TIME,
      },
      {
        key: "open3dcalc_theme",
        valueBytes: Buffer.from("system", "utf8").toString("hex"),
        updated_at: 0,
      },
    ]);
    expect(partial).not.toEqual(databasePreimage);
    expect(sqlite.$client.pragma("integrity_check", { simple: true })).toBe(
      "ok",
    );
    expect(sqlite.$client.pragma("foreign_key_check")).toEqual([]);

    // Close all DB handles, retain the exact file and the untouched source,
    // then reopen the same physical database before retrying the bridge.
    closeDatabase();
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.statSync(dbPath).ino).toBe(dbIdentity.ino);
    sqlite = initDatabase(dbPath);
    const recoveredBackend = makeSqliteBackend(sqlite.$client);
    dbApi = recoveredBackend as ElectronAPI["db"];
    setElectronDb(dbApi);
    setItem.mockClear();

    await expect(initPersistenceBridge()).resolves.toBeUndefined();
    expect(localStorageSnapshot()).toEqual(sourcePreimage);
    const expectedRows = [...source.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({
        key,
        valueBytes: Buffer.from(value, "utf8").toString("hex"),
        updated_at: FIXED_TIME,
      }));
    const postimage = storageSnapshot(sqlite.$client);
    expect(postimage).toEqual(expectedRows);
    expect(postimage.map(({ key }) => key)).toEqual(ALLOWED_RENDERER_KEYS);
    expect(postimage.some(({ key }) => key === UNKNOWN_KEY)).toBe(false);
    expect(sqlite.$client.pragma("integrity_check", { simple: true })).toBe(
      "ok",
    );
    expect(sqlite.$client.pragma("foreign_key_check")).toEqual([]);

    closeDatabase();
    expect(fs.existsSync(dbPath)).toBe(true);
    sqlite = initDatabase(dbPath);
    dbApi = makeSqliteBackend(sqlite.$client) as ElectronAPI["db"];
    setElectronDb(dbApi);
    await expect(initPersistenceBridge()).resolves.toBeUndefined();
    expect(localStorageSnapshot()).toEqual(sourcePreimage);
    expect(storageSnapshot(sqlite.$client)).toEqual(postimage);
    expect(sqlite.$client.pragma("integrity_check", { simple: true })).toBe(
      "ok",
    );
    expect(sqlite.$client.pragma("foreign_key_check")).toEqual([]);
  });

  it("hydrates atomically when a SQLite read fails", async () => {
    failureArmed = false;
    await initPersistenceBridge();
    const sourcePreimage = localStorageSnapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockClear();
    vi.spyOn(dbApi, "load").mockRejectedValue(
      new Error("synthetic hydration read failure"),
    );

    await expect(initPersistenceBridge()).rejects.toThrow(
      "synthetic hydration read failure",
    );
    expect(localStorageSnapshot()).toEqual(sourcePreimage);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("flushes on close and periodically, prunes stale keys, and reports DB errors", async () => {
    failureArmed = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const save = vi.spyOn(dbApi, "save");
    await initPersistenceBridge();

    window.dispatchEvent(new Event("beforeunload"));
    expect(save).toHaveBeenCalledWith(
      FIRST_BRIDGE_KEY,
      source.get(FIRST_BRIDGE_KEY),
    );
    const closeFailure = new Error("synthetic close-time save failure");
    save.mockRejectedValueOnce(closeFailure);
    window.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(
      "[persistence-bridge] Failed to save localStorage to SQLite:",
      closeFailure,
    );

    const staleKey = "open3dcalc_synthetic_stale";
    writeStoredRow(sqlite.$client, staleKey, "synthetic stale value");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(
      sqlite.$client
        .prepare("SELECT key FROM storage WHERE key = ?")
        .get(staleKey),
    ).toBeUndefined();

    const cleanupFailure = new Error("synthetic stale-key cleanup failure");
    vi.spyOn(dbApi, "listKeys").mockRejectedValueOnce(cleanupFailure);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).toHaveBeenCalledWith(
      "[persistence-bridge] Failed to clean stale keys:",
      cleanupFailure,
    );

    const intervalFailure = new Error("synthetic periodic save failure");
    save.mockRejectedValueOnce(intervalFailure);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).toHaveBeenCalledWith(
      "[persistence-bridge] Failed to save localStorage to SQLite:",
      intervalFailure,
    );
    warn.mockRestore();
  });

  it("does not install persistence work outside Electron", async () => {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    const schedule = vi.spyOn(globalThis, "setInterval");

    await expect(initPersistenceBridge()).resolves.toBeUndefined();
    expect(schedule).not.toHaveBeenCalled();
    schedule.mockRestore();
  });

  it("dispatches the database warning after five consecutive startup failures", async () => {
    vi.resetModules();
    const freshBridge = await import("../persistence-bridge");
    const listener = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.addEventListener("open3dcalc:db-error", listener);
    vi.spyOn(dbApi, "listKeys").mockRejectedValue(
      new Error("synthetic repeated startup failure"),
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(freshBridge.initPersistenceBridge()).rejects.toThrow(
        "synthetic repeated startup failure",
      );
    }

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      detail: {
        message:
          "Database unavailable — data will not persist between sessions.",
      },
    });
    document.removeEventListener("open3dcalc:db-error", listener);
    warn.mockRestore();
  });
});

function makeSqliteBackend(sqlite: Database.Database) {
  return {
    async load(key: string): Promise<string | null> {
      const row = sqlite
        .prepare("SELECT value FROM storage WHERE key = ?")
        .get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    async save(key: string, value: string): Promise<void> {
      writeStoredRow(sqlite, key, value);
    },
    async delete(key: string): Promise<void> {
      sqlite.prepare("DELETE FROM storage WHERE key = ?").run(key);
    },
    async listKeys(): Promise<string[]> {
      return (
        sqlite.prepare("SELECT key FROM storage ORDER BY key").all() as Array<{
          key: string;
        }>
      ).map(({ key }) => key);
    },
  };
}

function setElectronDb(db: ElectronAPI["db"]): void {
  (
    window as unknown as { electronAPI: { db: ElectronAPI["db"] } }
  ).electronAPI = {
    db,
  };
}
