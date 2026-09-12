/**
 * Erasure saga engine (D1.1 S7) — SPEC-02 §2/§6.
 *
 * Pure orchestration over injectable store adapters (no Electron, no DOM):
 * the same engine drives the desktop main process, the web renderer, and
 * standalone crash-test drivers.
 *
 * Commit point: the saga commits only after every store row is `done` AND
 * the §6 post-condition rescan finds zero PII. Before the commit point any
 * unrecoverable failure rolls back (snapshot restore); with an impossible
 * rollback (§5) the saga completes as `committed` with a `rollback_unavailable`
 * annotation — never a silent partial state. Re-running a store's deletion is
 * always safe (idempotent purges), so resume after SIGKILL never restarts
 * from scratch and never re-prompts (the journal holds the confirmation).
 */

import type {
  ErasureStore,
  SagaJournal,
  SagaReceipt,
  StoreAdapterLike,
} from "./types.js";
import {
  MAX_STORE_ATTEMPTS,
  SNAPSHOT_TTL_DAYS,
  buildStorePlan,
} from "./types.js";
import type {
  JournalAdapter,
  SnapshotCapability,
  SnapshotStore,
} from "./ports.js";

export { type StoreAdapterLike };

export interface SagaEngineOptions {
  platform: "electron" | "web";
  /** Journal storage (disk on desktop; localStorage/OPFS on web). */
  journal: JournalAdapter;
  /** Encrypted snapshot storage (disk on desktop; OPFS/localStorage on web). */
  snapshots: SnapshotStore;
  policyVersion: string;
  /** One adapter per store in the platform plan (lookup by `store`). */
  adapters: StoreAdapterLike[];
  /** Override the platform's default store plan (crash-test drivers). */
  storePlan?: ErasureStore[];
  snapshotCapability: SnapshotCapability;
  /** Serialized PII-bearing data captured into the encrypted snapshot. */
  collectSnapshotPayload: () => Promise<string>;
  /** Restore a snapshot payload back into the stores (rollback path). */
  restoreSnapshotPayload?: (payload: string) => Promise<void>;
  /** External copies the app cannot reach (SPEC-02 §7). */
  externalCopiesNotice?: string[];
  now?: () => Date;
  /** Progress hook — also the crash-injection seam for the test driver. */
  onProgress?: (journal: SagaJournal) => void;
}

export class SagaError extends Error {
  readonly code:
    "saga_in_progress" | "no_saga" | "attempts_exhausted" | "rescan_failed";
  constructor(code: SagaError["code"], message: string) {
    super(`[erasureSaga] ${message}`);
    this.name = "SagaError";
    this.code = code;
  }
}

function findAdapter(
  options: SagaEngineOptions,
  store: ErasureStore,
): StoreAdapterLike {
  const adapter = options.adapters.find((a) => a.store === store);
  if (!adapter) {
    throw new SagaError("no_saga", `no adapter for store "${store}"`);
  }
  return adapter;
}

async function persist(options: SagaEngineOptions, journal: SagaJournal) {
  options.journal.save(journal);
  options.onProgress?.(structuredClone(journal));
}

/**
 * Start a new saga. Refuses when a non-terminal journal already exists
 * (call `resumeSaga` instead — SPEC-02 §2: never restart from scratch).
 */
export async function startSaga(
  options: SagaEngineOptions,
): Promise<{ journal: SagaJournal; receipt?: SagaReceipt }> {
  if (options.journal.exists()) {
    const existing = options.journal.load();
    if (
      existing &&
      existing.state !== "committed" &&
      existing.state !== "rolled_back"
    ) {
      throw new SagaError("saga_in_progress", "a saga is already running");
    }
    options.journal.destroy();
  }
  const now = (options.now ?? (() => new Date()))();
  const journal: SagaJournal = {
    saga_id: crypto.randomUUID(),
    state: "prepared",
    policy_version: options.policyVersion,
    started_at: now.toISOString(),
    confirmation: { confirmed_at: now.toISOString(), scope: "delete_all" },
    rollback_window: {
      ttl_days: SNAPSHOT_TTL_DAYS,
      key_source: options.snapshotCapability.keySource,
    },
    stores: buildStorePlan(options.platform)
      .map((row) =>
        options.storePlan && !options.storePlan.includes(row.store)
          ? null
          : row,
      )
      .filter((row): row is NonNullable<typeof row> => row !== null),
  };
  await persist(options, journal);
  return drive(options, journal);
}

/**
 * Resume a non-terminal saga from its journal (idempotent per store).
 * With no journal, this is a no-op returning null.
 */
export async function resumeSaga(
  options: SagaEngineOptions,
): Promise<{ journal: SagaJournal | null; receipt?: SagaReceipt }> {
  const journal = options.journal.load();
  if (!journal) return { journal: null };
  if (journal.state === "committed" || journal.state === "rolled_back") {
    return { journal };
  }
  const result = await drive(options, journal);
  return { journal: result.journal, receipt: result.receipt };
}

async function drive(
  options: SagaEngineOptions,
  journal: SagaJournal,
): Promise<{ journal: SagaJournal; receipt?: SagaReceipt }> {
  const now = options.now ?? (() => new Date());

  // ── prepared → snapshot_taken (§5) ─────────────────────────────────
  if (journal.state === "prepared") {
    try {
      const payload = await options.collectSnapshotPayload();
      await options.snapshots.write(
        journal.saga_id,
        payload,
        options.snapshotCapability,
      );
    } catch (error) {
      // §5: capability denied ⇒ rollback is impossible — the erasure still
      // completes (documented trade-off; never weakens the guarantee).
      journal.rollback_unavailable = {
        reason: `capability_denied: ${
          error instanceof Error ? error.message : String(error)
        }`,
        at: now().toISOString(),
      };
    }
    journal.state = "snapshot_taken";
    await persist(options, journal);
  }

  // TTL sweep runs on every entry into the deletion phase (§5).
  options.snapshots.sweepExpired(now());

  // ── snapshot_taken → deleting ──────────────────────────────────────
  if (journal.state === "snapshot_taken") {
    journal.state = "deleting";
    await persist(options, journal);
  }

  // ── deleting: per-store, idempotent, attempts-capped (§4) ──────────
  if (journal.state === "deleting") {
    for (const row of journal.stores) {
      while (row.state !== "done") {
        if (row.state !== "failed") row.state = "in_progress";
        row.attempts += 1;
        // §4: the per-store in_progress state is journaled BEFORE the
        // purge runs — a crash here leaves a resumable record.
        await persist(options, journal);
        try {
          const adapter = findAdapter(options, row.store);
          await adapter.purge();
          row.state = "done";
          delete row.error;
        } catch (error) {
          row.error = error instanceof Error ? error.message : String(error);
          row.state = "failed";
          await persist(options, journal);
          if (row.attempts >= MAX_STORE_ATTEMPTS) {
            return failOrRollback(options, journal, row.store);
          }
        }
        await persist(options, journal);
      }
    }

    // ── §6 post-condition rescan — never success with PII remaining ──
    const leftovers: string[] = [];
    for (const row of journal.stores) {
      const adapter = findAdapter(options, row.store);
      const remaining = await adapter.rescan();
      if (remaining.length > 0) {
        leftovers.push(...remaining);
        row.state = "failed";
        row.error = `rescan found PII: ${remaining.join(", ")}`;
      }
    }
    await persist(options, journal);
    if (leftovers.length > 0) {
      const retryable = journal.stores.find(
        (r) => r.state === "failed" && r.attempts < MAX_STORE_ATTEMPTS,
      );
      if (retryable) {
        retryable.state = "in_progress";
        return drive(options, journal);
      }
      console.log("__DRIVE_FAILROLLBACK__");
      return failOrRollback(options, journal, "sqlite_storage");
    }
  }

  // ── committed (§2: terminal, snapshot destroyed) ───────────────────
  journal.state = "committed";
  options.snapshots.destroy(journal.saga_id);
  await persist(options, journal);
  const receipt: SagaReceipt = {
    saga_id: journal.saga_id,
    committed_at: now().toISOString(),
    policy_version: journal.policy_version,
    stores_completed: journal.stores.map((r) => r.store),
    external_copies_notice: options.externalCopiesNotice ?? [],
    ...(journal.rollback_unavailable
      ? { rollback_unavailable: journal.rollback_unavailable }
      : {}),
  };
  // Terminal and durable — the journal itself can now go.
  options.journal.destroy();
  return { journal, receipt };
}

/**
 * Pre-commit unrecoverable failure: roll back when the snapshot window
 * allows (§5); otherwise complete as committed with rollback_unavailable —
 * the user asked for erasure and a half-deleted state is never reported
 * as success.
 */
async function failOrRollback(
  options: SagaEngineOptions,
  journal: SagaJournal,
  failedStore: ErasureStore,
): Promise<{ journal: SagaJournal; receipt?: SagaReceipt }> {
  const now = options.now ?? (() => new Date());
  const window = await options.snapshots.canRollback(
    journal.saga_id,
    options.snapshotCapability,
    now(),
  );
  if (!window.possible || !options.restoreSnapshotPayload) {
    journal.rollback_unavailable = {
      reason: window.reason ?? "no_restore_adapter",
      at: now().toISOString(),
    };
    journal.state = "committed";
    options.snapshots.destroy(journal.saga_id);
    await persist(options, journal);
    return {
      journal,
      receipt: {
        saga_id: journal.saga_id,
        committed_at: now().toISOString(),
        policy_version: journal.policy_version,
        stores_completed: journal.stores.map((r) => r.store),
        external_copies_notice: options.externalCopiesNotice ?? [],
        rollback_unavailable: journal.rollback_unavailable,
      },
    };
  }
  const payload = await options.snapshots.restore(
    journal.saga_id,
    options.snapshotCapability,
  );
  await options.restoreSnapshotPayload(payload);
  journal.state = "rolled_back";
  await persist(options, journal);
  throw new SagaError(
    "attempts_exhausted",
    `store "${failedStore}" exhausted ${MAX_STORE_ATTEMPTS} attempts; data restored from snapshot`,
  );
}
