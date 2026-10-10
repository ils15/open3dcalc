/** @vitest-environment node */

/**
 * `electron/main.ts` development wiring.
 *
 * Kept in its own file because `isDev` is read once at module load: this suite
 * sets `NODE_ENV=development` only around the import, then restores it, so the
 * dev-only branches (dev-server load, DevTools, the localhost trust rule, the
 * retained application menu) are executed for real without leaking the mode to
 * sibling suites. The single-instance refusal is exercised here too.
 *
 * Assertions read `h.state` (populated inside the mock) rather than a mock's
 * `.mock.calls`, which is not stable across the file's hooks.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const h = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const state = {
    userData: "",
    createdWindows: [] as Array<{
      loadUrl: string[];
      loadFile: string[];
      openDevTools: number;
    }>,
    menuSetCalls: 0,
    quitCalls: 0,
  };
  return { handlers, state };
});

vi.mock("electron", () => {
  class FakeBrowserWindow {
    static all: FakeBrowserWindow[] = [];
    webContents = {
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      openDevTools: vi.fn(() => {
        const record = h.state.createdWindows.at(-1);
        if (record) record.openDevTools++;
      }),
    };
    loadURL = vi.fn(async (url: string) => {
      const record = h.state.createdWindows.at(-1);
      if (record) record.loadUrl.push(url);
    });
    loadFile = vi.fn(async (file: string) => {
      const record = h.state.createdWindows.at(-1);
      if (record) record.loadFile.push(file);
    });
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
      h.state.createdWindows.push({
        loadUrl: [],
        loadFile: [],
        openDevTools: 0,
      });
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
      quit: vi.fn(() => {
        h.state.quitCalls++;
      }),
      exit: vi.fn(),
      // No single-instance lock: the refusal branch must run.
      requestSingleInstanceLock: vi.fn(() => false),
    },
    BrowserWindow: FakeBrowserWindow,
    dialog: { showErrorBox: vi.fn(), showSaveDialog: vi.fn() },
    ipcMain: {
      handle: vi.fn((channel: string, cb: (...args: unknown[]) => unknown) => {
        h.handlers.set(channel, cb);
      }),
    },
    Menu: {
      setApplicationMenu: vi.fn(() => {
        h.state.menuSetCalls++;
      }),
    },
    shell: { openExternal: vi.fn() },
  };
});

vi.mock("../../db/database.js", () => ({
  initDatabase: vi.fn(() => ({ $client: { pragma: vi.fn() } })),
  getDbPath: vi.fn(() => "/synthetic/open3dcalc.db"),
}));

vi.mock("../update.js", () => ({
  initUpdateService: vi.fn(),
  checkForUpdates: vi.fn(async () => ({ available: false })),
  downloadUpdate: vi.fn(async () => undefined),
  installUpdate: vi.fn(),
  skipVersion: vi.fn(),
  getUpdateStatus: vi.fn(() => ({ status: "idle" })),
}));

vi.mock("../databaseIpc.js", () => ({
  registerDatabaseStorageHandlers: vi.fn(),
  registerDisabledDatabaseImportHandler: vi.fn(),
}));

vi.mock("../newPiiIpc.js", () => ({
  registerPasswordlessPiiHandlers: vi.fn(),
}));

vi.mock("../diagnosticBackup.js", () => ({
  createDiagnosticBackup: vi.fn(),
  DiagnosticGateError: class DiagnosticGateError extends Error {},
}));

vi.mock("../diagnosticGate.js", () => ({
  isDiagnosticGateEnabled: vi.fn(() => false),
}));

const TRUSTED_DEV = { senderFrame: { url: "http://localhost:3000" } };

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = h.handlers.get(channel);
  if (!handler) throw new Error(`handler not registered: ${channel}`);
  return Promise.resolve().then(() => handler(...args));
}

describe("electron main development wiring", () => {
  beforeAll(async () => {
    h.state.userData = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-dev-"));
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      await import("../main.js");
    } finally {
      process.env.NODE_ENV = previous;
    }
    await vi.waitFor(() => expect(h.handlers.size).toBeGreaterThan(0));
    await vi.waitFor(() =>
      expect(h.state.createdWindows.length).toBeGreaterThan(0),
    );
  });

  afterAll(() => {
    fs.rmSync(h.state.userData, { recursive: true, force: true });
  });

  it("loads the dev server, opens DevTools, and keeps the application menu", () => {
    const win = h.state.createdWindows[0];
    expect(win.loadUrl).toEqual(["http://localhost:5173"]);
    expect(win.loadFile).toEqual([]);
    expect(win.openDevTools).toBeGreaterThan(0);
    expect(h.state.menuSetCalls).toBe(0);
  });

  it("trusts a localhost dev renderer and rejects a file:// frame", async () => {
    await expect(invoke("erasure:status", TRUSTED_DEV)).resolves.toMatchObject({
      available: false,
    });
    await expect(
      invoke("erasure:status", {
        senderFrame: { url: "file:///app/index.html" },
      }),
    ).rejects.toThrow(/Untrusted IPC sender/);
  });

  it("quits when the single-instance lock is unavailable", () => {
    expect(h.state.quitCalls).toBeGreaterThan(0);
  });
});
