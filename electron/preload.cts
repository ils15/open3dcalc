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
 * Beta-channel gate for the preload bridge.
 *
 * Beta is a Web-only channel; Electron must expose no PII privacy surface.
 * Every PII method below refuses while `VITE_BETA_CHANNEL` is exactly
 * `"true"`, before any `ipcRenderer.invoke` — the main process refuses the
 * same channels independently, so a renderer that somehow bypassed this gate
 * still gets a refusal.
 *
 * This MIRRORS `isBetaElectronRuntime` in `electron/betaRuntime.ts` instead
 * of importing it: this file compiles to CJS (`preload.cjs`) while the helper
 * is ESM, and a synchronously-required bridge must not depend on a
 * cross-module-format require. Keep the exact-`"true"` comparison in sync with
 * the helper — parity is pinned by
 * `electron/__tests__/betaElectronGating.test.ts`.
 */
function isBetaPreloadRuntime(
  environment: { VITE_BETA_CHANNEL?: string } = process.env,
): boolean {
  return environment.VITE_BETA_CHANNEL === "true";
}

/**
 * Mirrors `BETA_ELECTRON_PII_REFUSAL` in `electron/betaRuntime.ts` verbatim.
 * It cannot be imported: this file compiles to CJS (`preload.cjs`) while the
 * helper is ESM, and a synchronously-required bridge must not depend on a
 * cross-module-format require. Keep the sentence in sync — parity is pinned by
 * `electron/__tests__/betaElectronGating.test.ts`.
 */
const BETA_ELECTRON_PII_REFUSAL =
  "Beta channel is Web-only; Electron PII IPC is disabled";

/**
 * Fail-closed refusal for one PII method on Beta. A rejected promise (rather
 * than a throw) so the failure surfaces as an async IPC refusal, exactly like
 * a main-process denial. `Promise<never>` is assignable to every method's
 * declared return type.
 */
function betaPiiUnavailable(channel: string): Promise<never> {
  return Promise.reject(
    new Error(`[beta] ${channel} is unavailable: ${BETA_ELECTRON_PII_REFUSAL}`),
  );
}

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
     * Unavailable on Beta (Web-only channel).
     */
    exportDatabase: (): Promise<string> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("db:export")
        : ipcRenderer.invoke("db:export"),

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

  piiNew: {
    /**
     * Availability of the exact-key Desktop plaintext route. No storage value
     * or key material crosses this metadata-only call.
     * Unavailable on Beta (Web-only channel).
     */
    capability: (): Promise<{
      available: boolean;
      backend?: string;
      reason?: string;
    }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("pii:new:capability")
        : ipcRenderer.invoke("pii:new:capability"),

    /**
     * Open a NEW-namespace PII record. Returns null when absent. Legacy keys
     * and non-new rows are refused by main; the renderer never sees them here.
     * Unavailable on Beta (Web-only channel).
     */
    load: (key: string): Promise<string | null> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("pii:new:load")
        : ipcRenderer.invoke("pii:new:load", key),

    /**
     * Store a validated plaintext Zustand envelope under an exact new-PII key.
     * Unavailable on Beta (Web-only channel).
     */
    save: (key: string, value: string): Promise<void> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("pii:new:save")
        : ipcRenderer.invoke("pii:new:save", key, value),
  },

  erasure: {
    /** Persist/validate the authorization barrier before renderer-side work. */
    authorize: (): Promise<{ token: string }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("erasure:authorize")
        : ipcRenderer.invoke("erasure:authorize"),

    /** Consume a one-use authorization and receive its approved plan. */
    claim: (
      token: string,
    ): Promise<{
      targets: Array<{ surface: string; id: string }>;
    }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("erasure:claim")
        : ipcRenderer.invoke("erasure:claim", token),

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
    }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("erasure:start")
        : ipcRenderer.invoke("erasure:start", token, rendererReport),

    /** Metadata-only status and capability gate. */
    status: (): Promise<{
      active: boolean;
      available: boolean;
      blockerCodes: string[];
      state?: string;
      stores?: Array<{ store: string; state: string; attempts: number }>;
    }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("erasure:status")
        : ipcRenderer.invoke("erasure:status"),

    /**
     * EXACT new-namespace delete-all (Beta12 follow-up). Erases ONLY the three
     * passwordless new-PII storage rows through a durable one-use nonce; legacy
     * rows, domain tables and mixed backups stay unavailable.
     */
    newPii: {
      authorize: (): Promise<{
        token: string;
        expiresAt: string;
        targets: Array<{ surface: string; id: string }>;
      }> =>
        isBetaPreloadRuntime()
          ? betaPiiUnavailable("erasure:new-pii:authorize")
          : ipcRenderer.invoke("erasure:new-pii:authorize"),

      claim: (
        token: string,
      ): Promise<{ targets: Array<{ surface: string; id: string }> }> =>
        isBetaPreloadRuntime()
          ? betaPiiUnavailable("erasure:new-pii:claim")
          : ipcRenderer.invoke("erasure:new-pii:claim", token),

      start: (
        token: string,
      ): Promise<{
        request_id: string;
        completed_at: string;
        purged: string[];
      }> =>
        isBetaPreloadRuntime()
          ? betaPiiUnavailable("erasure:new-pii:start")
          : ipcRenderer.invoke("erasure:new-pii:start", token),

      status: (): Promise<{
        active: boolean;
        available: boolean;
        blockerCodes: string[];
        state?: string;
        targets: Array<{ surface: string; id: string }>;
      }> =>
        isBetaPreloadRuntime()
          ? betaPiiUnavailable("erasure:new-pii:status")
          : ipcRenderer.invoke("erasure:new-pii:status"),
    },
  },

  withdrawal: {
    /**
     * Persist a durable, receipt-scoped withdrawal journal and return its
     * one-use nonce. Only the new-PII targets in the receipt scope are bound.
     * Unavailable on Beta (Web-only channel).
     */
    request: (input: {
      receiptId: string;
      scope: string[];
    }): Promise<{
      token: string;
      expiresAt: string;
      targets: Array<{ surface: string; id: string }>;
    }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("withdrawal:request")
        : ipcRenderer.invoke("withdrawal:request", input),

    /**
     * Consume the nonce, purge ONLY the linked new-PII rows and complete the
     * withdrawal on a verified postcondition.
     * Unavailable on Beta (Web-only channel).
     */
    purge: (
      token: string,
    ): Promise<
      { ok: true; purged: string[] } | { ok: false; reason: string }
    > =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("withdrawal:purge")
        : ipcRenderer.invoke("withdrawal:purge", token),
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
     * Unavailable on Beta (Web-only channel) — the preload refuses first.
     */
    migrateKey: (
      key: string,
    ): Promise<{ key: string; migrated: boolean; verified: boolean }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("privacy:migrate-key")
        : ipcRenderer.invoke("privacy:migrate-key", key),

    /**
     * Obsolete per-key elimination. Use the explicit delete-all saga instead.
     * Unavailable on Beta (Web-only channel) — the preload refuses first.
     */
    eliminateKey: (
      key: string,
    ): Promise<{ key: string; eliminated: boolean }> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("privacy:eliminate-key")
        : ipcRenderer.invoke("privacy:eliminate-key", key),

    /**
     * Obsolete raw legacy-PII reader. Main rejects this call without reading
     * stored values; the renderer privacy/re-home mounts must be removed next.
     * Unavailable on Beta (Web-only channel) — the preload refuses first.
     */
    legacyRows: (): Promise<LegacyPiiRowsReport> =>
      isBetaPreloadRuntime()
        ? betaPiiUnavailable("privacy:legacy-rows")
        : ipcRenderer.invoke("privacy:legacy-rows"),
  },
} as const;

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
