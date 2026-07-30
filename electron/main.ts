import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { initDatabase, getDbPath } from '../db/database.js';
import {
  initUpdateService,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  skipVersion,
  getUpdateStatus,
} from './update.js';

// ESM compatibility: __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const isDev = process.env.NODE_ENV === 'development';

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
  return path.join(app.getPath('userData'), 'window-state.json');
}

async function loadWindowState(): Promise<WindowState> {
  try {
    const raw = await fs.readFile(windowStatePath(), 'utf-8');
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
    title: 'Open3DCalc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };

  mainWindow = new BrowserWindow(options);

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

  mainWindow.on('resize', trackState);
  mainWindow.on('move', trackState);
  mainWindow.on('close', trackState);

  // Load the renderer
  if (isDev) {
    // In development, load from the Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load from the built files
    await mainWindow.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'index.desktop.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
}

/* ------------------------------------------------------------------ */
/*  IPC Handlers                                                       */
/* ------------------------------------------------------------------ */

let db: ReturnType<typeof initDatabase>

function setupIpcHandlers(): void {
  try {
    db = initDatabase()
    console.log('[main] Database initialized')
  } catch (error: unknown) {
    console.error('[main] Failed to initialize database:', error)
    // Don't throw - register handlers anyway, they'll fail gracefully
    // But create a null db object so handlers return meaningful errors
    db = {} as ReturnType<typeof initDatabase>
  }

  // ── db:load ──────────────────────────────────────────────────────
  ipcMain.handle('db:load', async (_event, key: string): Promise<string | null> => {
    try {
      if (typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Key must be a non-empty string');
      }
      // Use the storage table — key/value pairs
      const stmt = db.$client.prepare('SELECT value FROM storage WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? row.value : null;
    } catch (error) {
      console.error('[db:load] Error:', error);
      throw error;
    }
  });

  // ── db:save ──────────────────────────────────────────────────────
  ipcMain.handle('db:save', async (_event, key: string, value: string): Promise<void> => {
    try {
      if (typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Key must be a non-empty string');
      }
      if (typeof value !== 'string') {
        throw new Error('Value must be a string');
      }
      const stmt = db.$client.prepare(
        'INSERT INTO storage (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      );
      stmt.run(key, value, Date.now());
    } catch (error) {
      console.error('[db:save] Error:', error);
      throw error;
    }
  });

  // ── db:delete ────────────────────────────────────────────────────
  ipcMain.handle('db:delete', async (_event, key: string): Promise<void> => {
    try {
      if (typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Key must be a non-empty string');
      }
      const stmt = db.$client.prepare('DELETE FROM storage WHERE key = ?');
      stmt.run(key);
    } catch (error) {
      console.error('[db:delete] Error:', error);
      throw error;
    }
  });

  // ── db:list-keys ─────────────────────────────────────────────────
  ipcMain.handle('db:list-keys', async (): Promise<string[]> => {
    try {
      const stmt = db.$client.prepare('SELECT key FROM storage ORDER BY key');
      const rows = stmt.all() as Array<{ key: string }>;
      return rows.map((r) => r.key);
    } catch (error) {
      console.error('[db:list-keys] Error:', error);
      throw error;
    }
  });



  // ── db:export ────────────────────────────────────────────────────
  ipcMain.handle('db:export', async (): Promise<string> => {
    try {
      const dbPath = getDbPath();

      if (!mainWindow) {
        throw new Error('No active window');
      }

      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar Banco de Dados',
        defaultPath: `open3dcalc-backup-${new Date().toISOString().slice(0, 10)}.sqlite3`,
        filters: [
          { name: 'SQLite Database', extensions: ['sqlite3', 'db'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Export cancelled');
      }

      await fs.copyFile(dbPath, result.filePath);
      return result.filePath;
    } catch (error) {
      console.error('[db:export] Error:', error);
      throw error;
    }
  });

  // ── update:check ────────────────────────────────────────────────────
  ipcMain.handle('update:check', async (): Promise<{ available: boolean; version?: string; releaseNotes?: string }> => {
    try {
      return await checkForUpdates();
    } catch (error) {
      console.error('[update:check] Error:', error);
      throw error;
    }
  });

  // ── update:download ──────────────────────────────────────────────────
  ipcMain.handle('update:download', async (): Promise<void> => {
    await downloadUpdate();
  });

  // ── update:install ───────────────────────────────────────────────────
  ipcMain.handle('update:install', async (): Promise<void> => {
    installUpdate();
  });

  // ── update:get-status ────────────────────────────────────────────────
  ipcMain.handle('update:get-status', async (): Promise<{ status: string; progress?: number; version?: string }> => {
    return getUpdateStatus();
  });

  // ── update:skip ─────────────────────────────────────────────────────
  ipcMain.handle('update:skip', async (_event, version: string): Promise<void> => {
    if (typeof version !== 'string' || version.trim().length === 0) {
      throw new Error('Version must be a non-empty string');
    }
    skipVersion(version);
  });

  // ── db:import ────────────────────────────────────────────────────
  ipcMain.handle('db:import', async (_event, filePath: string): Promise<void> => {
    try {
      if (typeof filePath !== 'string' || filePath.trim().length === 0) {
        throw new Error('File path must be a non-empty string');
      }

      const dbPath = getDbPath();

      // Verify the source file exists
      await fs.access(filePath, fs.constants.R_OK);

      // Close the database and replace the file
      db.$client.close();

      // Create a backup of the current DB before replacing
      const backupPath = `${dbPath}.backup-${Date.now()}`;
      try {
        await fs.copyFile(dbPath, backupPath);
      } catch {
        // If current DB doesn't exist yet, that's fine
      }

      // Copy the imported file over
      await fs.copyFile(filePath, dbPath);

      // Reopen the database (next operation will trigger reconnect)
      console.log(`Database imported from ${filePath}. Backup saved at ${backupPath}`);
    } catch (error) {
      console.error('[db:import] Error:', error);
      throw error;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  App lifecycle                                                      */
/* ------------------------------------------------------------------ */

// ===== GLOBAL ERROR HANDLERS =====
process.on('uncaughtException', (error: Error) => {
  console.error('[main] Uncaught exception:', error)
  dialog.showErrorBox('Unexpected Error', `An unexpected error occurred:\n\n${(error as Error)?.message ?? String(error)}\n\nThe application will now exit.`)
  app.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[main] Unhandled rejection:', reason)
  const message = reason instanceof Error ? reason.message : String(reason)
  dialog.showErrorBox('Unhandled Error', `An unhandled error occurred:\n\n${message}\n\nCheck the logs for details.`)
})

app.whenReady().then(async () => {
  try {
    setupIpcHandlers()
    await createWindow()
    if (mainWindow) {
      initUpdateService(mainWindow, db)
    }
  } catch (error: unknown) {
    console.error('[main] Startup error:', error)
    dialog.showErrorBox('Startup Error', `Failed to start Open3DCalc:\n\n${(error as Error)?.message ?? String(error)}`)
    app.quit()
  }

  app.on('activate', async () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
