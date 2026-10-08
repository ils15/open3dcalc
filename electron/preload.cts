import { contextBridge, ipcRenderer } from "electron";
// Type-only: erased at compile time, so this adds no runtime require across the
// CJS/ESM boundary. `resolution-mode: import` is required by TS1541 because
// preload.cts is CommonJS and the source module is ESM. The desktop re-home's
// read contract is derived from the main-process reader, so a change to the
// report shape is a compile error here rather than a silently narrower IPC
// contract.
import type { LegacyPiiRowsReport } from "./legacyRows.js" with {
  "resolution-mode": "import",
};

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
      ipcRenderer.invoke("db:load", key),

    /** Save a key-value pair to the store. Creates or updates. */
    save: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke("db:save", key, value),

    /** Delete a key and its value from the store. */
    delete: (key: string): Promise<void> =>
      ipcRenderer.invoke("db:delete", key),

    /** List existing keys only from the exact app-owned non-PII allowlist. */
    listKeys: (): Promise<string[]> => ipcRenderer.invoke("db:list-keys"),

    /**
     * Internal diagnostic export; requires the explicit main-process gate.
     * It may contain legacy PII and is blocked while erasure is active/invalid.
     */
    exportDatabase: (): Promise<string> => ipcRenderer.invoke("db:export"),

    /**
     * Legacy contract retained for compatibility. Main rejects imports while
     * legacy PII isolation is enforced; it does not open a dialog or replace DB.
     */
    importDatabase: (_filePath?: string): Promise<string> =>
      ipcRenderer.invoke("db:import"),
  },

  updater: {
    /** Check whether a newer version is available. */
    check: (): Promise<{
      available: boolean;
      version?: string;
      releaseNotes?: string;
    }> => ipcRenderer.invoke("update:check"),

    /** Start downloading the available update. */
    download: (): Promise<void> => ipcRenderer.invoke("update:download"),

    /** Quit the app and install the downloaded update. */
    install: (): Promise<void> => ipcRenderer.invoke("update:install"),

    /** Persist a version to be skipped on future checks. */
    skip: (version: string): Promise<void> =>
      ipcRenderer.invoke("update:skip", version),

    /** Return the current update status. */
    getStatus: (): Promise<{
      status: string;
      progress?: number;
      version?: string;
    }> => ipcRenderer.invoke("update:get-status"),

    /** Listen for download progress events. */
    onProgress: (
      callback: (data: {
        percent: number;
        bytesPerSecond: number;
        total: number;
        transferred: number;
      }) => void,
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          percent: number;
          bytesPerSecond: number;
          total: number;
          transferred: number;
        },
      ) => callback(data);
      ipcRenderer.on("update:progress", handler);
      return () => ipcRenderer.removeListener("update:progress", handler);
    },

    /** Listen for update-available events. */
    onAvailable: (
      callback: (data: { version: string; releaseNotes?: string }) => void,
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { version: string; releaseNotes?: string },
      ) => callback(data);
      ipcRenderer.on("update:available", handler);
      return () => ipcRenderer.removeListener("update:available", handler);
    },

    /** Listen for update-downloaded events. */
    onDownloaded: (
      callback: (data: { version: string }) => void,
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { version: string },
      ) => callback(data);
      ipcRenderer.on("update:downloaded", handler);
      return () => ipcRenderer.removeListener("update:downloaded", handler);
    },

    /** Listen for update errors. */
    onError: (callback: (data: { message: string }) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { message: string },
      ) => callback(data);
      ipcRenderer.on("update:error", handler);
      return () => ipcRenderer.removeListener("update:error", handler);
    },

    /** Listen for no-update-available reports. */
    onNotAvailable: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on("update:not-available", handler);
      return () => ipcRenderer.removeListener("update:not-available", handler);
    },

    /** Listen for checking-for-update events. */
    onChecking: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on("update:checking", handler);
      return () => ipcRenderer.removeListener("update:checking", handler);
    },
  },

  crypto: {
    /**
     * Current ADR-001 §2.3 capability decision. Probe results stay in the
     * main process; no key material or passphrase crosses IPC.
     */
    capability: (): Promise<{
      mode: "safe_storage" | "passphrase" | "denied";
      piiPersistence: "encrypted_at_rest" | "denied";
      reason: string;
    }> => ipcRenderer.invoke("crypto:capability"),

    /**
     * Adopt the session passphrase into main-process memory only
     * (SPEC-01 `session_passphrase_key`). Never echoed back, never
     * persisted, never logged.
     */
    setPassphrase: (passphrase: string): Promise<void> =>
      ipcRenderer.invoke("crypto:set-passphrase", passphrase),

    /** Zeroize the session passphrase (irreversible). */
    lock: (): Promise<void> => ipcRenderer.invoke("crypto:lock"),
  },

  piiNew: {
    /**
     * The OS-keyring gate verdict for the passwordless new-PII route. Main
     * runs the §3.4 backend gate plus the pre-hydration self-test; no key
     * material or value crosses this call.
     */
    capability: (): Promise<{
      available: boolean;
      backend?: string;
      reason?: string;
    }> => ipcRenderer.invoke("pii:new:capability"),

    /**
     * Open a NEW-namespace PII record. Returns null when absent. Legacy keys
     * and non-new rows are refused by main; the renderer never sees them here.
     */
    load: (key: string): Promise<string | null> =>
      ipcRenderer.invoke("pii:new:load", key),

    /**
     * Seal and store a NEW-namespace PII record. The value is encrypted in the
     * main process BEFORE any SQLite write; a denied gate rejects.
     */
    save: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke("pii:new:save", key, value),
  },

  erasure: {
    /** Persist/validate the authorization barrier before renderer-side work. */
    authorize: (): Promise<{ token: string }> =>
      ipcRenderer.invoke("erasure:authorize"),

    /** Consume a one-use authorization and receive its approved plan. */
    claim: (
      token: string,
    ): Promise<{
      targets: Array<{ surface: string; id: string }>;
    }> => ipcRenderer.invoke("erasure:claim", token),

    /** Continue the main-process saga; renderer report is never proof. */
    start: (
      token: string,
      rendererReport?: Record<
        string,
        { purged: number; remaining: string[] } | undefined
      >,
    ): Promise<{
      receipt: {
        saga_id: string;
        committed_at: string;
        policy_version: string;
        stores_completed: string[];
        external_copies_notice: string[];
        rollback_unavailable?: { reason: string; at: string };
      };
      rolledBack: boolean;
    }> => ipcRenderer.invoke("erasure:start", token, rendererReport),

    /** Metadata-only status and capability gate. */
    status: (): Promise<{
      active: boolean;
      available: boolean;
      blockerCodes: string[];
      state?: string;
      stores?: Array<{ store: string; state: string; attempts: number }>;
    }> => ipcRenderer.invoke("erasure:status"),
  },

  privacy: {
    // These legacy UI contracts remain temporarily for preload/type
    // compatibility. The main process rejects them without opening SQLite;
    // callers are removed in the dedicated privacy-UI wave.
    //
    // The scan/quarantine/recovery/recover-key stubs are GONE: the main process
    // rejects every one of them, so exposing them only advertised a renderer
    // capability the app permanently refuses. The remaining three are still
    // reachable from renderer code paths that fail closed on the main-process
    // refusal (the desktop re-home's read-only reader is the live one).
    /**
     * Obsolete legacy-key migration. Main rejects this call without modifying rows.
     */
    migrateKey: (
      key: string,
    ): Promise<{ key: string; migrated: boolean; verified: boolean }> =>
      ipcRenderer.invoke("privacy:migrate-key", key),

    /**
     * Obsolete per-key elimination. Use the explicit delete-all saga instead.
     */
    eliminateKey: (
      key: string,
    ): Promise<{ key: string; eliminated: boolean }> =>
      ipcRenderer.invoke("privacy:eliminate-key", key),

    /**
     * Obsolete raw legacy-PII reader. Main rejects this call without reading
     * stored values; the renderer privacy/re-home mounts must be removed next.
     */
    legacyRows: (): Promise<LegacyPiiRowsReport> =>
      ipcRenderer.invoke("privacy:legacy-rows"),
  },
} as const;

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
