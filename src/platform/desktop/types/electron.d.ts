/**
 * Type declarations for the Electron contextBridge API.
 *
 * These types mirror the API exposed by `electron/preload.ts`
 * and consumed by `src/overrides/db-bridge.ts`.
 *
 * Beta channel (Web-only): while `VITE_BETA_CHANNEL` is exactly `"true"`,
 * every PII member below (`piiNew`, `erasure`, `withdrawal`,
 * `privacy`, and the diagnostic `db.exportDatabase`) refuses fail-closed —
 * first in the preload bridge, then independently in the main process — and
 * the generic `db:*` storage additionally withholds the consent row. `db`
 * (minus export/consent) and `updater` are non-PII infrastructure and keep
 * working. No Beta change adds, removes or renames a channel: the surface is
 * PII IPC remains unavailable to Beta.
 */

// Type-only: derives the legacy-rows contract from the main-process reader, so
// a change to the report shape is a compile error here, not a silent drift.
import type { LegacyPiiRowsReport } from "../../../../electron/legacyRows.js";

/** Database operations available through IPC. */
/** Full Electron API exposed via contextBridge. */
export interface ElectronAPI {
  db: ElectronDBApi;
  updater: ElectronUpdaterApi;
  privacy: ElectronPrivacyApi;
  erasure: ElectronErasureApi;
  piiNew: ElectronPiiNewApi;
  withdrawal: ElectronWithdrawalApi;
}

/** Receipt-scoped withdrawal purge (Beta12 follow-up). */
declare global {
  interface ElectronWithdrawalApi {
    /** Persist a durable receipt-scoped journal and return its one-use nonce. */
    request: (input: { receiptId: string; scope: string[] }) => Promise<{
      token: string;
      expiresAt: string;
      targets: Array<{ surface: string; id: string }>;
    }>;

    /** Consume the nonce and purge ONLY the linked new-PII rows. */
    purge: (
      token: string,
    ) => Promise<
      { ok: true; purged: string[] } | { ok: false; reason: string }
    >;
  }
}

/**
 * Desktop exact-key plaintext route for the disjoint new-PII namespace.
 * Unavailable on Beta (Web-only channel): every member refuses fail-closed.
 */
declare global {
  interface ElectronPiiNewApi {
    /** Availability of the plaintext route; metadata only. */
    capability: () => Promise<{
      available: boolean;
      backend?: string;
      reason?: string;
    }>;

    /** Open a NEW-namespace PII record, or null when absent. */
    load: (key: string) => Promise<string | null>;

    /** Store a validated plaintext envelope under a NEW-namespace key. */
    save: (key: string, value: string) => Promise<void>;
  }
}

/** Erasure saga operations available through IPC (D1.1 S7). Unavailable on Beta. */
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

    /**
     * EXACT new-namespace delete-all. Erases ONLY the three passwordless
     * new-PII storage rows; legacy rows, domain tables and mixed backups stay
     * unavailable.
     */
    newPii: {
      authorize: () => Promise<{
        token: string;
        expiresAt: string;
        targets: Array<{ surface: string; id: string }>;
      }>;
      claim: (
        token: string,
      ) => Promise<{ targets: Array<{ surface: string; id: string }> }>;
      start: (token: string) => Promise<{
        request_id: string;
        completed_at: string;
        purged: string[];
      }>;
      status: () => Promise<{
        active: boolean;
        available: boolean;
        blockerCodes: string[];
        state?: string;
        targets: Array<{ surface: string; id: string }>;
      }>;
    };
  }
}

/** Privacy IPC includes legacy UI contracts explicitly rejected by main. Unavailable on Beta. */
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

    /** Internal diagnostic export; requires the gate and no active erasure. Unavailable on Beta. */
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
