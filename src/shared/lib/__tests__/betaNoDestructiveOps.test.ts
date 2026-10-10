import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  webJournalAdapter,
  webSnapshotStore,
} from "@/shared/lib/erasureSaga/webStores";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import type { SagaJournal } from "@/shared/lib/erasureSaga/types";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

describe("betaNoDestructiveOps", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("does not persist an erasure journal in the Beta namespace", () => {
    const journal = webJournalAdapter();

    journal.save({
      saga_id: "synthetic-saga-01",
      state: "prepared",
      policy_version: "1.0",
      started_at: "2026-10-08T00:00:00.000Z",
      confirmation: {
        confirmed_at: "2026-10-08T00:00:00.000Z",
        scope: "delete_all",
      },
      rollback_window: { ttl_days: 7 },
      stores: [],
    } satisfies SagaJournal);

    expect(
      window.localStorage.getItem("open3dcalc_erasure_journal"),
    ).toBeNull();
  });

  it("refuses a snapshot before writing to storage", async () => {
    const snapshot = webSnapshotStore();

    await snapshot.write("synthetic-saga-02", "synthetic-only");

    expect(
      window.localStorage.getItem("open3dcalc_erasure_snapshot"),
    ).toBeNull();
  });
});
