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
  closeDatabase,
  validateDatabaseFile,
  getDbPath,
} from "../db/database.js";
import {
  initUpdateService,
  setDatabase,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  skipVersion,
  getUpdateStatus,
} from "./update.js";

// ESM compatibility: __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const isDev = process.env.NODE_ENV === "development";

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

  // ── db:load ──────────────────────────────────────────────────────
  ipcMain.handle(
    "db:load",
    async (event, key: string): Promise<string | null> => {
      try {
        assertTrustedSender(event);
        if (typeof key !== "string" || key.trim().length === 0) {
          throw new Error("Key must be a non-empty string");
        }
        // Use the storage table — key/value pairs
        const stmt = db.$client.prepare(
          "SELECT value FROM storage WHERE key = ?",
        );
        const row = stmt.get(key) as { value: string } | undefined;
        return row ? row.value : null;
      } catch (error) {
        console.error("[db:load] Error:", error);
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
        const stmt = db.$client.prepare(
          "INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        );
        stmt.run(key, value, Date.now());
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
      const stmt = db.$client.prepare("DELETE FROM storage WHERE key = ?");
      stmt.run(key);
    } catch (error) {
      console.error("[db:delete] Error:", error);
      throw error;
    }
  });

  // ── db:list-keys ─────────────────────────────────────────────────
  ipcMain.handle("db:list-keys", async (event): Promise<string[]> => {
    try {
      assertTrustedSender(event);
      const stmt = db.$client.prepare("SELECT key FROM storage ORDER BY key");
      const rows = stmt.all() as Array<{ key: string }>;
      return rows.map((r) => r.key);
    } catch (error) {
      console.error("[db:list-keys] Error:", error);
      throw error;
    }
  });

  // ── db:export ────────────────────────────────────────────────────
  ipcMain.handle("db:export", async (event): Promise<string> => {
    try {
      assertTrustedSender(event);
      const dbPath = getDbPath();

      if (!mainWindow) {
        throw new Error("No active window");
      }

      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Exportar Banco de Dados",
        defaultPath: `open3dcalc-backup-${new Date().toISOString().slice(0, 10)}.sqlite3`,
        filters: [
          { name: "SQLite Database", extensions: ["sqlite3", "db"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error("Export cancelled");
      }

      // Checkpoint first so the exported single file includes all WAL data
      // (otherwise the copy could silently omit recent writes).
      if (db && db.$client) {
        db.$client.pragma("wal_checkpoint(TRUNCATE)");
      }

      await fs.copyFile(dbPath, result.filePath);
      return result.filePath;
    } catch (error) {
      console.error("[db:export] Error:", error);
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

  // ── db:import ────────────────────────────────────────────────────
  //
  // Safe-swap strategy (documented decision):
  // The drizzle singleton is re-initialized for real after the swap via
  // closeDatabase() + initDatabase(). To make the reconnect reliable we
  // never touch the live DB before validating a candidate copy:
  //   1. The user picks the file via a native dialog (no renderer path).
  //   2. The source is copied to a temp file in the same directory, the
  //      live DB is checkpointed+closed, and the temp is validated
  //      (integrity / foreign keys / required tables) BEFORE any swap.
  //   3. Only after validation does the temp atomically replace the live
  //      DB; orphan -wal/-shm of the old DB are removed first.
  //   4. The singleton is re-opened with initDatabase(); if that fails,
  //      the pre-import backup is restored and the DB reconnected, and
  //      the import is rejected with a clear error.
  // Backups are pruned to the 3 most recent.
  ipcMain.handle("db:import", async (event): Promise<string> => {
    try {
      assertTrustedSender(event);

      const dbPath = getDbPath();
      const dbDir = path.dirname(dbPath);

      if (!mainWindow) {
        throw new Error("No active window");
      }

      // (a) Choose the file with a native dialog — never accept a path
      // from the renderer.
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Importar Banco de Dados",
        defaultPath: dbDir,
        properties: ["openFile"],
        filters: [
          { name: "SQLite Database", extensions: ["sqlite3", "db"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error("Import cancelled");
      }
      const sourcePath = result.filePaths[0];

      // Verify the source file exists and is readable
      await fs.access(sourcePath, fs.constants.R_OK);

      // Same-directory temp copy so the final swap is an atomic rename.
      const tempPath = path.join(dbDir, `.open3dcalc-import-${Date.now()}.tmp`);

      try {
        await fs.copyFile(sourcePath, tempPath);

        // Carry over a sibling WAL so manually-copied backups with
        // uncheckpointed data are still complete after validation.
        try {
          await fs.copyFile(`${sourcePath}-wal`, `${tempPath}-wal`);
        } catch {
          // No sibling WAL — normal case.
        }

        // (b) Validate the candidate BEFORE touching the live DB.
        validateDatabaseFile(tempPath);

        // Create a backup of the current DB before replacing. Checkpoint
        // first so the backup copy includes all WAL data.
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        if (db && db.$client) {
          db.$client.pragma("wal_checkpoint(TRUNCATE)");
        }
        try {
          await fs.copyFile(dbPath, backupPath);
        } catch {
          // If the current DB doesn't exist yet, that's fine.
        }

        // Close the live connection and reset the singleton so it can be
        // reopened (this is what makes the reconnect real).
        closeDatabase();

        // Remove orphan -wal/-shm of the OLD database (they were
        // checkpointed and the connection closed, so deletion is safe).
        await fs.rm(`${dbPath}-wal`, { force: true }).catch(() => {});
        await fs.rm(`${dbPath}-shm`, { force: true }).catch(() => {});

        // Atomic swap: temp → live DB path.
        try {
          await fs.rename(tempPath, dbPath);
        } catch {
          // Fallback for filesystems that can't rename over an existing
          // file: copy + remove.
          await fs.copyFile(tempPath, dbPath);
          await fs.rm(tempPath, { force: true }).catch(() => {});
        }

        // (c) Reconnect for real.
        try {
          db = initDatabase();
          // The updater service keeps its own reference to the database —
          // rebind it so skipVersion()/checkForUpdates() don't keep using
          // the handle whose client was closed above.
          setDatabase(db);
        } catch (error) {
          // Restore the pre-import database and reconnect, then reject
          // the import with a clear error.
          //
          // initDatabase() closes the connection it opened on failure, but
          // close anyway (defensive) BEFORE overwriting the file so the
          // restore never tries to copy over a still-open/locked handle.
          closeDatabase();

          // The backup copy MUST succeed: a silent failure would leave the
          // broken imported file in place and the retry below would just
          // re-open it.
          try {
            await fs.copyFile(backupPath, dbPath);
          } catch (restoreError) {
            const restoreMessage =
              restoreError instanceof Error
                ? restoreError.message
                : String(restoreError);
            console.error(
              "[db:import] Failed to restore pre-import backup:",
              restoreError,
            );
            throw new Error(
              `Import failed: could not open the imported database and the ` +
                `original database could not be restored automatically. ` +
                `Restore it manually from: ${backupPath} (${restoreMessage})`,
              { cause: restoreError },
            );
          }

          db = initDatabase();
          setDatabase(db);
          throw new Error(
            `Import failed: could not open the imported database. Original data restored. ` +
              `(${(error as Error)?.message ?? String(error)})`,
            { cause: error },
          );
        }

        // (d) Keep at most 3 backups, delete the oldest.
        await pruneBackups(dbPath, 3);

        console.log(
          `Database imported from ${sourcePath}. Backup saved at ${backupPath}`,
        );
        return dbPath;
      } finally {
        // Cleanup the temp copy and any sidecars it created.
        await fs.rm(tempPath, { force: true }).catch(() => {});
        await fs.rm(`${tempPath}-wal`, { force: true }).catch(() => {});
        await fs.rm(`${tempPath}-shm`, { force: true }).catch(() => {});
      }
    } catch (error) {
      console.error("[db:import] Error:", error);
      throw error;
    }
  });
}

/**
 * Deletes the oldest backups of a database file, keeping at most
 * `maxKeep` (backups are named `<db>.backup-<timestamp>`).
 */
async function pruneBackups(dbPath: string, maxKeep: number): Promise<void> {
  try {
    const dir = path.dirname(dbPath);
    const prefix = `${path.basename(dbPath)}.backup-`;
    const entries = (await fs.readdir(dir))
      .filter((f) => f.startsWith(prefix))
      .map((f) => path.join(dir, f));
    // Backup names embed a numeric timestamp — lexicographic sort is chronological.
    entries.sort((a, b) => b.localeCompare(a));
    for (const entry of entries.slice(maxKeep)) {
      await fs.rm(entry, { force: true }).catch(() => {});
    }
  } catch (error) {
    console.error("[db] Backup pruning failed:", error);
  }
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
