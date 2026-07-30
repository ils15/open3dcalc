/**
 * Persistence Bridge — syncs localStorage ↔ SQLite via Electron IPC.
 *
 * STRATEGY:
 *   - On startup: loads SQLite data into localStorage (stores hydrate as usual)
 *   - On first run: migrates existing localStorage → SQLite
 *   - On beforeunload: saves localStorage → SQLite
 *   - Periodic auto-save every 30 seconds as a safety net
 *
 * This allows all existing Zustand stores to work unchanged — they still
 * use localStorage, but the durable store is SQLite.
 *
 * IMPORTANT: This module uses `window.electronAPI.db` directly (raw string I/O)
 * rather than `dbBridge` (which adds JSON.parse/stringify). This avoids
 * double-serialization because localStorage already stores JSON strings.
 */

/* ------------------------------------------------------------------ */
/*  Error tracking                                                      */
/* ------------------------------------------------------------------ */

let consecutiveDbFailures = 0
const MAX_FAILURES_BEFORE_WARN = 5

/* ------------------------------------------------------------------ */
/*  Known localStorage keys used throughout the app                    */
/*  (Keep in sync with all stores, components, and migration logic)     */
/* ------------------------------------------------------------------ */

const LOCALSTORAGE_KEYS = [
  'open3dcalc_settings_v2',
  'open3dcalc_history_v2',
  'open3dcalc_customers_v1',
  'open3dcalc_quotes_v1',
  'open3dcalc_catalog_v1',
  'open3dcalc_filaments',
  'open3dcalc_consent_v1',
  'open3dcalc_tutorial_v1',
  'open3dcalc_onboarded',
  'open3dcalc_dashboard_v1',
  'open3dcalc_migration_done_v2',
  'open3dcalc_sections',
  'open3dcalc_theme',
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Check whether we're running inside Electron with the IPC bridge available.
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.db;
}

/**
 * Return the raw IPC db API. Throws if not in Electron — call `isElectron()` first.
 */
function db() {
  // Non-null assertion safe because caller must guard with isElectron()
  return window.electronAPI!.db;
}

/* ------------------------------------------------------------------ */
/*  Core operations                                                     */
/* ------------------------------------------------------------------ */

/**
 * Load all persisted data from SQLite into localStorage.
 * Called once at app startup (after any migration).
 *
 * Each SQLite value is stored as a JSON string, which is exactly
 * what localStorage expects — so we move the raw strings as-is.
 */
async function loadFromDatabase(): Promise<void> {
  try {
    const keys = await db().listKeys();
    let loaded = 0;

    for (const key of keys) {
      const raw = await db().load(key);
      if (raw !== null && raw !== undefined) {
        localStorage.setItem(key, raw);
        loaded++;
      }
    }

    console.log(
      `[persistence-bridge] Loaded ${loaded}/${keys.length} keys from SQLite`,
    );
  } catch (error) {
    console.warn(
      '[persistence-bridge] Failed to load from SQLite, using localStorage fallback:',
      error,
    );
    consecutiveDbFailures++
    if (consecutiveDbFailures === MAX_FAILURES_BEFORE_WARN) {
      if (typeof document !== 'undefined') {
        const event = new CustomEvent('open3dcalc:db-error', {
          detail: { message: 'Database unavailable — data will not persist between sessions.' }
        })
        document.dispatchEvent(event)
      }
    }
  }
}

/**
 * Save all localStorage data to SQLite.
 * Called on beforeunload and periodically (every 30 s).
 *
 * Moves JSON strings as-is from localStorage to SQLite.
 */
async function saveToDatabase(): Promise<void> {
  try {
    let saved = 0;

    // 1. Save known keys from the static list
    for (const key of LOCALSTORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        await db().save(key, raw);
        saved++;
      }
    }

    // 2. Also save any dynamic open3dcalc_ keys not in the static list
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        !LOCALSTORAGE_KEYS.includes(key as (typeof LOCALSTORAGE_KEYS)[number]) &&
        key.startsWith('open3dcalc_')
      ) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          await db().save(key, raw);
          saved++;
        }
      }
    }

    console.log(`[persistence-bridge] Saved ${saved} keys to SQLite`);
  } catch (error) {
    console.warn('[persistence-bridge] Failed to save to SQLite:', error);
    consecutiveDbFailures++
    if (consecutiveDbFailures === MAX_FAILURES_BEFORE_WARN) {
      if (typeof document !== 'undefined') {
        const event = new CustomEvent('open3dcalc:db-error', {
          detail: { message: 'Database unavailable — data will not persist between sessions.' }
        })
        document.dispatchEvent(event)
      }
    }
  }
}

/**
 * Delete keys from SQLite that are no longer in localStorage.
 * Keeps the two stores in sync when keys are removed at runtime.
 */
async function deleteStaleKeys(): Promise<void> {
  try {
    const dbKeys = await db().listKeys();
    const localKeys = new Set<string>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) localKeys.add(key);
    }

    for (const dbKey of dbKeys) {
      if (!localKeys.has(dbKey)) {
        await db().delete(dbKey);
      }
    }
  } catch (error) {
    console.warn('[persistence-bridge] Failed to clean stale keys:', error);
  }
}

/**
 * Migrate existing localStorage data to SQLite on first run.
 * Only runs if the SQLite storage table is empty (no keys yet).
 */
async function migrateIfNeeded(): Promise<void> {
  try {
    const existingKeys = await db().listKeys();

    if (existingKeys.length > 0) {
      // SQLite already has data — skip migration
      console.log(
        '[persistence-bridge] SQLite has data, skipping localStorage migration',
      );
      return;
    }

    // SQLite is empty — migrate from localStorage
    console.log(
      '[persistence-bridge] First run detected — migrating localStorage → SQLite',
    );
    await saveToDatabase();
  } catch (error) {
    console.warn('[persistence-bridge] Migration check failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Initialize the persistence bridge.
 *
 * Must be called ONCE at app startup, BEFORE React renders,
 * so that Zustand stores hydrate with SQLite-backed data.
 *
 * Call flow:
 *   1. Migrate localStorage → SQLite if first run
 *   2. Load SQLite data → localStorage (overwrites any stale localStorage)
 *   3. Register beforeunload handler for save-on-close
 *   4. Start periodic auto-save (every 30 seconds)
 */
export async function initPersistenceBridge(): Promise<void> {
  if (!isElectron()) {
    console.log(
      '[persistence-bridge] Not running in Electron — using localStorage only',
    );
    return;
  }

  // 1. Migrate localStorage → SQLite if first run
  await migrateIfNeeded();

  // 2. Load SQLite data into localStorage (overwrites any stale localStorage)
  await loadFromDatabase();

  // 3. Set up save-on-close via beforeunload
  //
  // NOTE: beforeunload fires when the window is about to close.
  // Electron's IPC invoke returns a Promise; we await it to flush.
  // As a safety net, the 30 s periodic save guards against data loss
  // if beforeunload doesn't fully complete.
  window.addEventListener('beforeunload', () => {
    saveToDatabase();
  });

  // 4. Periodic auto-save every 30 seconds (safety net)
  //    Also runs stale-key cleanup on each cycle.
  const AUTO_SAVE_INTERVAL_MS = 10_000;
  setInterval(async () => {
    await saveToDatabase();
    await deleteStaleKeys();
  }, AUTO_SAVE_INTERVAL_MS);

  console.log(
    '[persistence-bridge] Initialized — localStorage ↔ SQLite sync active',
  );
}

/**
 * Manual save trigger — exposed for use by explicit "Save" buttons
 * or before critical operations (e.g., import/export).
 */
export async function saveNow(): Promise<void> {
  if (!isElectron()) return;
  await saveToDatabase();
}

/**
 * Manual load trigger — reload all SQLite data into localStorage.
 * Useful after a database import.
 */
export async function loadNow(): Promise<void> {
  if (!isElectron()) return;
  await loadFromDatabase();
}
