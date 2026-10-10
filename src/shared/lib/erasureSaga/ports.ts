/**
 * Storage ports for the erasure saga engine (D1.1 S7).
 *
 * The engine is storage-agnostic: each platform injects a JournalAdapter
 * (disk file on desktop; localStorage on web) and a SnapshotStore (disk on
 * desktop; OPFS/localStorage on web). Journals are metadata-only infra —
 * no user content ever flows through them.
 */

import type { SagaJournal } from "./types.js";

export interface JournalAdapter {
  exists(): boolean;
  load(): SagaJournal | null;
  save(journal: SagaJournal): void;
  destroy(): void;
}

export interface SnapshotStore {
  write(sagaId: string, payload: string): Promise<void>;
  canRollback(
    sagaId: string,
    now: Date,
  ): Promise<{ possible: boolean; reason?: string }>;
  restore(sagaId: string): Promise<string>;
  destroy(sagaId: string): void;
  destroyAll(): void;
  /** TTL sweep — destroys expired snapshots, returns their ids. */
  sweepExpired(now: Date): string[];
}
