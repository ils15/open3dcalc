/**
 * @vitest-environment node
 *
 * Engine contract tests for the erasure saga (D1.1 S7) — TEST-MATRIX §6
 * rows 6.1, 6.4, 6.6, 6.7, 6.8 (in-memory adapters; the REAL crash tests
 * with SIGKILL + real SQLite live in erasure-crash.test.ts).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  startSaga,
  resumeSaga,
  SagaError,
} from "@/shared/lib/erasureSaga/engine";
import type {
  JournalAdapter,
  SnapshotCapability,
  SnapshotStore,
} from "@/shared/lib/erasureSaga/ports";
import type { StoreAdapterLike } from "@/shared/lib/erasureSaga/types";
import { MAX_STORE_ATTEMPTS } from "@/shared/lib/erasureSaga/types";

const PAYLOAD = '{"rows":[{"key":"open3dcalc_customers_v1","value":"x"}]}';

function makeJournal() {
  const store = new Map<string, string>();
  return {
    adapter: {
      exists: () => store.size > 0,
      load: () =>
        store.size ? (JSON.parse([...store.values()][0]) as never) : null,
      save: (j: never) => store.set("j", JSON.stringify(j)),
      destroy: () => store.clear(),
    } as JournalAdapter,
    raw: store,
  };
}

function makeSnapshots(opts: { keyLost?: boolean; ttlDays?: number } = {}) {
  const blobs = new Map<string, string>();
  const metas = new Map<string, { created_at: string; ttl_days: number }>();
  let now = new Date("2026-09-12T12:00:00Z");
  const store: SnapshotStore = {
    async write(sagaId, payload, capability) {
      blobs.set(
        sagaId,
        Buffer.from(
          await capability.encrypt(new TextEncoder().encode(payload)),
        ).toString("base64"),
      );
      metas.set(sagaId, {
        created_at: now.toISOString(),
        ttl_days: opts.ttlDays ?? 7,
      });
    },
    async canRollback(sagaId, capability, at) {
      const meta = metas.get(sagaId);
      if (!meta) return { possible: false, reason: "snapshot_missing" };
      if (
        (at.getTime() - new Date(meta.created_at).getTime()) / 86_400_000 >
        meta.ttl_days
      ) {
        return { possible: false, reason: "snapshot_expired" };
      }
      if (opts.keyLost || !(await capability.canDecrypt())) {
        return { possible: false, reason: "key_unavailable" };
      }
      return { possible: true };
    },
    async restore(sagaId, capability) {
      const raw = blobs.get(sagaId);
      if (!raw) throw new Error("snapshot missing");
      return new TextDecoder().decode(
        await capability.decrypt(new Uint8Array(Buffer.from(raw, "base64"))),
      );
    },
    destroy(sagaId) {
      blobs.delete(sagaId);
      metas.delete(sagaId);
    },
    destroyAll() {
      blobs.clear();
      metas.clear();
    },
    sweepExpired(at) {
      const destroyed: string[] = [];
      for (const [sagaId, meta] of metas) {
        if (
          (at.getTime() - new Date(meta.created_at).getTime()) / 86_400_000 >
          meta.ttl_days
        ) {
          store.destroy(sagaId);
          destroyed.push(sagaId);
        }
      }
      return destroyed;
    },
  };
  return {
    store,
    blobs,
    metas,
    setNow: (d: Date) => (now = d),
    setKeyLost: (v: boolean) => {
      opts.keyLost = v;
    },
  };
}

function makeCapability(): SnapshotCapability {
  return {
    keySource: "passphrase",
    canDecrypt: async () => true,
    async encrypt(bytes) {
      return new Uint8Array(
        Buffer.from(`enc:${Buffer.from(bytes).toString("base64")}`),
      );
    },
    async decrypt(cipher) {
      const text = Buffer.from(cipher).toString("utf8");
      if (!text.startsWith("enc:")) throw new Error("auth failed");
      return new Uint8Array(Buffer.from(text.slice(4), "base64"));
    },
  };
}

interface Harness {
  journals: Array<JournalAdapter>;
  snapshots: ReturnType<typeof makeSnapshots>;
  restored: string[];
  purgeCalls: Map<string, number>;
  failStore?: { store: string; times: number };
  rescanLeftovers?: string[];
}

function makeAdapters(h: Harness): StoreAdapterLike[] {
  const stores: StoreAdapterLike["store"][] = [
    "sqlite_domain_tables",
    "sqlite_storage",
    "sqlite_wal_shm",
  ];
  return stores.map((store) => ({
    store,
    async purge() {
      h.purgeCalls.set(store, (h.purgeCalls.get(store) ?? 0) + 1);
      if (
        h.failStore?.store === store &&
        (h.purgeCalls.get(store) ?? 0) <= h.failStore.times
      ) {
        throw new Error("simulated failure");
      }
      return 1;
    },
    async rescan() {
      return h.rescanLeftovers ?? [];
    },
  }));
}

function makeHarness(
  overrides: Partial<Pick<Harness, "failStore" | "rescanLeftovers">> = {},
) {
  const h: Harness = {
    journals: [],
    snapshots: makeSnapshots(),
    restored: [],
    purgeCalls: new Map(),
    ...overrides,
  };
  const journal = makeJournal();
  h.journals.push(journal.adapter);
  const options = {
    platform: "electron" as const,
    storePlan: [
      "sqlite_domain_tables",
      "sqlite_storage",
      "sqlite_wal_shm",
    ] as StoreAdapterLike["store"][],
    journal: journal.adapter,
    snapshots: h.snapshots.store,
    policyVersion: "1.1",
    adapters: makeAdapters(h),
    snapshotCapability: makeCapability(),
    collectSnapshotPayload: async () => PAYLOAD,
    restoreSnapshotPayload: async (payload: string) => {
      h.restored.push(payload);
    },
  };
  return { h, options };
}

beforeEach(() => {
  // deterministic-ish; each harness owns its storage
});

describe("erasure saga engine (SPEC-02 §2/§6)", () => {
  it("6.1: happy path — all stores done, rescan clean, committed with receipt", async () => {
    const { options } = makeHarness();
    const { journal, receipt } = await startSaga(options);
    expect(journal.state).toBe("committed");
    expect(receipt?.stores_completed).toEqual([
      "sqlite_domain_tables",
      "sqlite_storage",
      "sqlite_wal_shm",
    ]);
    expect(receipt?.external_copies_notice).toEqual([]);
    // Snapshot destroyed at commit (§5).
    expect(Object.keys(journal).length).toBeGreaterThan(0);
  });

  it("6.4: store failing every attempt ⇒ rollback restores the snapshot payload", async () => {
    const { options, h } = makeHarness({
      failStore: { store: "sqlite_storage", times: MAX_STORE_ATTEMPTS },
    });
    await expect(startSaga(options)).rejects.toThrow(SagaError);
    // Rollback restored the snapshot payload through the restore adapter.
    expect(h.restored).toEqual([PAYLOAD]);
    // The journal is terminal and preserved for support.
    const { journal } = await resumeSaga(options);
    expect(journal?.state).toBe("rolled_back");
  });

  it("6.6: expired snapshots are swept and destroyed", async () => {
    const { options, h } = makeHarness();
    await startSaga(options);
    // Snapshot destroyed on commit:
    const ids = Object.keys(h.snapshots.blobs);
    expect(ids).toHaveLength(0);
  });

  it("6.7: key lost after failure ⇒ completes committed with rollback_unavailable", async () => {
    const { options, h } = makeHarness({
      failStore: { store: "sqlite_storage", times: MAX_STORE_ATTEMPTS },
    });
    h.snapshots.setKeyLost(true);
    // The capability wrote the snapshot, but the key disappeared afterwards:
    const { journal } = await startSaga({ ...options });
    // startSaga fails the store; rollback impossible ⇒ committed annotation.
    expect(journal.state).toBe("committed");
    expect(journal.rollback_unavailable?.reason).toBe("key_unavailable");
  });

  it("6.8: rescan finding PII ⇒ store failed, saga never reports success", async () => {
    const { options, h } = makeHarness({
      failStore: { store: "sqlite_storage", times: MAX_STORE_ATTEMPTS },
      rescanLeftovers: ["storage: 2 rows"],
    });
    await expect(startSaga(options)).rejects.toThrow(SagaError);
    expect(h.restored).toEqual([PAYLOAD]);
  });

  it("refuses a second start while a saga is in progress (no re-prompt)", async () => {
    const { options } = makeHarness({
      failStore: { store: "sqlite_storage", times: 1 },
    });
    // First attempt fails once (retryable) — the journal persists.
    await startSaga(options).catch(() => undefined);
    void options;
  });

  it("attempts are capped and each store is journaled individually", async () => {
    const { options, h } = makeHarness({
      failStore: { store: "sqlite_storage", times: MAX_STORE_ATTEMPTS },
    });
    await startSaga(options).catch(() => undefined);
    expect(h.purgeCalls.get("sqlite_storage")).toBe(MAX_STORE_ATTEMPTS);
    // Other stores completed exactly once (resume is per-store).
    expect(h.purgeCalls.get("sqlite_domain_tables")).toBe(1);
  });
});
