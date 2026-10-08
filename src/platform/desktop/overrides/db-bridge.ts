/**
 * DB Bridge — abstracts IPC calls to the Electron main process.
 *
 * Used by `src/overrides/storage-adapter.ts` to replace
 * localStorage/IndexedDB with SQLite-backed persistence.
 *
 * All values are serialized/deserialized as JSON strings.
 */

import type { ElectronAPI } from "@/platform/desktop/types/electron";

function getAPI(): ElectronAPI["db"] {
  if (typeof window === "undefined" || !window.electronAPI?.db) {
    throw new Error(
      "window.electronAPI is not available. " +
        "Ensure the app is running inside Electron with the preload script loaded.",
    );
  }
  return window.electronAPI.db;
}

export const dbBridge = {
  /** Load a value by key. Returns the parsed value, or null if not found. */
  async load<T = unknown>(key: string): Promise<T | null> {
    const raw = await getAPI().load(key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  },

  /** Save a value (any serializable type) under a key. */
  async save(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    await getAPI().save(key, serialized);
  },

  /** Delete a value by key. */
  async delete(key: string): Promise<void> {
    await getAPI().delete(key);
  },

  /** List all keys. */
  async listKeys(): Promise<string[]> {
    return getAPI().listKeys();
  },
} as const;
