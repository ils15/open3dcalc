/**
 * Web storage adapters for the erasure saga (D1.1 S7) — SPEC-02 §4/§5,
 * web/pwa platform.
 *
 * Journal: a metadata-only localStorage key registered in the SPEC-01
 * manifest as an infrastructure surface (class diagnostic). Snapshots:
 * readable local data in localStorage (the web payload is bounded by the
 * SPEC-03 limits; OPFS is the growth path if snapshots outgrow the ~5 MiB
 * per-key quota — documented boundary).
 *
 * The journal key is written through `guardedStorage` so the S1 gate keeps
 * choke-point coverage; the manifest declares it (policy_version bump to
 * 1.2 accompanies this slice).
 */

import { SNAPSHOT_TTL_DAYS, type SagaJournal } from "./types.js";
import type { JournalAdapter, SnapshotStore } from "./ports.js";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { isBetaChannel } from "@/shared/config/betaChannel";

export const ERASURE_JOURNAL_KEY = "open3dcalc_erasure_journal";
/** Registered SPEC-01 key: temporary local rollback data. */
export const ERASURE_SNAPSHOT_KEY = "open3dcalc_erasure_snapshot";

export function webJournalAdapter(): JournalAdapter {
  if (isBetaChannel) {
    return {
      exists: () => false,
      load: () => null,
      save: () => undefined,
      destroy: () => undefined,
    };
  }
  return {
    exists(): boolean {
      return guardedStorage.getItem(ERASURE_JOURNAL_KEY) !== null;
    },
    load(): SagaJournal | null {
      const raw = guardedStorage.getItem(ERASURE_JOURNAL_KEY);
      if (raw === null) return null;
      return JSON.parse(raw) as SagaJournal;
    },
    save(journal: SagaJournal): void {
      guardedStorage.setItem(ERASURE_JOURNAL_KEY, JSON.stringify(journal));
    },
    destroy(): void {
      guardedStorage.removeItem(ERASURE_JOURNAL_KEY);
    },
  };
}

function ageDays(fromIso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

export function webSnapshotStore(): SnapshotStore {
  if (isBetaChannel) {
    return {
      write: async () => undefined,
      canRollback: async () => ({
        possible: false,
        reason: "snapshot_unsupported",
      }),
      restore: async () => {
        throw new Error("Snapshots are unsupported in Beta");
      },
      destroy: () => undefined,
      destroyAll: () => undefined,
      sweepExpired: () => [],
    };
  }

  function readEnvelope(): {
    saga_id: string;
    created_at: string;
    ttl_days: number;
    payload?: string;
    ct_base64?: string;
  } | null {
    const raw = guardedStorage.getItem(ERASURE_SNAPSHOT_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as {
        saga_id: string;
        created_at: string;
        ttl_days: number;
        payload?: string;
        ct_base64?: string;
      };
    } catch {
      return null;
    }
  }
  return {
    async write(sagaId, payload) {
      const previous = readEnvelope();
      if (previous && typeof previous.payload !== "string") {
        throw new Error("legacy snapshot format is unsupported");
      }
      // One fixed SPEC-01 key: the record carries metadata and readable data.
      guardedStorage.setItem(
        ERASURE_SNAPSHOT_KEY,
        JSON.stringify({
          saga_id: sagaId,
          created_at: new Date().toISOString(),
          ttl_days: SNAPSHOT_TTL_DAYS,
          payload,
        }),
      );
    },
    async canRollback(sagaId, now) {
      const env = readEnvelope();
      if (env === null || env.saga_id !== sagaId) {
        return { possible: false, reason: "snapshot_missing" };
      }
      if (typeof env.payload !== "string") {
        return { possible: false, reason: "legacy_snapshot_unsupported" };
      }
      if (ageDays(env.created_at, now) > SNAPSHOT_TTL_DAYS) {
        return { possible: false, reason: "snapshot_expired" };
      }
      return { possible: true };
    },
    async restore(sagaId) {
      const env = readEnvelope();
      if (env === null || env.saga_id !== sagaId) {
        throw new Error("snapshot missing");
      }
      if (typeof env.payload !== "string") {
        throw new Error("legacy snapshot format is unsupported");
      }
      return env.payload;
    },
    destroy(sagaId) {
      const env = readEnvelope();
      if (env?.saga_id === sagaId) {
        guardedStorage.removeItem(ERASURE_SNAPSHOT_KEY);
      }
    },
    destroyAll() {
      guardedStorage.removeItem(ERASURE_SNAPSHOT_KEY);
    },
    sweepExpired(now) {
      const env = readEnvelope();
      if (env !== null && ageDays(env.created_at, now) > env.ttl_days) {
        guardedStorage.removeItem(ERASURE_SNAPSHOT_KEY);
        return [env.saga_id];
      }
      return [];
    },
  };
}
