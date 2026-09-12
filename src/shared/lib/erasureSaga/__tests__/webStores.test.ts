import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { localstorageAdapter, indexeddbAdapter } from "../rendererSweep";
import {
  webJournalAdapter,
  webSnapshotStore,
  ERASURE_JOURNAL_KEY,
} from "../webStores";
import type { SagaJournal } from "../types";

// ---------------------------------------------------------------------------
// D1.1 S7 — web/renderer erasure adapters (SPEC-02 §3 rows 1/5/6/7, §4/§5).
// jsdom provides a real localStorage; IDB/OPFS/caches are exercised at the
// API boundary (feature-detected, no-ops when absent — documented boundary).
// ---------------------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("localstorageAdapter (SPEC-02 §3 row 1 — R1 sweep)", () => {
  it("removes every manifest key AND unknown open3dcalc_* keys", async () => {
    window.localStorage.setItem("open3dcalc_settings_v2", "{}");
    window.localStorage.setItem("open3dcalc_rogue_unknown", "x");
    window.localStorage.setItem("i18nextLng", "pt-BR");
    window.localStorage.setItem("third_party_analytics", "keep-out");
    const purged = await localstorageAdapter().purge();
    expect(purged).toBe(3);
    expect(window.localStorage.getItem("third_party_analytics")).toBe(
      "keep-out",
    );
    expect(await localstorageAdapter().rescan()).toEqual([]);
  });

  it("is idempotent — a second purge finds nothing", async () => {
    window.localStorage.setItem("open3dcalc_settings_v2", "{}");
    await localstorageAdapter().purge();
    expect(await localstorageAdapter().purge()).toBe(0);
  });
});

describe("indexeddbAdapter", () => {
  it("no-ops cleanly when IndexedDB has no databases (jsdom boundary)", async () => {
    expect(await indexeddbAdapter().purge()).toBe(0);
    expect(await indexeddbAdapter().rescan()).toEqual([]);
  });
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
      rollback_window: { ttl_days: 7, key_source: "passphrase" },
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

describe("webSnapshotStore (SPEC-02 §5 — encrypted, TTL)", () => {
  const capability = {
    keySource: "passphrase" as const,
    canDecrypt: async () => true,
    async encrypt(bytes: Uint8Array) {
      return new Uint8Array(
        Buffer.from(`enc:${Buffer.from(bytes).toString("base64")}`),
      );
    },
    async decrypt(cipher: Uint8Array) {
      const text = Buffer.from(cipher).toString("utf8");
      return new Uint8Array(Buffer.from(text.slice(4), "base64"));
    },
  };

  it("round-trips the encrypted snapshot and never stores plaintext", async () => {
    const store = webSnapshotStore();
    await store.write("saga-1", "Fernanda Sintética", capability);
    const raw = window.localStorage.getItem(
      "open3dcalc_erasure_snapshot",
    ) as string;
    expect(raw).not.toContain("Fernanda");
    expect(await store.restore("saga-1", capability)).toBe(
      "Fernanda Sintética",
    );
    store.destroy("saga-1");
    await expect(store.restore("saga-1", capability)).rejects.toThrow();
  });

  it("sweepExpired destroys snapshots past their TTL", async () => {
    const store = webSnapshotStore();
    await store.write("saga-ttl", "x", capability);
    const future = new Date(Date.now() + 8 * 86_400_000);
    expect(store.sweepExpired(future)).toContain("saga-ttl");
    await expect(store.restore("saga-ttl", capability)).rejects.toThrow();
  });
});
