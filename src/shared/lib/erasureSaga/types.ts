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

const SAGA_STATES: readonly SagaState[] = [
  "prepared",
  "snapshot_taken",
  "deleting",
  "committed",
  "rolled_back",
];
const STORE_STATES: readonly StoreRowState[] = [
  "pending",
  "in_progress",
  "done",
  "failed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

/**
 * Validate the complete durable journal shape before any data capability is
 * touched. `expectedStores` binds a journal to the full platform plan (or an
 * explicitly injected test plan); it prevents an omitted target being treated
 * as an authorized, complete delete.
 */
export function isValidSagaJournal(
  value: unknown,
  expectedStores?: readonly ErasureStore[],
): value is SagaJournal {
  if (!isRecord(value)) return false;
  if (
    !hasOnlyKeys(value, [
      "saga_id",
      "state",
      "policy_version",
      "started_at",
      "confirmation",
      "rollback_window",
      "rollback_unavailable",
      "stores",
    ]) ||
    typeof value.saga_id !== "string" ||
    value.saga_id.length === 0 ||
    typeof value.policy_version !== "string" ||
    value.policy_version.length === 0 ||
    !SAGA_STATES.includes(value.state as SagaState) ||
    !isIsoTimestamp(value.started_at)
  ) {
    return false;
  }

  if (!isRecord(value.confirmation)) return false;
  const confirmation = value.confirmation;
  if (
    !hasOnlyKeys(confirmation, ["confirmed_at", "scope"]) ||
    confirmation.scope !== "delete_all" ||
    !isIsoTimestamp(confirmation.confirmed_at) ||
    Date.parse(confirmation.confirmed_at) > Date.parse(value.started_at)
  ) {
    return false;
  }

  if (!isRecord(value.rollback_window)) return false;
  const rollbackWindow = value.rollback_window;
  if (
    !hasOnlyKeys(rollbackWindow, ["ttl_days"]) ||
    !Number.isInteger(rollbackWindow.ttl_days) ||
    (rollbackWindow.ttl_days as number) <= 0
  ) {
    return false;
  }

  if (value.rollback_unavailable !== undefined) {
    if (!isRecord(value.rollback_unavailable)) return false;
    const rollbackUnavailable = value.rollback_unavailable;
    if (
      !hasOnlyKeys(rollbackUnavailable, ["reason", "at"]) ||
      typeof rollbackUnavailable.reason !== "string" ||
      rollbackUnavailable.reason.length === 0 ||
      !isIsoTimestamp(rollbackUnavailable.at)
    ) {
      return false;
    }
  }

  if (!Array.isArray(value.stores) || value.stores.length === 0) return false;
  const stores: ErasureStore[] = [];
  for (const candidate of value.stores) {
    if (!isRecord(candidate)) return false;
    if (
      !hasOnlyKeys(candidate, ["store", "state", "attempts", "error"]) ||
      !ERASURE_STORES.includes(candidate.store as ErasureStore) ||
      !STORE_STATES.includes(candidate.state as StoreRowState) ||
      !Number.isSafeInteger(candidate.attempts) ||
      (candidate.attempts as number) < 0 ||
      (candidate.state === "pending" && candidate.attempts !== 0) ||
      (candidate.state !== "pending" && (candidate.attempts as number) < 1) ||
      (candidate.error !== undefined && typeof candidate.error !== "string") ||
      (candidate.state === "done" && candidate.error !== undefined)
    ) {
      return false;
    }
    stores.push(candidate.store as ErasureStore);
  }

  if (new Set(stores).size !== stores.length) return false;
  if (
    expectedStores &&
    (stores.length !== expectedStores.length ||
      stores.some((store, index) => store !== expectedStores[index]))
  ) {
    return false;
  }

  if (
    (value.state === "prepared" || value.state === "snapshot_taken") &&
    value.stores.some((store) => store.state !== "pending")
  ) {
    return false;
  }
  if (
    value.state === "committed" &&
    value.stores.some((store) => store.state !== "done")
  ) {
    return false;
  }
  return true;
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
