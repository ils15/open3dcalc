/** @vitest-environment node */

/**
 * Invocation-level wiring for `electron/main.ts`.
 *
 * The rest of the Electron suite drives the sub-modules directly (and asserts
 * some main.ts facts from source text). This suite instead loads the REAL
 * `main.ts` under a mocked `electron` shell, triggers `app.whenReady()`, and
 * invokes the handlers it registered. That is the only way to prove the wiring
 * itself: the passwordless route receives the profile withdrawal directory, the
 * erasure surface is registered fail-closed, and the diagnostic export cannot
 * escape its gate — none of which a source-text assertion can execute.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const h = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const appHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const state = {
    userData: "",
    initDatabaseThrows: false,
    browserWindowThrows: false,
    gateEnabled: false,
    saveDialog: { canceled: true } as { canceled: boolean; filePath?: string },
    createdWindows: [] as unknown[],
  };
  const windowHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onceHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const webContentsHandlers = new Map<
    string,
    (...args: unknown[]) => unknown
  >();
  const windowOpenHandler: { fn?: (details: { url: string }) => unknown } = {};
  return {
    handlers,
    appHandlers,
    state,
    windowHandlers,
    onceHandlers,
    webContentsHandlers,
    windowOpenHandler,
    passwordlessCalls: [] as unknown[][],
    storageCalls: [] as unknown[][],
    importCalls: [] as unknown[][],
    legacyCalls: [] as unknown[][],
  };
});

vi.mock("electron", () => {
  class FakeBrowserWindow {
    static all: FakeBrowserWindow[] = [];
    webContents = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
        h.webContentsHandlers.set(event, cb);
      }),
      setWindowOpenHandler: vi.fn(
        (cb: (details: { url: string }) => unknown) => {
          h.windowOpenHandler.fn = cb;
        },
      ),
      openDevTools: vi.fn(),
    };
    loadURL = vi.fn(async () => undefined);
    loadFile = vi.fn(async () => undefined);
    on = vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
      h.windowHandlers.set(event, cb);
    });
    once = vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
      h.onceHandlers.set(event, cb);
    });
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
      if (h.state.browserWindowThrows) {
        throw new Error("synthetic window creation failure");
      }
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
      on: vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
        h.appHandlers.set(event, cb);
      }),
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
  };
});

vi.mock("../../db/database.js", () => ({
  initDatabase: vi.fn(() => {
    if (h.state.initDatabaseThrows) {
      throw new Error("synthetic database failure");
    }
    return { $client: { pragma: vi.fn() } };
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

vi.mock("../cryptoCapability.js", () => ({
  getCapability: vi.fn(() => ({ available: false, reason: "synthetic" })),
  adoptSessionPassphrase: vi.fn(),
  lockCryptoSession: vi.fn(),
}));

vi.mock("../databaseIpc.js", () => ({
  registerDatabaseStorageHandlers: (...args: unknown[]) => {
    h.storageCalls.push(args);
  },
  registerDisabledDatabaseImportHandler: (...args: unknown[]) => {
    h.importCalls.push(args);
  },
}));

vi.mock("../newPiiIpc.js", () => ({
  registerPasswordlessPiiHandlers: (...args: unknown[]) => {
    h.passwordlessCalls.push(args);
  },
}));

vi.mock("../disabledLegacyPrivacyIpc.js", () => ({
  registerDisabledLegacyPrivacyHandlers: (...args: unknown[]) => {
    h.legacyCalls.push(args);
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

describe("electron main process wiring", () => {
  let uncaughtListener: ((...args: unknown[]) => unknown) | undefined;
  let rejectionListener: ((...args: unknown[]) => unknown) | undefined;

  beforeAll(async () => {
    h.state.userData = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-main-"));
    // Seed a saved (maximized) window state so the load/maximize branches run.
    fs.writeFileSync(
      path.join(h.state.userData, "window-state.json"),
      JSON.stringify({ width: 900, height: 700, isMaximized: true }),
      "utf8",
    );
    const beforeUncaught = new Set(process.listeners("uncaughtException"));
    const beforeRejection = new Set(process.listeners("unhandledRejection"));

    await import("../main.js");
    await vi.waitFor(() => expect(h.handlers.size).toBeGreaterThan(0));
    // createWindow() runs after setupIpcHandlers(); wait for the window so
    // handlers that require an active window (db:export) are exercised for real.
    await vi.waitFor(() =>
      expect(h.state.createdWindows.length).toBeGreaterThan(0),
    );

    uncaughtListener = process
      .listeners("uncaughtException")
      .find((l) => !beforeUncaught.has(l));
    rejectionListener = process
      .listeners("unhandledRejection")
      .find((l) => !beforeRejection.has(l));
  });

  afterAll(() => {
    fs.rmSync(h.state.userData, { recursive: true, force: true });
  });

  it("wires the passwordless route to the profile withdrawal directory", () => {
    expect(h.passwordlessCalls).toEqual([
      [
        expect.anything(),
        expect.anything(),
        expect.any(Function),
        h.state.userData,
      ],
    ]);
  });

  it("registers the closed storage, import, and legacy surfaces", () => {
    expect(h.storageCalls).toEqual([
      [expect.anything(), expect.anything(), expect.any(Function)],
    ]);
    expect(h.importCalls).toEqual([[expect.anything(), expect.any(Function)]]);
    expect(h.legacyCalls).toEqual([[expect.anything()]]);
  });

  it("registers the whole erasure surface fail-closed", () => {
    expect([...h.handlers.keys()]).toEqual(
      expect.arrayContaining([
        "db:export",
        "erasure:authorize",
        "erasure:claim",
        "erasure:start",
        "erasure:status",
        "crypto:capability",
        "crypto:set-passphrase",
        "crypto:lock",
        "update:check",
        "update:download",
        "update:install",
        "update:get-status",
        "update:skip",
      ]),
    );
  });

  it("rejects an untrusted sender before erasure or export work", async () => {
    await expect(invoke("erasure:authorize", UNTRUSTED)).rejects.toThrow(
      /Untrusted IPC sender/,
    );
    await expect(invoke("db:export", UNTRUSTED)).rejects.toThrow(
      /Untrusted IPC sender/,
    );
    // The status/crypto handlers wrap the assertion in try/catch and rethrow.
    for (const channel of [
      "erasure:status",
      "crypto:capability",
      "crypto:lock",
    ]) {
      await expect(invoke(channel, UNTRUSTED)).rejects.toThrow(
        /Untrusted IPC sender/,
      );
    }
  });

  it("hardens the window: blocks navigation and denies popups", async () => {
    const { shell } = (await import("electron")) as unknown as {
      shell: { openExternal: ReturnType<typeof vi.fn> };
    };

    const preventDefault = vi.fn();
    h.webContentsHandlers.get("will-navigate")?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();

    const external = h.windowOpenHandler.fn?.({
      url: "https://example.test/x",
    });
    expect(shell.openExternal).toHaveBeenCalledWith("https://example.test/x");
    expect(external).toEqual({ action: "deny" });

    const internal = h.windowOpenHandler.fn?.({
      url: "file:///app/index.html",
    });
    expect(internal).toEqual({ action: "deny" });
  });

  it("persists window state on resize/move/close and shows on ready", async () => {
    h.windowHandlers.get("resize")?.();
    h.windowHandlers.get("move")?.();
    h.windowHandlers.get("close")?.();
    h.onceHandlers.get("ready-to-show")?.();

    const statePath = path.join(h.state.userData, "window-state.json");
    await vi.waitFor(() => {
      const saved = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
        width: number;
      };
      expect(saved.width).toBe(800);
    });
  });

  it("recreates the window on activate when none remain", async () => {
    const { BrowserWindow } = (await import("electron")) as unknown as {
      BrowserWindow: { all: unknown[] };
    };
    BrowserWindow.all.length = 0;

    h.appHandlers.get("activate")?.();

    await vi.waitFor(() => expect(BrowserWindow.all.length).toBe(1));
  });

  it("reports delete-all unavailable without dereferencing the database", async () => {
    await expect(invoke("erasure:status", TRUSTED)).resolves.toMatchObject({
      active: false,
      available: false,
    });
    await expect(invoke("erasure:authorize", TRUSTED)).rejects.toThrow(
      /delete-all is unavailable/i,
    );
    await expect(
      invoke("erasure:claim", TRUSTED, "synthetic-token"),
    ).rejects.toThrow(/delete-all is unavailable/i);
    await expect(
      invoke("erasure:start", TRUSTED, "synthetic-token", {}),
    ).rejects.toThrow(/delete-all is unavailable/i);
  });

  it("keeps diagnostic export behind the gate and the erasure lock", async () => {
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

  it("validates update and crypto inputs before delegating", async () => {
    const update = await import("../update.js");
    const crypto = await import("../cryptoCapability.js");

    await expect(invoke("update:skip", TRUSTED, "   ")).rejects.toThrow(
      /non-empty string/,
    );
    await invoke("update:skip", TRUSTED, "2.0.0");
    expect(update.skipVersion).toHaveBeenCalledWith("2.0.0");

    await expect(invoke("crypto:set-passphrase", TRUSTED, "")).rejects.toThrow(
      /non-empty string/,
    );
    await invoke("crypto:set-passphrase", TRUSTED, "synthetic-pass");
    expect(crypto.adoptSessionPassphrase).toHaveBeenCalledWith(
      "synthetic-pass",
    );

    await invoke("crypto:lock", TRUSTED);
    expect(crypto.lockCryptoSession).toHaveBeenCalled();

    await expect(invoke("crypto:capability", TRUSTED)).resolves.toEqual({
      available: false,
      reason: "synthetic",
    });
    await expect(invoke("update:check")).resolves.toEqual({
      available: false,
    });
    await expect(invoke("update:download")).resolves.toBeUndefined();
    await invoke("update:install");
    expect(update.installUpdate).toHaveBeenCalled();
    await expect(invoke("update:get-status")).resolves.toEqual({
      status: "idle",
    });
  });

  it("zeroizes the session passphrase on quit and on app lifecycle events", async () => {
    const crypto = await import("../cryptoCapability.js");
    const { app } = await import("electron");
    h.appHandlers.get("before-quit")?.();
    expect(crypto.lockCryptoSession).toHaveBeenCalled();

    h.appHandlers.get("window-all-closed")?.();
    expect(app.quit).toHaveBeenCalled();
  });

  it("restores and focuses the window on a second instance", () => {
    const win = h.state.createdWindows.at(-1) as {
      restore: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
    };
    h.appHandlers.get("second-instance")?.();
    expect(win.restore).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
  });

  it("reports unexpected process errors through the dialog and exits", async () => {
    const { dialog, app } = (await import("electron")) as unknown as {
      dialog: { showErrorBox: ReturnType<typeof vi.fn> };
      app: { exit: ReturnType<typeof vi.fn> };
    };
    expect(uncaughtListener).toBeTypeOf("function");
    uncaughtListener?.(new Error("synthetic crash"));
    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Unexpected Error",
      expect.stringContaining("synthetic crash"),
    );
    expect(app.exit).toHaveBeenCalledWith(1);

    rejectionListener?.("synthetic rejection");
    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Unhandled Error",
      expect.stringContaining("synthetic rejection"),
    );
  });

  it("exports a redacted diagnostic backup and stringifies non-Error faults", async () => {
    const { dialog } = (await import("electron")) as unknown as {
      dialog: { showErrorBox: ReturnType<typeof vi.fn> };
    };

    h.state.gateEnabled = true;
    h.state.saveDialog = {
      canceled: false,
      filePath: "/synthetic/redacted.sqlite3",
    };
    await expect(invoke("db:export", TRUSTED, { redact: true })).resolves.toBe(
      "/synthetic/redacted.sqlite3",
    );

    // A non-Error uncaught value falls back to String().
    uncaughtListener?.("plain uncaught failure");
    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Unexpected Error",
      expect.stringContaining("plain uncaught failure"),
    );

    // An Error rejection uses its message rather than String(error).
    rejectionListener?.(new Error("error-shaped rejection"));
    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Unhandled Error",
      expect.stringContaining("error-shaped rejection"),
    );
  });
});
