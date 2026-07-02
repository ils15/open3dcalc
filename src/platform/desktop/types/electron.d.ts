/**
 * Type declarations for the Electron contextBridge API.
 *
 * These types mirror the API exposed by `electron/preload.ts`
 * and consumed by `src/overrides/db-bridge.ts`.
 */

declare global {
  /** Database operations available through IPC. */
  interface ElectronDBApi {
    /** Load a JSON-encoded value from the key-value store by key. */
    load(key: string): Promise<string | null>;

    /** Save a JSON-encoded value to the key-value store. */
    save(key: string, value: string): Promise<void>;

    /** Delete a key and its value from the store. */
    delete(key: string): Promise<void>;

    /** List all keys in the store, sorted alphabetically. */
    listKeys(): Promise<string[]>;

    /**
     * Run a raw SQL query (SELECT / PRAGMA / EXPLAIN only).
     * Write operations must use the dedicated save/delete helpers.
     */
    query(sql: string, params?: unknown[]): Promise<unknown[]>;

    /** Open a save dialog and export the database file. Returns the chosen path. */
    exportDatabase(): Promise<string>;

    /** Import a database from a backup file, replacing the current one. */
    importDatabase(filePath: string): Promise<void>;
  }

  /** Update-check operations available through IPC. */
  interface ElectronUpdaterApi {
    /** Check for available updates. */
    check: () => Promise<{ available: boolean; version?: string; releaseNotes?: string }>;

    /** Start downloading the update. */
    download: () => Promise<void>;

    /** Install the downloaded update and restart. */
    install: () => Promise<void>;

    /** Skip a specific version. */
    skip: (version: string) => Promise<void>;

    /** Get the current updater status. */
    getStatus: () => Promise<{ status: string; progress?: number; version?: string }>;

    /** Listen for download progress events. Returns an unsubscribe function. */
    onProgress: (callback: (data: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => () => void;

    /** Listen for update-available events. Returns an unsubscribe function. */
    onAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => () => void;

    /** Listen for update-downloaded events. Returns an unsubscribe function. */
    onDownloaded: (callback: (data: { version: string }) => void) => () => void;

    /** Listen for updater errors. Returns an unsubscribe function. */
    onError: (callback: (data: { message: string }) => void) => () => void;

    /** Listen for update-not-available events. Returns an unsubscribe function. */
    onNotAvailable: (callback: () => void) => () => void;

    /** Listen for checking-for-update events. Returns an unsubscribe function. */
    onChecking: (callback: () => void) => () => void;
  }

  /** Augment the global Window interface. */
  interface Window {
    /** Electron context-bridge API. Only available in Electron. */
    electronAPI?: ElectronAPI;
  }
}

/** Full Electron API exposed via contextBridge. */
export interface ElectronAPI {
  db: ElectronDBApi;
  updater: ElectronUpdaterApi;
}
