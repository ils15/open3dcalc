import { contextBridge, ipcRenderer } from 'electron';

/**
 * Type-safe API exposed to the renderer process via contextBridge.
 *
 * All methods are async — they return Promises that resolve/reject
 * based on the IPC handler response from the main process.
 */
const electronAPI = {
  db: {
    /** Load a value from the key-value store by key. Returns null if not found. */
    load: (key: string): Promise<string | null> =>
      ipcRenderer.invoke('db:load', key),

    /** Save a key-value pair to the store. Creates or updates. */
    save: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('db:save', key, value),

    /** Delete a key and its value from the store. */
    delete: (key: string): Promise<void> =>
      ipcRenderer.invoke('db:delete', key),

    /** List all keys in the key-value store, sorted alphabetically. */
    listKeys: (): Promise<string[]> =>
      ipcRenderer.invoke('db:list-keys'),

    /**
     * Export the database file to a user-chosen location.
     * Returns the destination file path on success.
     */
    exportDatabase: (): Promise<string> =>
      ipcRenderer.invoke('db:export'),

    /**
     * Import a database from an external backup file.
     * The file is chosen via a native dialog in the main process — any
     * renderer-supplied path argument is ignored. Replaces the current
     * database; a backup of the current DB is created before the swap.
     * Returns the path of the imported database on success.
     */
    importDatabase: (_filePath?: string): Promise<string> =>
      ipcRenderer.invoke('db:import'),
  },

  updater: {
    /** Check whether a newer version is available. */
    check: (): Promise<{ available: boolean; version?: string; releaseNotes?: string }> =>
      ipcRenderer.invoke('update:check'),

    /** Start downloading the available update. */
    download: (): Promise<void> =>
      ipcRenderer.invoke('update:download'),

    /** Quit the app and install the downloaded update. */
    install: (): Promise<void> =>
      ipcRenderer.invoke('update:install'),

    /** Persist a version to be skipped on future checks. */
    skip: (version: string): Promise<void> =>
      ipcRenderer.invoke('update:skip', version),

    /** Return the current update status. */
    getStatus: (): Promise<{ status: string; progress?: number; version?: string }> =>
      ipcRenderer.invoke('update:get-status'),

    /** Listen for download progress events. */
    onProgress: (callback: (data: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => callback(data);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },

    /** Listen for update-available events. */
    onAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { version: string; releaseNotes?: string }) => callback(data);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },

    /** Listen for update-downloaded events. */
    onDownloaded: (callback: (data: { version: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { version: string }) => callback(data);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },

    /** Listen for update errors. */
    onError: (callback: (data: { message: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { message: string }) => callback(data);
      ipcRenderer.on('update:error', handler);
      return () => ipcRenderer.removeListener('update:error', handler);
    },

    /** Listen for no-update-available reports. */
    onNotAvailable: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('update:not-available', handler);
      return () => ipcRenderer.removeListener('update:not-available', handler);
    },

    /** Listen for checking-for-update events. */
    onChecking: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('update:checking', handler);
      return () => ipcRenderer.removeListener('update:checking', handler);
    },
  },
} as const;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
