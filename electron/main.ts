import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import type {
  BrowserWindowConstructorOptions,
  IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import {
  initDatabase,
  getSqlClient,
} from "../db/database.js";
import {
  initUpdateService,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  skipVersion,
  getUpdateStatus,
} from "./update.js";
import {
  getCapability,
  adoptSessionPassphrase,
  lockCryptoSession,
} from "./cryptoCapability.js";
import {
  saveGated,
  gateLoad,
  readStoredRow,
  deleteGated,
} from "./persistGate.js";
import {
  buildRecoveryReport,
  recoverLegacyKey,
  UnreadablePiiValueError,
  type RecoveryResult,
} from "./legacyRecovery.js";
import { buildScanReport, summarizeReport } from "./legacyScan.js";
import {
  PII_DOMAIN_TABLES,
  PII_LEGACY_PLAINTEXT_TABLES,
  type PiiDomainTableCounts,
} from "./piiDomainTables.js";
import {
  buildQuarantineReport,
  migrateKey,
  eliminateKey,
} from "./quarantine.js";
import { readLegacyPiiRows } from "./legacyRows.js";
import {
  createDiagnosticBackup,
  DiagnosticGateError,
} from "./diagnosticBackup.js";
import { isDiagnosticGateEnabled } from "./diagnosticGate.js";
import {
  runDesktopErasure,
  resumeErasureIfNeeded,
  erasureStatus,
} from "./erasure.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const isDev = process.env.NODE_ENV === "development";

/* ------------------------------------------------------------------ */
/* Window state persistence                                           */
/* ------------------------------------------------------------------ */

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

const DEFAULT_STATE: WindowState = { width: 1280, height: 800 };

function windowStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

async function loadWindowState(): Promise<WindowState> {
  try {
    const raw = await fs.readFile(windowStatePath(), "utf-8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveWindowState(state: WindowState): Promise<void> {
  try {
    await fs.writeFile(windowStatePath(), JSON.stringify(state, null, 2));
  } catch {
    // Non-critical — silently ignore
  }
}

/* ------------------------------------------------------------------ */
/* Window creation                                                    */
/* ------------------------------------------------------------------ */

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  const savedState = await loadWindowState();

  const options: BrowserWindowConstructorOptions = {
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 960,
    minHeight: 600,
    title: "Open3DCalc",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };

  mainWindow = new BrowserWindow(options);

  // ── Window hardening ─────────────────────────────────────────────
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  const trackState = (): void => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    saveWindowState({ ...bounds, isMaximized });
  };

  mainWindow.on("resize", trackState);
  mainWindow.on("move", trackState);
  mainWindow.on("close", trackState);

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, "..", "..", "..", "dist", "index.desktop.html"),
    );
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
}

/* ------------------------------------------------------------------ */
/* IPC Handlers                                                       */
/* ------------------------------------------------------------------ */

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  if (!frame) return false;
  try {
    const url = new URL(frame.url);
    if (isDev) {
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      );
    }
    return url.protocol === "file:";
  } catch {
    return false;
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error("Untrusted IPC sender rejected");
  }
}

async function setupIpcHandlers(): Promise<void> {
  let sql: ReturnType<typeof getSqlClient>;

  try {
    await initDatabase();
    sql = getSqlClient();
    console.log("[main] Database initialized (PostgreSQL)");
  } catch (error: unknown) {
    console.error("[main] Failed to initialize database:", error);
    sql = new Proxy({} as ReturnType<typeof getSqlClient>, {
      get() {
        throw new Error("Database not initialized");
      },
    });
  }

  // ── db:load ──────────────────────────────────────────────────────
  ipcMain.handle(
    "db:load",
    async (event, key: string): Promise<string | null> => {
      try {
        assertTrustedSender(event);
        if (typeof key !== "string" || key.trim().length === 0) {
          throw new Error("Key must be a non-empty string");
        }
        const stored = await readStoredRow(sql, key);
        if (stored === null) return null;
        const outcome = await gateLoad(key, stored);
        if (outcome.action === "unreadable") {
          throw new UnreadablePiiValueError(key, outcome.reason);
        }
        if (outcome.action === "denied") return null;
        return outcome.value;
      } catch (error) {
        console.error("[db:load] Error:", error);
        throw error;
      }
    },
  );

  // ── privacy:recovery-report ──────────────────────────────────────
  ipcMain.handle("privacy:recovery-report", async (event) => {
    try {
      assertTrustedSender(event);
      return await buildRecoveryReport(sql);
    } catch (error) {
      console.error("[privacy:recovery-report] Error:", error);
      throw error;
    }
  });

  // ── privacy:recover-key ──────────────────────────────────────────
  ipcMain.handle(
    "privacy:recover-key",
    async (event, key: string): Promise<RecoveryResult> => {
      try {
        assertTrustedSender(event);
        if (typeof key !== "string" || key.trim().length === 0) {
          throw new Error("Key must be a non-empty string");
        }
        return await recoverLegacyKey(sql, key);
      } catch (error) {
        console.error("[privacy:recover-key] Error:", error);
        throw error;
      }
    },
  );

  // ── db:save ──────────────────────────────────────────────────────
  ipcMain.handle(
    "db:save",
    async (event, key: string, value: string): Promise<void> => {
      try {
        assertTrustedSender(event);
        if (typeof key !== "string" || key.trim().length === 0) {
          throw new Error("Key must be a non-empty string");
        }
        if (typeof value !== "string") {
          throw new Error("Value must be a string");
        }
        await saveGated(sql, key, value);
      } catch (error) {
        console.error("[db:save] Error:", error);
        throw error;
      }
    },
  );

  // ── db:delete ────────────────────────────────────────────────────
  ipcMain.handle("db:delete", async (event, key: string): Promise<void> => {
    try {
      assertTrustedSender(event);
      if (typeof key !== "string" || key.trim().length === 0) {
        throw new Error("Key must be a non-empty string");
      }
      await deleteGated(sql, key);
    } catch (error) {
      console.error("[db:delete] Error:", error);
      throw error;
    }
  });

  // ── db:list-keys ─────────────────────────────────────────────────
  ipcMain.handle("db:list-keys", async (event): Promise<string[]> => {
    try {
      assertTrustedSender(event);
      const rows = await sql`SELECT key FROM storage ORDER BY key`;
      return rows.map((r) => r.key as string);
    } catch (error) {
      console.error("[db:list-keys] Error:", error);
      throw error;
    }
  });

  // ── db:export ────────────────────────────────────────────────────
  ipcMain.handle(
    "db:export",
    async (event, options?: { redact?: boolean }): Promise<string> => {
      try {
        assertTrustedSender(event);
        const redact = options?.redact === true;
        if (!isDiagnosticGateEnabled()) {
          throw new DiagnosticGateError();
        }
        if (!mainWindow) {
          throw new Error("No active window");
        }
        const suffix = redact ? "redacted" : "full";
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Backup diagnóstico (engenharia) — uso interno",
          defaultPath: `diagnostic-backup-${suffix}-${new Date()
            .toISOString()
            .slice(0, 10)}.sql`,
          filters: [
            { name: "SQL Dump", extensions: ["sql"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });
        if (result.canceled || !result.filePath) {
          throw new Error("Export cancelled");
        }
        const backup = await createDiagnosticBackup({
          sql,
          targetPath: result.filePath,
          redact,
        });
        console.log(
          `[db:export] diagnostic backup (${suffix}) written by operator: ` +
            `${path.basename(backup.targetPath)}`,
        );
        return backup.targetPath;
      } catch (error) {
        console.error("[db:export] Error:", error);
        throw error;
      }
    },
  );

  // ── erasure:start ────────────────────────────────────────────────
  ipcMain.handle(
    "erasure:start",
    async (
      event,
      rendererReport?: Parameters<typeof runDesktopErasure>[1],
    ) => {
      try {
        assertTrustedSender(event);
        return await runDesktopErasure(sql, rendererReport);
      } catch (error) {
        console.error("[erasure:start] Error:", error);
        throw error;
      }
    },
  );

  // ── erasure:status ───────────────────────────────────────────────
  ipcMain.handle("erasure:status", (event) => {
    try {
      assertTrustedSender(event);
      return erasureStatus();
    } catch (error) {
      console.error("[erasure:status] Error:", error);
      throw error;
    }
  });

  // ── update:check ─────────────────────────────────────────────────
  ipcMain.handle(
    "update:check",
    async (): Promise<{
      available: boolean;
      version?: string;
      releaseNotes?: string;
      error?: string;
    }> => {
      try {
        return await checkForUpdates();
      } catch (error) {
        console.error("[update:check] Error:", error);
        throw error;
      }
    },
  );

  // ── update:download ──────────────────────────────────────────────
  ipcMain.handle("update:download", async (): Promise<void> => {
    await downloadUpdate();
  });

  // ── update:install ───────────────────────────────────────────────
  ipcMain.handle("update:install", async (): Promise<void> => {
    installUpdate();
  });

  // ── update:get-status ────────────────────────────────────────────
  ipcMain.handle(
    "update:get-status",
    async (): Promise<{
      status: string;
      progress?: number;
      version?: string;
    }> => {
      return getUpdateStatus();
    },
  );

  // ── update:skip ──────────────────────────────────────────────────
  ipcMain.handle(
    "update:skip",
    async (_event, version: string): Promise<void> => {
      if (typeof version !== "string" || version.trim().length === 0) {
        throw new Error("Version must be a non-empty string");
      }
      skipVersion(version);
    },
  );

  // ── db:import ────────────────────────────────────────────────────
  ipcMain.handle("db:import", async (event): Promise<string> => {
    assertTrustedSender(event);
    throw new Error(
      "SQLite-style file import is not supported for PostgreSQL. " +
        "Use pg_restore or the diagnostic backup feature instead.",
    );
  });

  // ── crypto:capability ────────────────────────────────────────────
  ipcMain.handle("crypto:capability", () => {
    try {
      return getCapability();
    } catch (error) {
      console.error("[crypto:capability] Error:", error);
      throw error;
    }
  });

  // ── crypto:set-passphrase ────────────────────────────────────────
  ipcMain.handle(
    "crypto:set-passphrase",
    async (event, passphrase: string): Promise<void> => {
      try {
        assertTrustedSender(event);
        if (typeof passphrase !== "string" || passphrase.length === 0) {
          throw new Error("Passphrase must be a non-empty string");
        }
        adoptSessionPassphrase(passphrase);
      } catch (error) {
        console.error("[crypto:set-passphrase] Error:", error);
        throw error;
      }
    },
  );

  // ── crypto:lock ──────────────────────────────────────────────────
  ipcMain.handle("crypto:lock", async (event): Promise<void> => {
    try {
      assertTrustedSender(event);
      lockCryptoSession();
    } catch (error) {
      console.error("[crypto:lock] Error:", error);
      throw error;
    }
  });

  // ── privacy:scan-report ──────────────────────────────────────────
  ipcMain.handle("privacy:scan-report", async () => {
    try {
      return await runPrivacyScan();
    } catch (error) {
      console.error("[privacy:scan-report] Error:", error);
      throw error;
    }
  });

  // ── privacy:quarantine-report ────────────────────────────────────
  ipcMain.handle("privacy:quarantine-report", async (event) => {
    try {
      assertTrustedSender(event);
      return await buildQuarantineReport(sql);
    } catch (error) {
      console.error("[privacy:quarantine-report] Error:", error);
      throw error;
    }
  });

  // ── privacy:migrate-key ──────────────────────────────────────────
  ipcMain.handle("privacy:migrate-key", async (event, key: string) => {
    try {
      assertTrustedSender(event);
      if (typeof key !== "string" || key.trim().length === 0) {
        throw new Error("Key must be a non-empty string");
      }
      const result = await migrateKey(sql, key);
      console.log(
        `[privacy] migrated key "${key}" (verified=${result.verified})`,
      );
      return result;
    } catch (error) {
      console.error("[privacy:migrate-key] Error:", error);
      throw error;
    }
  });

  // ── privacy:eliminate-key ────────────────────────────────────────
  ipcMain.handle("privacy:eliminate-key", async (event, key: string) => {
    try {
      assertTrustedSender(event);
      if (typeof key !== "string" || key.trim().length === 0) {
        throw new Error("Key must be a non-empty string");
      }
      const result = await eliminateKey(sql, key);
      console.log(`[privacy] eliminated key "${key}"`);
      return result;
    } catch (error) {
      console.error("[privacy:eliminate-key] Error:", error);
      throw error;
    }
  });

  // ── privacy:legacy-rows ──────────────────────────────────────────
  ipcMain.handle("privacy:legacy-rows", async (event) => {
    try {
      assertTrustedSender(event);
      return await readLegacyPiiRows(sql);
    } catch (error) {
      console.error("[privacy:legacy-rows] Error:", error);
      throw error;
    }
  });
}

/**
 * ADR-002 §2.3 startup scan: classify every storage-table row against the
 * manifest's expected encrypted form and count the plaintext domain tables.
 * Logs a METADATA-ONLY summary (key names, counts — never values).
 */
async function runPrivacyScan(): Promise<ReturnType<typeof buildScanReport>> {
  const sql = getSqlClient();
  const rows = (await sql`SELECT key, value FROM storage`) as Array<{
    key: string;
    value: string;
  }>;

  const countRows = async (table: string): Promise<number> => {
    try {
      const result = await sql.unsafe(
        `SELECT COUNT(*) AS c FROM "${table}"`,
      );
      return Number(result[0]?.c ?? 0);
    } catch {
      return 0;
    }
  };

  const domainCounts: Record<string, number> = {};
  for (const table of PII_DOMAIN_TABLES) {
    domainCounts[table] = await countRows(table);
  }

  const report = buildScanReport(rows, domainCounts as PiiDomainTableCounts);
  const summary = summarizeReport(report);

  const domainPlaintext = PII_LEGACY_PLAINTEXT_TABLES.reduce(
    (total, table) => total + (report.domainTables[table] ?? 0),
    0,
  );

  if (report.legacyCount > 0 || domainPlaintext > 0) {
    console.warn(
      `[privacy] legacy plaintext PII detected (ADR-002 §2.2): ${summary}`,
    );
  } else {
    console.log(`[privacy] at-rest scan clean: ${summary}`);
  }

  return report;
}

/* ------------------------------------------------------------------ */
/* App lifecycle                                                      */
/* ------------------------------------------------------------------ */

process.on("uncaughtException", (error: Error) => {
  console.error("[main] Uncaught exception:", error);
  dialog.showErrorBox(
    "Unexpected Error",
    `An unexpected error occurred:\n${(error as Error)?.message ?? String(error)}\nThe application will now exit.`,
  );
  app.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[main] Unhandled rejection:", reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  dialog.showErrorBox(
    "Unhandled Error",
    `An unhandled error occurred:\n${message}\nCheck the logs for details.`,
  );
});

app.whenReady().then(async () => {
  try {
    await setupIpcHandlers();
    await runPrivacyScan();

    const sql = getSqlClient();
    void resumeErasureIfNeeded(sql).catch((error) => {
      console.error("[erasure] resume failed:", error);
    });

    await createWindow();

    if (mainWindow) {
      initUpdateService(mainWindow, null as never);
    }
  } catch (error: unknown) {
    console.error("[main] Startup error:", error);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start Open3DCalc:\n${(error as Error)?.message ?? String(error)}`,
    );
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("before-quit", () => {
  lockCryptoSession();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}