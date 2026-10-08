/** @vitest-environment node */

/**
 * Invocation-level ordinary-startup PII safety for `electron/main.ts`.
 *
 * This suite loads the REAL `main.ts` under a mocked Electron shell and drives
 * the handlers it registers, so every assertion is about executed behaviour
 * rather than source text. It replaces the previous `readFileSync` + `slice` +
 * `toContain` assertions, which pinned line layout (and could keep passing
 * while the wiring was broken) instead of proving the guarantee.
 *
 * The guarantees kept: authorize/claim/start stay unavailable, the diagnostic
 * export sits behind both its explicit gate and the erasure lock, the legacy
 * inspection/recovery routes are registered only as explicit refusals, and the
 * startup resume defers without dereferencing the database. The SQLite
 * migration-preservation check at the bottom stays a direct byte assertion.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const state = {
    userData: "",
    gateEnabled: false,
    saveDialog: { canceled: true } as { canceled: boolean; filePath?: string },
    createdWindows: [] as unknown[],
    storageRegistrations: [] as unknown[][],
    importRegistrations: [] as unknown[][],
    passwordlessRegistrations: [] as unknown[][],
  };
  return { handlers, state };
});

vi.mock("electron", () => {
  class FakeBrowserWindow {
    static all: FakeBrowserWindow[] = [];
    webContents = {
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      openDevTools: vi.fn(),
    };
    loadURL = vi.fn(async () => undefined);
    loadFile = vi.fn(async () => undefined);
    on = vi.fn();
    once = vi.fn();
    show = vi.fn();
    maximize = vi.fn();
    isMaximized = vi.fn(() => false);
    getBounds = vi.fn(() => ({ x: 1, y: 2, width: 800, height: 600 }));
    isMinimized = vi.fn(() => true);
    restore = vi.fn();
    focus = vi.fn();
    static getAllWindows(): FakeBrowserWindow[] {
      return FakeBrowserWindow.all;
    }
    constructor() {
      FakeBrowserWindow.all.push(this);
      h.state.createdWindows.push(this);
    }
  }
  return {
    app: {
      getPath: (name: string): string => {
        if (name === "userData") return h.state.userData;
        throw new Error(`unexpected path: ${name}`);
      },
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn(),
      exit: vi.fn(),
      requestSingleInstanceLock: vi.fn(() => true),
    },
    BrowserWindow: FakeBrowserWindow,
    dialog: {
      showErrorBox: vi.fn(),
      showSaveDialog: vi.fn(async () => h.state.saveDialog),
    },
    ipcMain: {
      handle: vi.fn((channel: string, cb: (...args: unknown[]) => unknown) => {
        h.handlers.set(channel, cb);
      }),
    },
    Menu: { setApplicationMenu: vi.fn() },
    shell: { openExternal: vi.fn() },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false),
      encryptString: vi.fn((value: string) => Buffer.from(value)),
      decryptString: vi.fn((value: Buffer) => value.toString()),
    },
  };
});

// Keep the real `runMigrations` for the preservation check below; only replace
// the two entry points main.ts uses so no live SQLite file is opened.
vi.mock("../../db/database.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/database.js")>();
  return {
    ...actual,
    initDatabase: vi.fn(() => ({ $client: { pragma: vi.fn() } })),
    getDbPath: vi.fn(() => "/synthetic/open3dcalc.db"),
  };
});

vi.mock("../update.js", () => ({
  initUpdateService: vi.fn(),
  checkForUpdates: vi.fn(async () => ({ available: false })),
  downloadUpdate: vi.fn(async () => undefined),
  installUpdate: vi.fn(),
  skipVersion: vi.fn(),
  getUpdateStatus: vi.fn(() => ({ status: "idle" })),
}));

vi.mock("../cryptoCapability.js", () => ({
  getCapability: vi.fn(() => ({ available: false, reason: "synthetic" })),
  adoptSessionPassphrase: vi.fn(),
  lockCryptoSession: vi.fn(),
}));

vi.mock("../databaseIpc.js", () => ({
  registerDatabaseStorageHandlers: (...args: unknown[]) => {
    h.state.storageRegistrations.push(args);
  },
  registerDisabledDatabaseImportHandler: (...args: unknown[]) => {
    h.state.importRegistrations.push(args);
  },
}));

vi.mock("../newPiiIpc.js", () => ({
  registerPasswordlessPiiHandlers: (...args: unknown[]) => {
    h.state.passwordlessRegistrations.push(args);
  },
}));

vi.mock("../diagnosticBackup.js", () => ({
  createDiagnosticBackup: vi.fn(async (options: { targetPath: string }) => ({
    targetPath: options.targetPath,
  })),
  DiagnosticGateError: class DiagnosticGateError extends Error {
    constructor() {
      super("diagnostic gate disabled");
      this.name = "DiagnosticGateError";
    }
  },
}));

vi.mock("../diagnosticGate.js", () => ({
  isDiagnosticGateEnabled: vi.fn(() => h.state.gateEnabled),
}));

import { runMigrations } from "../../db/database.js";
import {
  DISABLED_LEGACY_PRIVACY_CHANNELS,
  registerDisabledLegacyPrivacyHandlers,
} from "../disabledLegacyPrivacyIpc.js";
import { resumeErasureIfNeeded } from "../erasure.js";

const TRUSTED = { senderFrame: { url: "file:///app/index.html" } };
const UNTRUSTED = { senderFrame: null };

function handler(channel: string): (...args: unknown[]) => unknown {
  const found = h.handlers.get(channel);
  if (!found) throw new Error(`handler not registered: ${channel}`);
  return found;
}

/** Normalise a sync throw or a returned value into a promise. */
function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return Promise.resolve().then(() => handler(channel)(...args));
}

describe("ordinary Electron startup PII access", () => {
  beforeAll(async () => {
    h.state.userData = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-startup-"));
    await import("../main.js");
    await vi.waitFor(() => expect(h.handlers.size).toBeGreaterThan(0));
    // createWindow() runs after setupIpcHandlers(); wait for the window so
    // handlers that require an active window (db:export) are exercised.
    await vi.waitFor(() =>
      expect(h.state.createdWindows.length).toBeGreaterThan(0),
    );
  });

  afterAll(() => {
    fs.rmSync(h.state.userData, { recursive: true, force: true });
  });

  it("refuses authorize/claim/start while delete-all is unavailable", async () => {
    for (const channel of [
      "erasure:authorize",
      "erasure:claim",
      "erasure:start",
      "erasure:status",
    ]) {
      expect(h.handlers.has(channel), channel).toBe(true);
    }

    await expect(invoke("erasure:authorize", TRUSTED)).rejects.toThrow(
      /delete-all is unavailable/i,
    );
    await expect(
      invoke("erasure:claim", TRUSTED, "synthetic-token"),
    ).rejects.toThrow(/delete-all is unavailable/i);
    await expect(
      invoke("erasure:start", TRUSTED, "synthetic-token", {}),
    ).rejects.toThrow(/delete-all is unavailable/i);
    await expect(invoke("erasure:status", TRUSTED)).resolves.toMatchObject({
      active: false,
      available: false,
    });
  });

  it("rejects an untrusted sender before erasure or export work", async () => {
    await expect(invoke("erasure:authorize", UNTRUSTED)).rejects.toThrow(
      /Untrusted IPC sender/,
    );
    await expect(invoke("db:export", UNTRUSTED)).rejects.toThrow(
      /Untrusted IPC sender/,
    );
  });

  it("keeps diagnostic PII export behind both its explicit gate and the erasure lock", async () => {
    h.state.gateEnabled = false;
    await expect(invoke("db:export", TRUSTED)).rejects.toThrow(
      /diagnostic gate disabled/,
    );

    h.state.gateEnabled = true;
    h.state.saveDialog = { canceled: true };
    await expect(invoke("db:export", TRUSTED)).rejects.toThrow(
      /Export cancelled/,
    );

    // An invalid journal is a lock, not a grant: the export refuses first.
    const erasureDir = path.join(h.state.userData, "erasure");
    fs.mkdirSync(erasureDir, { recursive: true });
    const journalPath = path.join(erasureDir, "erasure-journal.json");
    fs.writeFileSync(journalPath, "{ not a valid journal", "utf8");
    await expect(invoke("db:export", TRUSTED)).rejects.toThrow(
      /deletion is pending or invalid/i,
    );
    fs.rmSync(journalPath, { force: true });

    h.state.saveDialog = {
      canceled: false,
      filePath: "/synthetic/backup.sqlite3",
    };
    await expect(invoke("db:export", TRUSTED)).resolves.toBe(
      "/synthetic/backup.sqlite3",
    );
  });

  it("registers closed storage/import surfaces and no live legacy route", async () => {
    expect(h.state.storageRegistrations).toHaveLength(1);
    expect(h.state.importRegistrations).toHaveLength(1);
    expect(h.state.passwordlessRegistrations).toHaveLength(1);

    // Every obsolete channel is registered — but only as an explicit refusal.
    for (const channel of DISABLED_LEGACY_PRIVACY_CHANNELS) {
      expect(h.handlers.has(channel), channel).toBe(true);
      await expect(invoke(channel)).rejects.toThrow(
        `${channel} is disabled: legacy PII access is paused`,
      );
    }
    // The recovery/migration channels can never return legacy PII.
    await expect(invoke("privacy:recovery-report")).rejects.toThrow(/disabled/);
    await expect(invoke("privacy:recover-key")).rejects.toThrow(/disabled/);
  });

  it("defers startup resume without dereferencing the database", async () => {
    let dbReads = 0;
    const inaccessibleDb = new Proxy(
      {},
      {
        get() {
          dbReads++;
          throw new Error("DB must not be dereferenced during preflight");
        },
      },
    ) as Parameters<typeof resumeErasureIfNeeded>[0];

    await expect(resumeErasureIfNeeded(inaccessibleDb)).resolves.toEqual({
      resumed: false,
    });
    expect(dbReads).toBe(0);
  });

  it("rejects obsolete legacy-PII IPC calls explicitly without a database capability", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn(
        (channel: string, listener: (...args: unknown[]) => unknown) => {
          handlers.set(channel, listener);
        },
      ),
    };

    registerDisabledLegacyPrivacyHandlers(ipcMain as never);

    expect([...handlers.keys()]).toEqual([...DISABLED_LEGACY_PRIVACY_CHANNELS]);
    expect(ipcMain.handle).toHaveBeenCalledTimes(
      DISABLED_LEGACY_PRIVACY_CHANNELS.length,
    );
    for (const [channel, handler] of handlers) {
      await expect(Promise.resolve().then(() => handler({}))).rejects.toThrow(
        `${channel} is disabled: legacy PII access is paused`,
      );
    }
  });
});

describe("SQLite startup migrations preserve legacy PII", () => {
  it("keeps legacy storage bytes and existing non-PII data across schema migration", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-wave1a-"));
    const db = new Database(path.join(directory, "profile.sqlite3"));
    const oldMigrationsDir = path.join(directory, "old-migrations");
    fs.mkdirSync(oldMigrationsDir);
    const migrationSourceDir = fileURLToPath(
      new URL("../../db/migrations/", import.meta.url),
    );
    for (const file of [
      "0000_initial.sql",
      "0001_add_theme.sql",
      "0002_products.sql",
    ]) {
      fs.copyFileSync(
        path.join(migrationSourceDir, file),
        path.join(oldMigrationsDir, file),
      );
    }
    const legacyValue = '{"customers":[{"name":"Legacy PII 🧪"}]}';

    try {
      // Model a Beta database with the original schema and existing records;
      // the current startup then applies only the later schema migrations.
      runMigrations(db, oldMigrationsDir);
      db.prepare(
        "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)",
      ).run("open3dcalc_customers_v1", legacyValue, 123);
      db.prepare(
        "INSERT INTO customers (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      ).run("customer-1", "Legacy Customer", "legacy@example.test", 5, 6);
      db.prepare(
        "INSERT INTO history_entries (id, timestamp, type, name, result_json) VALUES (?, ?, ?, ?, ?)",
      ).run("history-1", 7, "fdm", "Legacy Quote", legacyValue);
      db.prepare(
        "UPDATE storage SET value = ?, updated_at = ? WHERE key = ?",
      ).run("user-selected-theme", 456, "open3dcalc_theme");
      db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(
        "units",
        "metric",
      );
      db.prepare(
        "INSERT INTO products (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ).run("product-1", "PLA spool", 12, 34);

      runMigrations(db);

      expect(
        db
          .prepare("SELECT value, updated_at FROM storage WHERE key = ?")
          .get("open3dcalc_customers_v1"),
      ).toEqual({ value: legacyValue, updated_at: 123 });
      expect(
        db
          .prepare(
            "SELECT id, name, email, created_at, updated_at FROM customers WHERE id = ?",
          )
          .get("customer-1"),
      ).toEqual({
        id: "customer-1",
        name: "Legacy Customer",
        email: "legacy@example.test",
        created_at: 5,
        updated_at: 6,
      });
      expect(
        db
          .prepare(
            "SELECT id, name, result_json FROM history_entries WHERE id = ?",
          )
          .get("history-1"),
      ).toEqual({
        id: "history-1",
        name: "Legacy Quote",
        result_json: legacyValue,
      });
      expect(
        db
          .prepare("SELECT value, updated_at FROM storage WHERE key = ?")
          .get("open3dcalc_theme"),
      ).toEqual({ value: "user-selected-theme", updated_at: 456 });
      expect(
        db.prepare("SELECT value FROM app_settings WHERE key = ?").get("units"),
      ).toEqual({ value: "metric" });
      expect(
        db
          .prepare(
            "SELECT name, created_at, updated_at FROM products WHERE id = ?",
          )
          .get("product-1"),
      ).toEqual({ name: "PLA spool", created_at: 12, updated_at: 34 });
    } finally {
      db.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
