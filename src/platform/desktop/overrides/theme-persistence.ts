/**
 * Theme Persistence — saves/loads user theme preference.
 *
 * Storage strategy:
 *   - Electron: localStorage (renderer) ↔ SQLite `storage` table (durable)
 *     The persistence-bridge handles the sync automatically for all
 *     `open3dcalc_*` keys on startup, beforeunload, and every 30 s.
 *   - Browser dev mode: localStorage only (no Electron IPC).
 *
 * The renderer always reads/writes localStorage first (synchronous),
 * then fires-and-forgets the SQLite write for durability.
 */

import { guardedStorage } from "@/shared/lib/manifestStorage";

export type ThemeMode = "dark" | "light" | "system";

const THEME_KEY = "open3dcalc_theme";

const VALID_MODES: readonly ThemeMode[] = ["dark", "light", "system"];
/** Type guard — narrows a string to ThemeMode. */
function isThemeMode(value: string): value is ThemeMode {
  return (VALID_MODES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/*  Electron IPC helpers                                               */
/* ------------------------------------------------------------------ */

function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.db;
}

/** Fire-and-forget SQLite write via IPC. Errors logged, never thrown. */
function persistToSQLite(mode: ThemeMode): void {
  if (!isElectron()) return;
  window.electronAPI!.db.save(THEME_KEY, mode).catch((err) => {
    console.warn("[theme-persistence] Failed to persist to SQLite:", err);
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Load the persisted theme preference.
 *
 * Read order:
 *   1. SQLite via Electron IPC (durable, if available)
 *   2. localStorage (fast, may lag behind SQLite on fresh install)
 *   3. Default: 'system'
 */
export async function loadThemePreference(): Promise<ThemeMode> {
  // 1. Try SQLite (most durable source)
  if (isElectron()) {
    try {
      const raw = await window.electronAPI!.db.load(THEME_KEY);
      if (raw !== null && isThemeMode(raw)) {
        // Sync to localStorage so the value is immediately available
        guardedStorage.setItem(THEME_KEY, raw);
        return raw;
      }
    } catch (err) {
      console.warn(
        "[theme-persistence] SQLite load failed, falling back:",
        err,
      );
    }
  }

  // 2. Fallback to localStorage
  const stored = guardedStorage.getItem(THEME_KEY);
  if (stored !== null && isThemeMode(stored)) {
    // If Electron is available, push to SQLite in background
    persistToSQLite(stored);
    return stored;
  }

  // 3. Default
  return "system";
}

/**
 * Save the theme preference.
 *
 * Write order:
 *   1. localStorage (synchronous, immediate)
 *   2. SQLite via Electron IPC (async, fire-and-forget)
 */
export async function saveThemePreference(mode: ThemeMode): Promise<void> {
  if (!isThemeMode(mode)) {
    console.error(`[theme-persistence] Invalid theme mode: "${mode}"`);
    return;
  }

  // 1. localStorage — immediate availability
  guardedStorage.setItem(THEME_KEY, mode);

  // 2. SQLite — durable persistence
  persistToSQLite(mode);
}
