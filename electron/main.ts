import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import type {
  BrowserWindowConstructorOptions,
  IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { initDatabase, getDbPath } from "../db/database.js";
import {
  initUpdateService,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  skipVersion,
  getUpdateStatus,
} from "./update.js";

// ESM compatibility: __dirname is not available in ES modules
import {
  registerDatabaseStorageHandlers,
  registerDisabledDatabaseImportHandler,
} from "./databaseIpc.js";
import { registerPasswordlessPiiHandlers } from "./newPiiIpc.js";
import { registerNewPiiErasureHandlers } from "./newPiiErasure.js";
import { registerWithdrawalPurgeHandlers } from "./withdrawalPurge.js";
import { registerDisabledLegacyPrivacyHandlers } from "./disabledLegacyPrivacyIpc.js";
import {
  createDiagnosticBackup,
  DiagnosticGateError,
} from "./diagnosticBackup.js";
import { isDiagnosticGateEnabled } from "./diagnosticGate.js";
import {
  runDesktopErasure,
  authorizeDesktopErasure,
  claimDesktopErasure,
  resumeErasureIfNeeded,
  erasureStatus,
} from "./erasure.js";
import {
  BETA_EXCLUDED_STORAGE_KEYS,
  betaElectronPiiRefusal,
  isBetaElectronRuntime,
} from "./betaRuntime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const isDev = process.env.NODE_ENV === "development";

/**
 * Opaque profile identifier bound into the new-PII erasure/withdrawal nonces.
 *
 * It is a stable, non-identifying constant, never a name, email or device
 * identifier: the journal already lives in the profile directory, so the value
 * only has to distinguish "this profile" for the binding check.
 */
const NEW_PII_ERASURE_PROFILE_ID = "desktop-local-profile";

/* ------------------------------------------------------------------ */
/*  Window state persistence                                           */
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
/*  Window creation                                                    */
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
  // Block top-level navigation to external origins (e.g. a compromised
  // page navigating the window away from the app).
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  // Open external http(s) links in the system browser and deny creating
  // new in-app windows (popups).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // In production, remove the application menu (and its DevTools/Reload
  // shortcuts). Dev keeps the menu so DevTools can be toggled.
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Track window state changes
  const trackState = (): void => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    saveWindowState({ ...bounds, isMaximized });
  };

  mainWindow.on("resize", trackState);
  mainWindow.on("move", trackState);
  mainWindow.on("close", trackState);

  // Load the renderer
  if (isDev) {
    // In development, load from the Vite dev server
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // In production, load from the built files
    await mainWindow.loadFile(
      path.join(__dirname, "..", "..", "..", "dist", "index.desktop.html"),
    );
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
}

/* ------------------------------------------------------------------ */
/*  IPC Handlers                                                       */
/* ------------------------------------------------------------------ */

let db: ReturnType<typeof initDatabase>;

/**
 * Returns true when the IPC message originates from the app's own
 * renderer frame: http://localhost / http://127.0.0.1 in dev, or a
 * file:// URL in production.
 */
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

/** Throws unless the IPC event originates from the app's own renderer. */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error("Untrusted IPC sender rejected");
  }
}

function setupIpcHandlers(): void {
  try {
    db = initDatabase();
    console.log("[main] Database initialized");
  } catch (error: unknown) {
    console.error("[main] Failed to initialize database:", error);
    // Don't throw - register handlers anyway, they'll fail gracefully
    // But create a null db object so handlers return meaningful errors
    db = {} as ReturnType<typeof initDatabase>;
  }

  // Generic storage IPC remains limited to an exact non-PII allowlist. The
  // handlers classify before touching SQLite and do not authorize legacy PII.
  // On Beta (Web-only channel) the consent row is additionally excluded: Beta
  // consent lives on Web, so Electron must neither read nor write it. The
  // exclusion is registration-time by construction — the allowlist is a closed
  // set snapshotted once — while every PII refusal below is per call. Stable
  // keeps the exact three-argument registration it has always had.
  if (isBetaElectronRuntime()) {
    registerDatabaseStorageHandlers(ipcMain, db, assertTrustedSender, {
      excludedKeys: [...BETA_EXCLUDED_STORAGE_KEYS],
    });
  } else {
    registerDatabaseStorageHandlers(ipcMain, db, assertTrustedSender);
  }

  // ── pii:new:* — Desktop exact-key plaintext PII route ──────────────────
  // Only the disjoint pwless namespace is available here. The route validates
  // trusted senders and the exact key before SQL; generic db IPC denies it.
  // No keyring, profile key, or passphrase prerequisite gates these writes.
  // The durable withdrawal journal lives in the profile (userData) directory;
  // while a pending/incomplete withdrawal exists the route refuses fail-closed.
  registerPasswordlessPiiHandlers(
    ipcMain,
    db,
    assertTrustedSender,
    app.getPath("userData"),
  );

  // ── erasure:new-pii:* — EXACT new-namespace delete-all (Beta12 follow-up) ─
  // Erases ONLY the three passwordless new-PII storage rows through a durable,
  // one-use, expiring nonce and a trusted-process postcondition. Legacy rows,
  // domain tables and mixed backups stay unavailable; this route never names
  // them. A pending/incomplete request locks the new-PII route fail-closed.
  registerNewPiiErasureHandlers(
    ipcMain,
    db,
    assertTrustedSender,
    app.getPath("userData"),
    NEW_PII_ERASURE_PROFILE_ID,
  );

  // ── withdrawal:* — receipt-scoped purge of the new-PII rows ──────────────
  // The production caller for `completeWithdrawal`: it purges ONLY the linked
  // new-PII targets in the receipt scope and releases the lock only after the
  // trusted-process rescan proves the rows are gone.
  registerWithdrawalPurgeHandlers(
    ipcMain,
    db,
    assertTrustedSender,
    app.getPath("userData"),
    NEW_PII_ERASURE_PROFILE_ID,
  );

  // ── db:export (D1.1 S6 — ADR-003 §2.2 reclassification) ─────────────
  // The raw SQLite copy is a DIAGNOSTIC backup, not a user feature: it is
  // gated behind the diagnostic flag, refuses to run in production without
  // it, and supports manifest-driven redaction. Users export via the
  // SPEC-03 envelope instead. No renderer UI invokes this.
  ipcMain.handle(
    "db:export",
    async (event, options?: { redact?: boolean }): Promise<string> => {
      try {
        // Beta is Web-only: the diagnostic copy may contain legacy PII, so it
        // refuses before the sender check, the erasure lock and the gate.
        if (isBetaElectronRuntime()) {
          throw betaElectronPiiRefusal("db:export");
        }
        assertTrustedSender(event);
        // Diagnostic export can contain legacy PII. An active or invalid
        // erasure journal is a lock, not a grant of additional data access.
        const deletionState = erasureStatus();
        if (deletionState.active || deletionState.state === "invalid") {
          throw new Error(
            "Diagnostic export is unavailable while deletion is pending or invalid",
          );
        }
        // §2.2.1 authorized access only — fail-closed without the gate.
        if (!isDiagnosticGateEnabled()) {
          throw new DiagnosticGateError();
        }

        const redact = options?.redact === true;
        const dbPath = getDbPath();

        if (!mainWindow) {
          throw new Error("No active window");
        }

        const suffix = redact ? "redacted" : "full";
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Backup diagnóstico (engenharia) — uso interno",
          defaultPath: `diagnostic-backup-${suffix}-${new Date()
            .toISOString()
            .slice(0, 10)}.sqlite3`,
          filters: [
            { name: "SQLite Database", extensions: ["sqlite3", "db"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (result.canceled || !result.filePath) {
          throw new Error("Export cancelled");
        }

        const backup = await createDiagnosticBackup({
          dbPath,
          targetPath: result.filePath,
          redact,
          checkpoint: () => {
            // Checkpoint first so the copy includes all WAL data.
            if (db && db.$client) {
              db.$client.pragma("wal_checkpoint(TRUNCATE)");
            }
          },
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

  // ── erasure authorization barrier ───────────────────────────────────
  // Authorization is denied until the manifest's complete PII inventory can
  // be represented by exact PII-only targets. In particular, mixed backups
  // and staging copies must never be swept as whole files.
  ipcMain.handle("erasure:authorize", (event) => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal("erasure:authorize");
    }
    assertTrustedSender(event);
    return authorizeDesktopErasure();
  });
  ipcMain.handle("erasure:claim", (event, token: unknown) => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal("erasure:claim");
    }
    assertTrustedSender(event);
    return claimDesktopErasure(token);
  });

  // ── erasure:start (D1.1 S7 — SPEC-02 delete-all saga) ───────────────
  // The legacy renderer report is telemetry only. Main refuses to start while
  // a complete PII-only target inventory and independent postcondition exist.
  ipcMain.handle(
    "erasure:start",
    async (
      event,
      authorizationToken: unknown,
      rendererReport?: Parameters<typeof runDesktopErasure>[2],
    ) => {
      try {
        if (isBetaElectronRuntime()) {
          throw betaElectronPiiRefusal("erasure:start");
        }
        assertTrustedSender(event);
        return await runDesktopErasure(db, authorizationToken, rendererReport);
      } catch (error) {
        console.error("[erasure:start] Error:", error);
        throw error;
      }
    },
  );

  // ── erasure:status ──────────────────────────────────────────────────
  // Metadata-only journal state for the privacy screen.
  ipcMain.handle("erasure:status", (event) => {
    try {
      // Beta refuses even the metadata status: the erasure surface is PII
      // scope, and a Beta renderer must not observe its state.
      if (isBetaElectronRuntime()) {
        throw betaElectronPiiRefusal("erasure:status");
      }
      assertTrustedSender(event);
      return erasureStatus();
    } catch (error) {
      console.error("[erasure:status] Error:", error);
      throw error;
    }
  });

  // ── update:check ────────────────────────────────────────────────────
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

  // ── update:download ──────────────────────────────────────────────────
  ipcMain.handle("update:download", async (): Promise<void> => {
    await downloadUpdate();
  });

  // ── update:install ───────────────────────────────────────────────────
  ipcMain.handle("update:install", async (): Promise<void> => {
    installUpdate();
  });

  // ── update:get-status ────────────────────────────────────────────────
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

  // ── update:skip ─────────────────────────────────────────────────────
  ipcMain.handle(
    "update:skip",
    async (_event, version: string): Promise<void> => {
      if (typeof version !== "string" || version.trim().length === 0) {
        throw new Error("Version must be a non-empty string");
      }
      skipVersion(version);
    },
  );

  // The old importer replaced the whole SQLite file and could introduce
  // unclassified legacy PII. Keep the preload contract but fail closed before
  // opening a dialog, reading the candidate, or touching the live database.
  registerDisabledDatabaseImportHandler(ipcMain, assertTrustedSender);

  // Temporarily retained only so old renderer builds fail with an explicit
  // disabled error instead of receiving legacy PII or an ambiguous empty scan.
  registerDisabledLegacyPrivacyHandlers(ipcMain);
}

/* ------------------------------------------------------------------ */
/*  App lifecycle                                                      */
/* ------------------------------------------------------------------ */

// ===== GLOBAL ERROR HANDLERS =====
process.on("uncaughtException", (error: Error) => {
  console.error("[main] Uncaught exception:", error);
  dialog.showErrorBox(
    "Unexpected Error",
    `An unexpected error occurred:\n\n${(error as Error)?.message ?? String(error)}\n\nThe application will now exit.`,
  );
  app.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[main] Unhandled rejection:", reason);
  const message = reason instanceof Error ? reason.message : String(reason);
  dialog.showErrorBox(
    "Unhandled Error",
    `An unhandled error occurred:\n\n${message}\n\nCheck the logs for details.`,
  );
});

app.whenReady().then(async () => {
  try {
    // This exported erasure preflight only reads and validates the durable
    // journal; it deliberately does not dereference its legacy DB parameter.
    // Run it before setupIpcHandlers(), whose first action opens/migrates SQLite.
    await resumeErasureIfNeeded(
      undefined as unknown as ReturnType<typeof initDatabase>,
    );
    setupIpcHandlers();
    await createWindow();
    if (mainWindow) {
      initUpdateService(mainWindow, db);
    }
  } catch (error: unknown) {
    console.error("[main] Startup error:", error);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start Open3DCalc:\n\n${(error as Error)?.message ?? String(error)}`,
    );
    app.quit();
  }

  app.on("activate", async () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Prevent multiple instances
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
