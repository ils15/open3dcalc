/**
 * Erasure saga types (D1.1 S7) — SPEC-02 §2/§3/§4.
 *
 * Pure module: no Electron, no browser APIs — the saga engine runs in the
 * main process, the renderer, and standalone test drivers alike.
 */

export type SagaState =
  "prepared" | "snapshot_taken" | "deleting" | "committed" | "rolled_back";

export type StoreRowState = "pending" | "in_progress" | "done" | "failed";

/** The SPEC-02 §3 store list. */
export const ERASURE_STORES = [
  "localstorage",
  "sqlite_domain_tables",
  "sqlite_storage",
  "sqlite_wal_shm",
  "indexeddb",
  "opfs",
  "cache_api_sw",
  "appdata_files",
  "logs",
  "temp_staging",
  "snapshots",
] as const;
export type ErasureStore = (typeof ERASURE_STORES)[number];

/** Stores that run inside the renderer (web build runs ONLY these + staging). */
export const RENDERER_STORES: readonly ErasureStore[] = [
  "localstorage",
  "indexeddb",
  "opfs",
  "cache_api_sw",
];

/** Per-platform store plans (SPEC-02 §3 platform column). */
export const PLATFORM_STORES: Record<
  "electron" | "web",
  readonly ErasureStore[]
> = {
  electron: [
    "localstorage",
    "sqlite_domain_tables",
    "sqlite_storage",
    "sqlite_wal_shm",
    "indexeddb",
    "opfs",
    "cache_api_sw",
    "appdata_files",
    "logs",
    "temp_staging",
    "snapshots",
  ],
  web: ["localstorage", "indexeddb", "opfs", "cache_api_sw", "temp_staging"],
};

export interface StoreJournalRow {
  store: ErasureStore;
  state: StoreRowState;
  attempts: number;
  error?: string;
}

export interface RollbackWindow {
  ttl_days: number;
  key_source: "safeStorage" | "passphrase";
}

export interface SagaJournal {
  saga_id: string;
  state: SagaState;
  policy_version: string;
  started_at: string;
  /** §5: confirmation lives in the journal — resume never re-prompts. */
  confirmation: { confirmed_at: string; scope: "delete_all" };
  rollback_window: RollbackWindow;
  rollback_unavailable?: { reason: string; at: string };
  stores: StoreJournalRow[];
}

export const MAX_STORE_ATTEMPTS = 3;
export const SNAPSHOT_TTL_DAYS = 7;

export interface SagaReceipt {
  saga_id: string;
  committed_at: string;
  policy_version: string;
  stores_completed: ErasureStore[];
  /** SPEC-02 §7 — external copies the app cannot reach. */
  external_copies_notice: string[];
  rollback_unavailable?: { reason: string; at: string };
}

export function buildStorePlan(
  platform: "electron" | "web",
): StoreJournalRow[] {
  return PLATFORM_STORES[platform].map((store) => ({
    store,
    state: "pending",
    attempts: 0,
  }));
}

/**
 * Per-store adapter injected by the platform. `purge` MUST be idempotent —
 * deleting an already-deleted store is a no-op success (SPEC-02 §2 resume
 * rule). `rescan` implements the §6 post-condition: it returns the PII
 * identifiers REMAINING in the store (empty array = clean).
 */
export interface StoreAdapterLike {
  store: ErasureStore;
  purge(): Promise<number>;
  rescan(): Promise<string[]>;
  /**
   * Optional: better-precision rescan label (defaults to the store name).
   */
  rescanLabel?: string;
}
