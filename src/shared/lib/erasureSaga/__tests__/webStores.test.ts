import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  webJournalAdapter,
  webSnapshotStore,
  ERASURE_JOURNAL_KEY,
} from "../webStores";
import type { SagaJournal } from "../types";

// ---------------------------------------------------------------------------
// D1.1 S7 — web/renderer erasure stores (SPEC-02 §4/§5).
// jsdom provides a real localStorage; the broad renderer purge adapters were
// removed (see rendererSweep.ts) — that entry point is fail-closed, so only the
// metadata-only journal and readable local snapshot store remain to verify here.
// ---------------------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("webJournalAdapter (SPEC-02 §4 — metadata-only journal)", () => {
  it("persists and loads the journal through the gated storage", () => {
    const adapter = webJournalAdapter();
    const journal = {
      saga_id: "synthetic-id",
      state: "deleting",
      policy_version: "1.1",
      started_at: "2026-09-12T00:00:00Z",
      confirmation: {
        confirmed_at: "2026-09-12T00:00:00Z",
        scope: "delete_all",
      },
      rollback_window: { ttl_days: 7 },
      stores: [],
    } as unknown as SagaJournal;
    adapter.save(journal);
    expect(adapter.exists()).toBe(true);
    expect(adapter.load()?.saga_id).toBe("synthetic-id");
    adapter.destroy();
    expect(adapter.exists()).toBe(false);
    expect(ERASURE_JOURNAL_KEY.startsWith("open3dcalc_")).toBe(true);
  });
});

describe("webSnapshotStore (SPEC-02 §5 — local, TTL)", () => {
  it("round-trips the readable snapshot locally", async () => {
    const store = webSnapshotStore();
    await store.write("saga-1", "synthetic rollback payload");
    const raw = window.localStorage.getItem(
      "open3dcalc_erasure_snapshot",
    ) as string;
    expect(raw).toContain("synthetic rollback payload");
    expect(await store.restore("saga-1")).toBe("synthetic rollback payload");
    store.destroy("saga-1");
    await expect(store.restore("saga-1")).rejects.toThrow();
  });

  it("sweepExpired destroys snapshots past their TTL", async () => {
    const store = webSnapshotStore();
    await store.write("saga-ttl", "x");
    const future = new Date(Date.now() + 8 * 86_400_000);
    expect(store.sweepExpired(future)).toContain("saga-ttl");
    await expect(store.restore("saga-ttl")).rejects.toThrow();
  });
});
