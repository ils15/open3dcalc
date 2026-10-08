/** @vitest-environment node */

/**
 * Beta Electron gating (Wave 3 remainder).
 *
 * Beta is a Web-only channel: while `VITE_BETA_CHANNEL=true`, the Electron
 * main process must expose no PII privacy surface. Every PII channel refuses
 * fail-closed per call — PII crypto, consent (via the excluded storage key),
 * erasure (legacy + exact new-namespace + withdrawal) and migration — while
 * non-PII infrastructure (closed non-PII storage, updater, window) keeps
 * working. No Beta change adds a PII IPC channel.
 *
 * This suite drives the REAL `main.ts` under a mocked Electron shell (the same
 * technique as `mainWiring.test.ts`), so the Beta refusals asserted here are
 * executed behaviour, not source text. The preload bridge cannot be loaded by
 * the Vitest toolchain (see `preloadContract.test.ts`), so its half is pinned
 * by source parity: same exact-`"true"` predicate, one gated call per PII
 * method, non-PII methods ungated.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Beta for the whole file: set before `main.js` is imported in `beforeAll`.
// Vitest isolates files, so no other suite observes this.
process.env.VITE_BETA_CHANNEL = "true";

const h = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const appHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const state = {
    userData: "",
    createdWindows: [] as unknown[],
  };
  return { handlers, appHandlers, state };
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
      showSaveDialog: vi.fn(async () => ({ canceled: true })),
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

vi.mock("../../db/database.js", () => {
  const rows = new Map<string, string>([
    ["open3dcalc_settings_v2", '{"units":"metric"}'],
    ["open3dcalc_catalog_v1", '{"catalog":"sentinel"}'],
    ["open3dcalc_consent_v1", '{"consent":"sentinel"}'],
  ]);
  const fakeClient = {
    pragma: vi.fn(),
    prepare(sql: string) {
      return {
        get(...params: unknown[]) {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          if (sql.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          } else if (sql.includes("DELETE FROM storage")) {
            rows.delete(String(params[0]));
          }
          return undefined;
        },
        all(...params: unknown[]) {
          void params;
          return [...rows.keys()].sort().map((key) => ({ key }));
        },
      };
    },
  };
  return {
    initDatabase: vi.fn(() => ({ $client: fakeClient })),
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

import {
  BETA_ELECTRON_PII_REFUSAL,
  BETA_EXCLUDED_STORAGE_KEYS,
  betaElectronPiiRefusal,
  isBetaElectronRuntime,
} from "../betaRuntime.js";
import { resumeErasureIfNeeded } from "../erasure.js";

const TRUSTED = { senderFrame: { url: "file:///app/index.html" } };

function handler(channel: string): (...args: unknown[]) => unknown {
  const found = h.handlers.get(channel);
  if (!found) throw new Error(`handler not registered: ${channel}`);
  return found;
}

/** Normalise a sync throw or a returned value into a promise. */
function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return Promise.resolve().then(() => handler(channel)(...args));
}

/** Remove block and line comments so prose cannot be mistaken for code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("betaRuntime helper", () => {
  it("refuses with a stable error naming the channel and the Beta reason", () => {
    const error = betaElectronPiiRefusal("crypto:capability");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("crypto:capability");
    expect(error.message).toContain(BETA_ELECTRON_PII_REFUSAL);
    expect(BETA_ELECTRON_PII_REFUSAL).toMatch(/Web-only/);
  });

  it("withholds exactly the consent row from generic storage on Beta", () => {
    expect([...BETA_EXCLUDED_STORAGE_KEYS]).toEqual(["open3dcalc_consent_v1"]);
  });

  it("stays an exact-true flag (no truthy widening)", () => {
    expect(isBetaElectronRuntime({ VITE_BETA_CHANNEL: "true" })).toBe(true);
    expect(isBetaElectronRuntime({ VITE_BETA_CHANNEL: "TRUE" })).toBe(false);
    expect(isBetaElectronRuntime({ VITE_BETA_CHANNEL: "1" })).toBe(false);
    expect(isBetaElectronRuntime({})).toBe(false);
  });
});

describe("preload bridge Beta parity (source-pinned, toolchain cannot load it)", () => {
  const PRELOAD = fileURLToPath(new URL("../preload.cts", import.meta.url));
  const TYPES = fileURLToPath(
    new URL("../../src/platform/desktop/types/electron.d.ts", import.meta.url),
  );
  const HELPER = fileURLToPath(new URL("../betaRuntime.ts", import.meta.url));
  const preloadCode = code(readFileSync(PRELOAD, "utf8"));
  const typesRaw = readFileSync(TYPES, "utf8");
  const typesCode = code(typesRaw);
  const helperCode = code(readFileSync(HELPER, "utf8"));

  it("mirrors the helper predicate instead of importing it (CJS/ESM boundary)", () => {
    // The helper is the source of truth; the preload mirrors it because
    // preload.cts compiles to CJS and must not require() the ESM helper.
    expect(helperCode).toContain('VITE_BETA_CHANNEL === "true"');
    expect(preloadCode).toContain('VITE_BETA_CHANNEL === "true"');
    expect(preloadCode).not.toContain("betaRuntime");
  });

  it("pins the refusal sentence to the shared constant text (CJS/ESM mirror)", () => {
    // The preload cannot import betaRuntime.ts (CJS bridge vs ESM helper),
    // so it mirrors BETA_ELECTRON_PII_REFUSAL verbatim. This pins the exact
    // sentence: the preload literal must equal the shared constant, and the
    // helper message must compose from the same constant.
    expect(preloadCode).toContain("BETA_ELECTRON_PII_REFUSAL");
    expect(preloadCode).toContain(BETA_ELECTRON_PII_REFUSAL);
    expect(betaElectronPiiRefusal("db:export").message).toBe(
      `[beta] db:export is unavailable: ${BETA_ELECTRON_PII_REFUSAL}`,
    );
  });

  it("gates every retained PII method exactly once (17: export/pii/erasure/withdrawal/privacy)", () => {
    const gated = preloadCode.match(/betaPiiUnavailable\("/g) ?? [];
    // db.exportDatabase(1) + piiNew(3) + erasure(4) +
    // erasure.newPii(4) + withdrawal(2) + privacy(3) = 17. A different count
    // means a PII method lost its gate or a non-PII method gained one.
    expect(gated).toHaveLength(17);
    for (const channel of [
      "db:export",
      "pii:new:capability",
      "pii:new:load",
      "pii:new:save",
      "erasure:authorize",
      "erasure:claim",
      "erasure:start",
      "erasure:status",
      "erasure:new-pii:authorize",
      "erasure:new-pii:claim",
      "erasure:new-pii:start",
      "erasure:new-pii:status",
      "withdrawal:request",
      "withdrawal:purge",
      "privacy:migrate-key",
      "privacy:eliminate-key",
      "privacy:legacy-rows",
    ]) {
      expect(preloadCode).toContain(`betaPiiUnavailable("${channel}")`);
    }
  });

  it("keeps non-PII infrastructure ungated and the live privacy contract intact", () => {
    expect(preloadCode).toContain("privacy:legacy-rows");
    expect(preloadCode).toContain("db:list-keys");
    expect(preloadCode).toContain("update:check");
    // The updater surface must not refuse on Beta.
    expect(preloadCode).not.toMatch(/betaPiiUnavailable\("update:/);
  });

  it("documents the Beta refusal in the renderer types without changing channels", () => {
    // Documentation lives in comments, so assert on the raw source; the
    // channel contract itself is code and must survive comment stripping.
    expect(typesRaw).toMatch(/Web-only/);
    expect(typesCode).toMatch(/\blegacyRows\b/);
  });
});

describe("Beta Electron main process (real main.ts, mocked shell)", () => {
  beforeAll(async () => {
    h.state.userData = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-beta-"));
    await import("../main.js");
    await vi.waitFor(() => expect(h.handlers.size).toBeGreaterThan(0));
    await vi.waitFor(() =>
      expect(h.state.createdWindows.length).toBeGreaterThan(0),
    );
  });

  afterAll(() => {
    fs.rmSync(h.state.userData, { recursive: true, force: true });
  });

  it.each([
    "pii:new:capability",
    "pii:new:load",
    "pii:new:save",
    "erasure:authorize",
    "erasure:claim",
    "erasure:start",
    "erasure:status",
    "erasure:new-pii:authorize",
    "erasure:new-pii:claim",
    "erasure:new-pii:start",
    "erasure:new-pii:status",
    "withdrawal:request",
    "withdrawal:purge",
    "db:export",
  ])("refuses the PII channel %s fail-closed on Beta", async (channel) => {
    await expect(invoke(channel, TRUSTED, "synthetic", {})).rejects.toThrow(
      /Beta channel is Web-only/,
    );
  });

  it.each([
    "privacy:scan-report",
    "privacy:quarantine-report",
    "privacy:legacy-rows",
    "privacy:migrate-key",
    "privacy:eliminate-key",
    "privacy:recovery-report",
    "privacy:recover-key",
  ])(
    "refuses the legacy channel %s with the Beta sentence on Beta",
    async (channel) => {
      await expect(invoke(channel, TRUSTED)).rejects.toThrow(
        /Beta channel is Web-only/,
      );
    },
  );

  it("withholds the consent row from generic storage on Beta", async () => {
    await expect(
      invoke("db:load", TRUSTED, "open3dcalc_consent_v1"),
    ).rejects.toThrow(/not permitted/i);
    const listed = (await invoke("db:list-keys", TRUSTED)) as string[];
    expect(listed).not.toContain("open3dcalc_consent_v1");
  });

  it("keeps non-PII infrastructure working on Beta", async () => {
    await expect(
      invoke("db:load", TRUSTED, "open3dcalc_settings_v2"),
    ).resolves.toBe('{"units":"metric"}');
    const listed = (await invoke("db:list-keys", TRUSTED)) as string[];
    expect(listed).toContain("open3dcalc_settings_v2");
    await expect(invoke("update:check", TRUSTED)).resolves.toEqual({
      available: false,
    });
    await expect(invoke("update:get-status", TRUSTED)).resolves.toEqual({
      status: "idle",
    });
  });

  it("skips startup resume on Beta without dereferencing the database", async () => {
    let dbReads = 0;
    const inaccessibleDb = new Proxy(
      {},
      {
        get() {
          dbReads++;
          throw new Error("DB must not be dereferenced on Beta startup");
        },
      },
    ) as Parameters<typeof resumeErasureIfNeeded>[0];

    await expect(resumeErasureIfNeeded(inaccessibleDb)).resolves.toEqual({
      resumed: false,
    });
    expect(dbReads).toBe(0);
  });
});
