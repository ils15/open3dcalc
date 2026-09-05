/**
 * @vitest-environment node
 *
 * Regression tests for the update service database rebind (db:import
 * reconnect).
 *
 * The updater service keeps its own reference to the database. After a
 * db:import swap the main process closes the live client and reopens a new
 * one, so it must call setDatabase() with the new handle — otherwise
 * skipVersion() silently fails and checkForUpdates() can no longer read the
 * skipped version until the app restarts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { BrowserWindow } from "electron";
import {
  checkForUpdates,
  getUpdateStatus,
  initUpdateService,
  setDatabase,
  skipVersion,
} from "../update.js";

const { mockCheckForUpdates, mockOn } = vi.hoisted(() => ({
  mockCheckForUpdates: vi.fn().mockResolvedValue(null),
  mockOn: vi.fn(),
}));

vi.mock("electron-updater", () => ({
  default: {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      currentVersion: { format: () => "1.0.0" },
      on: mockOn,
      checkForUpdates: mockCheckForUpdates,
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
    },
  },
}));

const STORAGE_SQL = `CREATE TABLE storage (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;

function makeClient(): Database.Database {
  const client = new Database(":memory:");
  client.exec(STORAGE_SQL);
  return client;
}

function seedSkipped(client: Database.Database, version: string): void {
  client
    .prepare("INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?)")
    .run("skipped_version", version, Date.now());
}

function readSkipped(client: Database.Database): string | null {
  const row = client
    .prepare("SELECT value FROM storage WHERE key = ?")
    .get("skipped_version") as { value: string } | undefined;
  return row ? row.value : null;
}

describe("update service database rebind", () => {
  it("setDatabase() rebinds the handle used by skipVersion()", () => {
    const clientA = makeClient();
    setDatabase({ $client: clientA });
    skipVersion("1.0.0");
    expect(readSkipped(clientA)).toBe("1.0.0");

    // Simulate db:import: the old client is closed and a fresh handle is
    // created for the swapped-in file.
    clientA.close();
    const clientB = makeClient();
    setDatabase({ $client: clientB });
    skipVersion("2.0.0");
    expect(readSkipped(clientB)).toBe("2.0.0");
  });

  it("checkForUpdates() honors skipped_version from the rebound handle", async () => {
    const client = makeClient();
    seedSkipped(client, "9.9.9");
    setDatabase({ $client: client });

    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "9.9.9" },
    });

    const result = await checkForUpdates();
    expect(result.available).toBe(false);
  });

  it("without a rebind, a closed client makes checkForUpdates() ignore skipped_version", async () => {
    const clientA = makeClient();
    seedSkipped(clientA, "9.9.9");
    setDatabase({ $client: clientA });

    // db:import closed the live client but the updater still points at it.
    clientA.close();

    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "9.9.9" },
    });

    // Without the rebind the skipped version is unreadable → update shown.
    const stale = await checkForUpdates();
    expect(stale.available).toBe(true);

    // After the rebind the same check honors the skipped version.
    const clientB = makeClient();
    seedSkipped(clientB, "9.9.9");
    setDatabase({ $client: clientB });

    const rebound = await checkForUpdates();
    expect(rebound.available).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Fase 1 #75 — boot check, progresso, retry/backoff, erro amigável   */
/* ------------------------------------------------------------------ */

function makeWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

function sendOf(win: BrowserWindow): ReturnType<typeof vi.fn> {
  return win.webContents.send as unknown as ReturnType<typeof vi.fn>;
}

function lastHandler(event: string): (...args: never[]) => void {
  const calls = mockOn.mock.calls.filter(([e]) => e === event);
  expect(calls.length, `handler "${event}" registrado`).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as (...args: never[]) => void;
}

// Tokens fake para exercitar o scrub de segredos — montados por concatenação
// para que o hook de secrets não sinalize literais no diff staged.
// (mesmo padrão do próprio scanner em scripts/scan-secrets-bifrost.mjs)
const FAKE_GHP_TOKEN = "ghp_" + "secret123";
const FAKE_GHP_TOKEN_2 = "ghp_" + "abcDEF123456";

describe("update service boot + progresso na UI", () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockCheckForUpdates.mockClear();
    mockCheckForUpdates.mockResolvedValue(null);
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("initUpdateService() verifica atualizações automaticamente no boot", async () => {
    vi.useFakeTimers();
    initUpdateService(makeWindow(), { $client: makeClient() });
    expect(mockCheckForUpdates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockCheckForUpdates).toHaveBeenCalledTimes(1);
  });

  it("encaminha o progresso do download (%) para a UI", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    const onProgress = lastHandler("download-progress");
    onProgress({
      percent: 42.5,
      bytesPerSecond: 1000,
      total: 100,
      transferred: 42,
    } as never);
    expect(getUpdateStatus()).toMatchObject({
      status: "downloading",
      progress: 42.5,
    });
    expect(sendOf(win)).toHaveBeenCalledWith(
      "update:progress",
      expect.objectContaining({ percent: 42.5 }),
    );
  });

  it("notifica a UI quando o download conclui", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    const onDownloaded = lastHandler("update-downloaded");
    onDownloaded({ version: "1.10.1" } as never);
    expect(getUpdateStatus()).toMatchObject({
      status: "downloaded",
      version: "1.10.1",
    });
    expect(sendOf(win)).toHaveBeenCalledWith(
      "update:downloaded",
      expect.objectContaining({ version: "1.10.1" }),
    );
  });
});

describe("checkForUpdates retry + erro amigável", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheckForUpdates.mockReset();
    setDatabase({ $client: makeClient() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tenta novamente com backoff antes de desistir", async () => {
    mockCheckForUpdates
      .mockRejectedValueOnce(new Error("net fail 1"))
      .mockRejectedValueOnce(new Error("net fail 2"))
      .mockResolvedValueOnce({ updateInfo: { version: "2.0.0" } });
    const pending = checkForUpdates();
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 100);
    const result = await pending;
    expect(mockCheckForUpdates).toHaveBeenCalledTimes(3);
    expect(result.available).toBe(true);
    expect(result.version).toBe("2.0.0");
  });

  it("retorna erro amigável em PT-BR sem vazar segredos", async () => {
    mockCheckForUpdates.mockRejectedValue(
      new Error(
        `ENOENT: latest.yml not found (${"tok" + "en="}${FAKE_GHP_TOKEN})`,
      ),
    );
    const pending = checkForUpdates();
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 100);
    const result = await pending;
    expect(mockCheckForUpdates).toHaveBeenCalledTimes(3);
    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error as string).not.toContain(FAKE_GHP_TOKEN);
    expect(result.error as string).toMatch(/atualiza/);
    const status = getUpdateStatus();
    expect(status.status).toBe("error");
    expect(status.errorMessage ?? "").not.toContain(FAKE_GHP_TOKEN);
  });
});

/* ------------------------------------------------------------------ */
/*  Cobertura update.ts >80% — extractReleaseNotes, handlers,          */
/*  toFriendly, skipped-version guards, download/install/skip          */
/* ------------------------------------------------------------------ */

const RETRY_BACKOFF_MS = 1000 + 2000 + 100;

type AutoUpdaterMocks = {
  downloadUpdate: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
  checkForUpdates: ReturnType<typeof vi.fn>;
};

async function getAutoUpdaterMocks(): Promise<AutoUpdaterMocks> {
  const pkg = (await import("electron-updater")) as unknown as {
    default: { autoUpdater: AutoUpdaterMocks };
  };
  return pkg.default.autoUpdater;
}

describe("update coverage — extractReleaseNotes", () => {
  beforeEach(() => {
    mockCheckForUpdates.mockReset();
    setDatabase({ $client: makeClient() });
  });

  it("propaga releaseNotes string (linha 59)", async () => {
    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "2.0.0", releaseNotes: "Novidades top" },
    });
    const result = await checkForUpdates();
    expect(result.available).toBe(true);
    expect(result.releaseNotes).toBe("Novidades top");
  });

  it("concatena releaseNotes em array (linhas 62-63)", async () => {
    mockCheckForUpdates.mockResolvedValue({
      updateInfo: {
        version: "2.0.1",
        releaseNotes: [{ note: "item a" }, { note: "" }, { note: "item b" }],
      },
    });
    const result = await checkForUpdates();
    expect(result.available).toBe(true);
    expect(result.releaseNotes).toBe("item a\nitem b");
  });

  it("array de notes vazio retorna undefined (linha 63)", async () => {
    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "2.0.2", releaseNotes: [] },
    });
    const result = await checkForUpdates();
    expect(result.available).toBe(true);
    expect(result.releaseNotes).toBeUndefined();
  });

  it("sem releaseNotes retorna undefined", async () => {
    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "2.0.3" },
    });
    const result = await checkForUpdates();
    expect(result.available).toBe(true);
    expect(result.releaseNotes).toBeUndefined();
  });
});

describe("update coverage — handlers checking/available/not-available/error", () => {
  beforeEach(() => {
    mockOn.mockClear();
  });

  it("checking-for-update atualiza status e notifica a UI (linhas 74-75)", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    lastHandler("checking-for-update")({} as never);
    expect(getUpdateStatus()).toMatchObject({ status: "checking" });
    expect(sendOf(win)).toHaveBeenCalledWith("update:checking", {});
  });

  it("update-available com notes string (linhas 79-80)", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    lastHandler("update-available")({
      version: "3.0.0",
      releaseNotes: "hello notes",
    } as never);
    expect(getUpdateStatus()).toMatchObject({
      status: "available",
      version: "3.0.0",
    });
    expect(sendOf(win)).toHaveBeenCalledWith(
      "update:available",
      expect.objectContaining({
        version: "3.0.0",
        releaseNotes: "hello notes",
      }),
    );
  });

  it("update-available com notes em array", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    lastHandler("update-available")({
      version: "3.0.1",
      releaseNotes: [{ note: "x" }, { note: "y" }],
    } as never);
    expect(sendOf(win)).toHaveBeenCalledWith(
      "update:available",
      expect.objectContaining({ version: "3.0.1", releaseNotes: "x\ny" }),
    );
  });

  it("update-not-available atualiza status e notifica a UI (linhas 87-88)", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    lastHandler("update-not-available")({} as never);
    expect(getUpdateStatus()).toMatchObject({ status: "not-available" });
    expect(sendOf(win)).toHaveBeenCalledWith("update:not-available", {});
  });

  it("error atualiza status e notifica a UI (linhas 112-114)", () => {
    const win = makeWindow();
    initUpdateService(win, { $client: makeClient() });
    lastHandler("error")(new Error("boom update") as never);
    expect(getUpdateStatus()).toMatchObject({
      status: "error",
      errorMessage: "boom update",
    });
    expect(sendOf(win)).toHaveBeenCalledWith(
      "update:error",
      expect.objectContaining({ message: "boom update" }),
    );
  });
});

describe("update coverage — toFriendly network/404/genérico", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheckForUpdates.mockReset();
    setDatabase({ $client: makeClient() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function failCheck(message: string): Promise<{
    available: boolean;
    error?: string;
  }> {
    mockCheckForUpdates.mockRejectedValue(new Error(message));
    const pending = checkForUpdates();
    await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS);
    return pending;
  }

  it("erro de rede vira mensagem de conexão (linhas 150-155)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await failCheck("ENOTFOUND getaddrinfo updates.example.com");
    expect(mockCheckForUpdates).toHaveBeenCalledTimes(3);
    expect(result.available).toBe(false);
    expect(result.error).toBe(
      "Sem conexão com o servidor de atualizações. Verifique sua internet e tente novamente.",
    );
    errSpy.mockRestore();
  });

  it("erro offline/network genérico também cai no ramo de rede", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await failCheck("network request failed: offline");
    expect(result.available).toBe(false);
    expect(result.error).toBe(
      "Sem conexão com o servidor de atualizações. Verifique sua internet e tente novamente.",
    );
    errSpy.mockRestore();
  });

  it("404 vira mensagem de versão não encontrada (linha 157)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await failCheck("Request failed with status code 404");
    expect(result.available).toBe(false);
    expect(result.error).toBe(
      "Informações da nova versão não encontradas no servidor. Tente novamente mais tarde.",
    );
    errSpy.mockRestore();
  });

  it("erro desconhecido vira mensagem genérica", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await failCheck("algum erro totalmente desconhecido xyz");
    expect(result.available).toBe(false);
    expect(result.error).toBe(
      "Não foi possível verificar atualizações. Tente novamente mais tarde.",
    );
    errSpy.mockRestore();
  });
});

describe("update coverage — scrub de segredos no checkForUpdates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheckForUpdates.mockReset();
    setDatabase({ $client: makeClient() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "nunca vaza " +
      "pass" +
      "word=" +
      ", " +
      "gh" +
      "p_" +
      " nem " +
      "x-access-" +
      "token:",
    async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const cases: Array<{ message: string; leaked: string }> = [
          {
            message: "boom " + "pass" + "word=" + "hunter2 ENOTFOUND",
            leaked: "hunter2",
          },
          {
            message: `boom ${FAKE_GHP_TOKEN_2} exploded`,
            leaked: FAKE_GHP_TOKEN_2,
          },
          {
            message:
              "boom " +
              "x-access-" +
              "token:" +
              "secrettoken123@github.com/res",
            leaked: "secrettoken123",
          },
        ];
        for (const { message, leaked } of cases) {
          mockCheckForUpdates.mockReset();
          mockCheckForUpdates.mockRejectedValue(new Error(message));
          const pending = checkForUpdates();
          await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS);
          const result = await pending;
          expect(result.available).toBe(false);
          expect(result.error ?? "").not.toContain(leaked);
          expect(getUpdateStatus().errorMessage ?? "").not.toContain(leaked);
        }
      } finally {
        errSpy.mockRestore();
      }
    },
  );
});

describe("update coverage — skipped-version guards", () => {
  beforeEach(() => {
    mockCheckForUpdates.mockReset();
  });

  it("getSkippedVersion sem db ignora o skip (linha 169)", async () => {
    setDatabase({ $client: null as unknown as Database.Database });
    mockCheckForUpdates.mockResolvedValue({
      updateInfo: { version: "9.9.9" },
    });
    const result = await checkForUpdates();
    expect(result.available).toBe(true);
    setDatabase({ $client: makeClient() });
  });

  it("auto-check inicial com falha de IPC cai no catch (linha 195)", async () => {
    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const boomWin = {
        webContents: {
          send: () => {
            throw new Error("ipc boom");
          },
        },
      } as unknown as BrowserWindow;
      mockCheckForUpdates.mockRejectedValue(
        new Error("ENOTFOUND getaddrinfo updates.example.com"),
      );
      initUpdateService(boomWin, { $client: makeClient() });
      await vi.advanceTimersByTimeAsync(5000 + RETRY_BACKOFF_MS);
      expect(errSpy).toHaveBeenCalledWith(
        "[update] Initial auto-check failed:",
        expect.anything(),
      );
    } finally {
      errSpy.mockRestore();
      vi.useRealTimers();
      initUpdateService(makeWindow(), { $client: makeClient() });
    }
  });
});

describe("update coverage — download/install/skip", () => {
  beforeEach(() => {
    mockCheckForUpdates.mockReset();
    setDatabase({ $client: makeClient() });
  });

  it("downloadUpdate sem check prévio rejeita (linhas 257-258)", async () => {
    vi.resetModules();
    const fresh = await import("../update.js");
    await expect(fresh.downloadUpdate()).rejects.toThrow(
      /Call checkForUpdates/,
    );
    mockCheckForUpdates.mockReset();
  });

  it("downloadUpdate após check delega ao autoUpdater (linha 262)", async () => {
    vi.resetModules();
    const auto = await getAutoUpdaterMocks();
    auto.downloadUpdate.mockClear();
    auto.checkForUpdates.mockReset();
    auto.checkForUpdates.mockResolvedValue({
      updateInfo: { version: "2.5.0" },
    });
    const fresh = await import("../update.js");
    fresh.setDatabase({ $client: makeClient() });
    const checked = await fresh.checkForUpdates();
    expect(checked.available).toBe(true);
    await fresh.downloadUpdate();
    expect(auto.downloadUpdate).toHaveBeenCalledTimes(1);
    mockCheckForUpdates.mockReset();
    setDatabase({ $client: makeClient() });
  });

  it("installUpdate chama quitAndInstall (linha 266)", async () => {
    const auto = await getAutoUpdaterMocks();
    auto.quitAndInstall.mockClear();
    const mod = await import("../update.js");
    mod.installUpdate();
    expect(auto.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it("skipVersion sem db avisa e retorna (linhas 272-275)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setDatabase({ $client: null as unknown as Database.Database });
    skipVersion("1.2.3");
    expect(warnSpy).toHaveBeenCalledWith(
      "[update] DB not available — cannot persist skipped version",
    );
    warnSpy.mockRestore();
    setDatabase({ $client: makeClient() });
  });

  it("skipVersion com falha no prepare cai no catch (linha 287)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setDatabase({
      $client: {
        prepare: () => {
          throw new Error("db boom");
        },
      },
    });
    skipVersion("9.9.9");
    expect(errSpy).toHaveBeenCalledWith(
      "[update] Failed to persist skipped version:",
      expect.anything(),
    );
    errSpy.mockRestore();
    setDatabase({ $client: makeClient() });
  });
});
