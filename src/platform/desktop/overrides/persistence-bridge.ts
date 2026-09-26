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

import { isKeyAllowed } from "@/shared/lib/manifestGate";

/* ------------------------------------------------------------------ */
/*  Error tracking                                                      */
/* ------------------------------------------------------------------ */

let consecutiveDbFailures = 0;
const MAX_FAILURES_BEFORE_WARN = 5;

/* ------------------------------------------------------------------ */
/*  Known localStorage keys used throughout the app                    */
/*  (Keep in sync with all stores, components, and migration logic)     */
/* ------------------------------------------------------------------ */

const LOCALSTORAGE_KEYS = [
  "open3dcalc_settings_v2",
  "open3dcalc_history_v2",
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_catalog_v1",
  "open3dcalc_filaments",
  "open3dcalc_color_palette_v1",
  "open3dcalc_consent_v1",
  "open3dcalc_tutorial_v1",
  "open3dcalc_onboarded",
  "open3dcalc_dashboard_v1",
  "open3dcalc_migration_done_v2",
  "open3dcalc_sections",
  "open3dcalc_theme",
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Check whether we're running inside Electron with the IPC bridge available.
 */
function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.db;
}

/**
 * Return the raw IPC db API. Throws if not in Electron — call `isElectron()` first.
 */
function db() {
  // Non-null assertion safe because caller must guard with isElectron()
  return window.electronAPI!.db;
}

/**
 * Return the known and manifest-approved localStorage source values once.
 * Capturing before the asynchronous writes keeps iteration stable while the
 * IPC adapter is saving rows.
 */
function collectLocalStorageEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const seen = new Set<string>();

  const collect = (key: string): void => {
    if (seen.has(key) || !isKeyAllowed(key)) return;
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    seen.add(key);
    entries.push([key, raw]);
  };

  for (const key of LOCALSTORAGE_KEYS) collect(key);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("open3dcalc_")) collect(key);
  }
  return entries;
}

function noteDbFailure(error: unknown, operation: string): void {
  console.warn(`[persistence-bridge] Failed to ${operation}:`, error);
  consecutiveDbFailures++;
  if (consecutiveDbFailures === MAX_FAILURES_BEFORE_WARN) {
    if (typeof document !== "undefined") {
      const event = new CustomEvent("open3dcalc:db-error", {
        detail: {
          message:
            "Database unavailable — data will not persist between sessions.",
        },
      });
      document.dispatchEvent(event);
    }
  }
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
  const keys = await db().listKeys();
  const values: Array<[string, string]> = [];

  for (const key of keys) {
    // SPEC-01 gate: unknown keys are never materialized locally.
    if (!isKeyAllowed(key)) continue;
    const raw = await db().load(key);
    if (raw !== null && raw !== undefined) values.push([key, raw]);
  }

  // Read every row successfully before touching localStorage. A DB read error
  // must reject startup without applying a partial hydration to the renderer.
  for (const [key, raw] of values) localStorage.setItem(key, raw);
  console.log(
    `[persistence-bridge] Loaded ${values.length}/${keys.length} keys from SQLite`,
  );
}

/**
 * Save all localStorage data to SQLite.
 * Called on beforeunload and periodically (every 30 s).
 *
 * Moves JSON strings as-is from localStorage to SQLite.
 */
async function saveToDatabase(): Promise<void> {
  const entries = collectLocalStorageEntries();
  for (const [key, raw] of entries) await db().save(key, raw);
  console.log(`[persistence-bridge] Saved ${entries.length} keys to SQLite`);
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
    console.warn("[persistence-bridge] Failed to clean stale keys:", error);
  }
}

/**
 * Import localStorage data when SQLite does not yet contain every approved
 * source key. This also resumes a previous import interrupted after any
 * committed prefix of per-key writes.
 */
async function migrateIfNeeded(): Promise<void> {
  const existingKeys = new Set(await db().listKeys());
  const sourceEntries = collectLocalStorageEntries();
  const missingSourceKeys = sourceEntries.some(
    ([key]) => !existingKeys.has(key),
  );

  if (!missingSourceKeys) {
    // SQLite is authoritative only when it already contains every allowed
    // source key. A theme seed or partial write must never suppress recovery.
    console.log(
      "[persistence-bridge] SQLite contains all localStorage source keys; skipping import",
    );
    return;
  }

  // Idempotent upserts make this restart-safe after any prefix of db.save
  // writes has committed. Failure intentionally propagates to abort renderer
  // startup; localStorage is left untouched until the entire import succeeds.
  console.log(
    "[persistence-bridge] SQLite is incomplete — migrating localStorage → SQLite",
  );
  for (const [key, raw] of sourceEntries) await db().save(key, raw);
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
      "[persistence-bridge] Not running in Electron — using localStorage only",
    );
    return;
  }

  try {
    // 1. Migrate localStorage → SQLite if first run or a prior startup was
    //    interrupted. Any partial failure rejects before renderer hydration.
    await migrateIfNeeded();

    // 2. Load SQLite data into localStorage only after the complete migration.
    await loadFromDatabase();
  } catch (error) {
    noteDbFailure(error, "initialize persistence bridge");
    throw error;
  }

  // 3. Set up save-on-close via beforeunload
  //
  // NOTE: beforeunload fires when the window is about to close.
  // Electron's IPC invoke returns a Promise; we await it to flush.
  // As a safety net, the 30 s periodic save guards against data loss
  // if beforeunload doesn't fully complete.
  window.addEventListener("beforeunload", () => {
    void saveToDatabase().catch((error: unknown) =>
      noteDbFailure(error, "save localStorage to SQLite"),
    );
  });

  // 4. Periodic auto-save every 30 seconds (safety net)
  //    Also runs stale-key cleanup on each cycle.
  const AUTO_SAVE_INTERVAL_MS = 10_000;
  setInterval(async () => {
    try {
      await saveToDatabase();
      await deleteStaleKeys();
    } catch (error) {
      noteDbFailure(error, "save localStorage to SQLite");
    }
  }, AUTO_SAVE_INTERVAL_MS);

  console.log(
    "[persistence-bridge] Initialized — localStorage ↔ SQLite sync active",
  );
}
