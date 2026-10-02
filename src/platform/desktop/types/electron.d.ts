/**
 * Type declarations for the Electron contextBridge API.
 *
 * These types mirror the API exposed by `electron/preload.ts`
 * and consumed by `src/overrides/db-bridge.ts`.
 */

// Type-only: erased at compile time. Deriving the report shape from the
// canonical PII table list means adding a table is a compile error here rather
// than a silently un-reported column in the IPC contract.
import type { PiiDomainTableCounts } from "../../../../electron/piiDomainTables.js";
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
}

/** Erasure saga operations available through IPC (D1.1 S7). */
declare global {
  interface ElectronErasureApi {
    start: (
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
      state?: string;
      stores?: Array<{ store: string; state: string; attempts: number }>;
    }>;
  }
}

/** Privacy scan operations available through IPC (D1.1 S3). */
declare global {
  interface ElectronPrivacyApi {
    /**
     * On-demand ADR-002 §2.3 legacy-plaintext scan. Metadata only:
     * key NAMES and counts, never stored values.
     */
    scanReport: () => Promise<{
      scannedAt: string;
      entries: Array<{ key: string; surface: string; status: string }>;
      legacyCount: number;
      encryptedCount: number;
      domainTables: PiiDomainTableCounts;
      manifestAvailable: boolean;
    }>;

    /**
     * ADR-002 §2.2 quarantine report: PII keys holding legacy plaintext
     * (quarantined, read-only) and their record counts.
     */
    quarantineReport: () => Promise<{
      scannedAt: string;
      entries: Array<{ key: string; status: string; recordCount?: number }>;
      quarantinedKeys: string[];
    }>;

    /**
     * ADR-002 §2.2.3 migrate: encrypt the quarantined plaintext with the
     * ADR-001 capability and verify before the plaintext is destroyed.
     */
    migrateKey: (
      key: string,
    ) => Promise<{ key: string; migrated: boolean; verified: boolean }>;

    /**
     * ADR-002 §2.2.3 eliminate: delete the quarantined rows for a PII key.
     */
    eliminateKey: (
      key: string,
    ) => Promise<{ key: string; eliminated: boolean }>;

    /**
     * ADR-001 §3.6: which stored classes are unreadable, and whether recovery
     * can still be attempted for each. `reason` is the MAIN process's own
     * refusal code, reused rather than re-invented here — a second vocabulary
     * would drift, and these are the codes an operator needs. Metadata only:
     * key NAMES and codes, never a value (§3.2).
     */
    recoveryReport: () => Promise<{
      scannedAt: string;
      unavailable: Array<{
        key: string;
        reason: string;
        recoverable: boolean;
      }>;
    }>;

    /**
     * ADR-001 §3.6 recovery for one key: copy → re-seal → verify.
     *
     * `verified` is true only after a fresh read-back through the normal bound
     * path authenticated and matched the full payload, so `recovered: true` may
     * be read as "this is now a properly bound envelope" rather than "a write
     * was attempted". NEVER deletes the legacy blob: the copy is retained as
     * disclosed residue and the user removes it through the erasure flow.
     */
    recoverKey: (key: string) => Promise<{
      key: string;
      recovered: boolean;
      verified: boolean;
      shape?: string;
      reason?: string;
      residueRetained?: boolean;
    }>;

    /**
     * Beta5 desktop re-home: the RAW legacy plaintext values of the three
     * migrated PII keys, so the renderer can COPY them into the encrypted vault
     * (the web re-home's desktop twin). READ-ONLY. These values are PII: they
     * live in renderer memory only and are NEVER persisted there.
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

    /** List all keys in the store, sorted alphabetically. */
    listKeys(): Promise<string[]>;

    /**
     * Run a raw SQL query (SELECT / PRAGMA / EXPLAIN only).
     * Write operations must use the dedicated save/delete helpers.
     */
    query(sql: string, params?: unknown[]): Promise<unknown[]>;

    /** Open a save dialog and export the database file. Returns the chosen path. */
    exportDatabase(): Promise<string>;

    /**
     * Import a database from an external backup file.
     * The file is chosen via a native dialog in the main process — any
     * renderer-supplied path argument is ignored. Replaces the current
     * database. Returns the path of the imported database on success.
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
      /** True when the update must be downloaded manually (unsigned macOS). */
      manual?: boolean;
    }>;

    /** Start downloading the update, or open the release page when manual. */
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
      callback: (data: {
        version: string;
        releaseNotes?: string;
        manual?: boolean;
      }) => void,
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
