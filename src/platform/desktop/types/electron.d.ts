/**
 * Type declarations for the Electron contextBridge API.
 *
 * These types mirror the API exposed by `electron/preload.ts`
 * and consumed by `src/overrides/db-bridge.ts`.
 */

// Type-only: derives the legacy-rows contract from the main-process reader, so
// a change to the report shape is a compile error here, not a silent drift.
import type { LegacyPiiRowsReport } from "../../../../electron/legacyRows.js";

/** Database operations available through IPC. */
/** Full Electron API exposed via contextBridge. */
export interface ElectronAPI {
  db: ElectronDBApi;
  updater: ElectronUpdaterApi;
  crypto: ElectronCryptoApi;
  privacy: ElectronPrivacyApi;
  erasure: ElectronErasureApi;
  piiNew: ElectronPiiNewApi;
}

/**
 * Desktop passwordless new-PII route (Beta12 Phase3). Main-only encryption
 * under the OS-keyring-wrapped profile data key; disjoint key namespace.
 */
declare global {
  interface ElectronPiiNewApi {
    /** OS-keyring gate verdict for the passwordless route. */
    capability: () => Promise<{
      available: boolean;
      backend?: string;
      reason?: string;
    }>;

    /** Open a NEW-namespace PII record, or null when absent. */
    load: (key: string) => Promise<string | null>;

    /** Seal and store a NEW-namespace PII record (encrypted before SQL). */
    save: (key: string, value: string) => Promise<void>;
  }
}

/** Erasure saga operations available through IPC (D1.1 S7). */
declare global {
  interface ElectronErasureApi {
    /** Persist an authorization barrier before any renderer deletion. */
    authorize: () => Promise<{ token: string }>;
    /** Consume a one-use authorization and return its approved target plan. */
    claim: (
      token: string,
    ) => Promise<{ targets: Array<{ surface: string; id: string }> }>;
    start: (
      token: string,
      rendererReport?: Record<
        string,
        { purged: number; remaining: string[] } | undefined
      >,
    ) => Promise<{
      receipt: {
        saga_id: string;
        committed_at: string;
        policy_version: string;
        stores_completed: string[];
        external_copies_notice: string[];
        rollback_unavailable?: { reason: string; at: string };
      };
      rolledBack: boolean;
    }>;
    status: () => Promise<{
      active: boolean;
      available: boolean;
      blockerCodes: string[];
      state?: string;
      stores?: Array<{ store: string; state: string; attempts: number }>;
    }>;
  }
}

/** Privacy IPC includes legacy UI contracts explicitly rejected by main. */
declare global {
  interface ElectronPrivacyApi {
    /**
     * Obsolete legacy-key migration; main rejects it without modifying rows.
     */
    migrateKey: (
      key: string,
    ) => Promise<{ key: string; migrated: boolean; verified: boolean }>;

    /**
     * Obsolete per-key elimination; use the explicit delete-all saga instead.
     */
    eliminateKey: (
      key: string,
    ) => Promise<{ key: string; eliminated: boolean }>;

    /**
     * Obsolete raw legacy-PII reader; main rejects it without reading rows.
     */
    legacyRows: () => Promise<LegacyPiiRowsReport>;
  }
}

/** Crypto capability operations available through IPC (D1.1 S2). */
declare global {
  interface ElectronCryptoApi {
    /**
     * Current ADR-001 §2.3 capability decision (main-process memory only;
     * no key material or passphrase crosses IPC).
     */
    capability: () => Promise<{
      mode: "safe_storage" | "passphrase" | "denied";
      piiPersistence: "encrypted_at_rest" | "denied";
      reason: string;
    }>;

    /**
     * Adopt the session passphrase into main-process memory only
     * (SPEC-01 `session_passphrase_key`). Never echoed back, never
     * persisted. The renderer must not retain the value after the call.
     */
    setPassphrase: (passphrase: string) => Promise<void>;

    /** Zeroize the session passphrase (irreversible). */
    lock: () => Promise<void>;
  }
}

declare global {
  interface ElectronDBApi {
    /** Load a JSON-encoded value from the key-value store by key. */
    load(key: string): Promise<string | null>;

    /** Save a JSON-encoded value to the key-value store. */
    save(key: string, value: string): Promise<void>;

    /** Delete a key and its value from the store. */
    delete(key: string): Promise<void>;

    /** List only existing keys from the exact app-owned non-PII allowlist. */
    listKeys(): Promise<string[]>;

    /** Internal diagnostic export; requires the gate and no active erasure. */
    exportDatabase(): Promise<string>;

    /**
     * Legacy API contract retained for compatibility. Main rejects imports
     * while legacy PII isolation is enforced; no dialog or DB replacement runs.
     */
    importDatabase(): Promise<string>;
  }

  /** Update-check operations available through IPC. */
  interface ElectronUpdaterApi {
    /** Check for available updates. */
    check: () => Promise<{
      available: boolean;
      version?: string;
      releaseNotes?: string;
    }>;

    /** Start downloading the update. */
    download: () => Promise<void>;

    /** Install the downloaded update and restart. */
    install: () => Promise<void>;

    /** Skip a specific version. */
    skip: (version: string) => Promise<void>;

    /** Get the current updater status. */
    getStatus: () => Promise<{
      status: string;
      progress?: number;
      version?: string;
    }>;

    /** Listen for download progress events. Returns an unsubscribe function. */
    onProgress: (
      callback: (data: {
        percent: number;
        bytesPerSecond: number;
        total: number;
        transferred: number;
      }) => void,
    ) => () => void;

    /** Listen for update-available events. Returns an unsubscribe function. */
    onAvailable: (
      callback: (data: { version: string; releaseNotes?: string }) => void,
    ) => () => void;

    /** Listen for update-downloaded events. Returns an unsubscribe function. */
    onDownloaded: (callback: (data: { version: string }) => void) => () => void;

    /** Listen for updater errors. Returns an unsubscribe function. */
    onError: (callback: (data: { message: string }) => void) => () => void;

    /** Listen for update-not-available events. Returns an unsubscribe function. */
    onNotAvailable: (callback: () => void) => () => void;

    /** Listen for checking-for-update events. Returns an unsubscribe function. */
    onChecking: (callback: () => void) => () => void;
  }

  interface Window {
    /** Electron context-bridge API. Only available in Electron. */
    electronAPI?: ElectronAPI;
  }
}
