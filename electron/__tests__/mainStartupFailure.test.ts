/** @vitest-environment node */

/**
 * `electron/main.ts` startup failure path.
 *
 * Kept in its own file (not a second `describe` in mainWiring.test.ts) so the
 * module registry is never reset mid-run: `vi.resetModules()` would hand the
 * wiring assertions in the sibling suite a fresh set of mock instances.
 *
 * Both failure branches are driven in one import: `initDatabase()` throws (the
 * inner catch that keeps registering handlers) and the window constructor
 * throws (the outer startup catch that reports and quits).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const h = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const state = { userData: "" };
  return { handlers, state };
});

vi.mock("electron", () => {
  class FakeBrowserWindow {
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
    static getAllWindows(): never[] {
      return [];
    }
    constructor() {
      throw new Error("synthetic window creation failure");
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
    dialog: { showErrorBox: vi.fn(), showSaveDialog: vi.fn() },
    ipcMain: {
      handle: vi.fn((channel: string, cb: (...args: unknown[]) => unknown) => {
        h.handlers.set(channel, cb);
      }),
    },
    Menu: { setApplicationMenu: vi.fn() },
    shell: { openExternal: vi.fn() },
  };
});

vi.mock("../../db/database.js", () => ({
  initDatabase: vi.fn(() => {
    throw new Error("synthetic database failure");
  }),
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

vi.mock("../disabledLegacyPrivacyIpc.js", () => ({
  registerDisabledLegacyPrivacyHandlers: vi.fn(),
}));

vi.mock("../diagnosticBackup.js", () => ({
  createDiagnosticBackup: vi.fn(),
  DiagnosticGateError: class DiagnosticGateError extends Error {},
}));

vi.mock("../diagnosticGate.js", () => ({
  isDiagnosticGateEnabled: vi.fn(() => false),
}));

describe("electron main startup failure", () => {
  beforeAll(async () => {
    h.state.userData = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-main-"));
    const { dialog, app } = await import("electron");
    await import("../main.js");
    await vi.waitFor(() =>
      expect(dialog.showErrorBox).toHaveBeenCalledWith(
        "Startup Error",
        expect.any(String),
      ),
    );
    expect(app.quit).toHaveBeenCalled();
  });

  afterAll(() => {
    fs.rmSync(h.state.userData, { recursive: true, force: true });
  });

  it("still registers the closed surfaces when the database cannot initialize", () => {
    // The inner catch keeps going with a null-shaped db rather than aborting;
    // the closed surfaces are registered all the same.
    expect(h.handlers.has("db:export")).toBe(true);
    expect(h.handlers.has("erasure:status")).toBe(true);
  });
});
