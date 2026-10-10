import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resumeSaga, type SagaEngineOptions } from "../engine";
import { diskJournalAdapter } from "../journal";
import type { SagaJournal } from "../types";
import type { SnapshotStore } from "../ports";

const dirs: string[] = [];

function fixtureDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-erasure-safety-"));
  dirs.push(dir);
  return dir;
}

function journalFixture(): SagaJournal {
  return {
    saga_id: "synthetic-saga",
    state: "prepared",
    policy_version: "1.1",
    started_at: "2026-10-06T00:00:00.000Z",
    confirmation: {
      confirmed_at: "2026-10-06T00:00:00.000Z",
      scope: "delete_all",
    },
    rollback_window: { ttl_days: 7 },
    stores: [{ store: "sqlite_storage", state: "pending", attempts: 0 }],
  };
}

function makeOptions(dir: string): {
  options: SagaEngineOptions;
  calls: Record<string, ReturnType<typeof vi.fn>>;
} {
  const calls = {
    snapshotPayload: vi.fn(async () => "synthetic payload"),
    snapshotWrite: vi.fn(async () => undefined),
    snapshotCanRollback: vi.fn(async () => ({ possible: false })),
    snapshotRestore: vi.fn(async () => "synthetic payload"),
    snapshotDestroy: vi.fn(),
    snapshotDestroyAll: vi.fn(),
    snapshotSweep: vi.fn(() => [] as string[]),
    purge: vi.fn(async () => 1),
    rescan: vi.fn(async () => [] as string[]),
    restorePayload: vi.fn(async () => undefined),
  };
  const snapshots: SnapshotStore = {
    write: calls.snapshotWrite,
    canRollback: calls.snapshotCanRollback,
    restore: calls.snapshotRestore,
    destroy: calls.snapshotDestroy,
    destroyAll: calls.snapshotDestroyAll,
    sweepExpired: calls.snapshotSweep,
  };
  const disk = diskJournalAdapter(dir);
  const options: SagaEngineOptions = {
    platform: "electron",
    storePlan: ["sqlite_storage"],
    journal: {
      exists: disk.exists,
      load: disk.load,
      save: disk.save,
      // Keep the synthetic journal for post-run inspection.
      destroy: vi.fn(),
    },
    snapshots,
    policyVersion: "1.1",
    adapters: [
      { store: "sqlite_storage", purge: calls.purge, rescan: calls.rescan },
    ],
    collectSnapshotPayload: calls.snapshotPayload,
    restoreSnapshotPayload: calls.restorePayload,
  };
  return { options, calls };
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe("delete-all journal authorization and progress validation", () => {
  it.each([
    [
      "missing confirmation",
      (j: Record<string, unknown>) => delete j.confirmation,
    ],
    [
      "unknown scope",
      (j: Record<string, unknown>) => {
        j.confirmation = {
          confirmed_at: "2026-10-06T00:00:00.000Z",
          scope: "withdraw_consent",
        };
      },
    ],
    [
      "malformed saga state",
      (j: Record<string, unknown>) => {
        j.state = "almost_deleted";
      },
    ],
    [
      "malformed store progress",
      (j: Record<string, unknown>) => {
        j.stores = [{ store: "sqlite_storage", state: "done", attempts: -1 }];
      },
    ],
    [
      "unknown store",
      (j: Record<string, unknown>) => {
        j.stores = [{ store: "retired_store", state: "pending", attempts: 0 }];
      },
    ],
  ])(
    "preserves and refuses %s before touching data capabilities",
    async (_name, mutate) => {
      const dir = fixtureDir();
      const value = journalFixture() as unknown as Record<string, unknown>;
      mutate(value);
      const raw = `${JSON.stringify(value, null, 2)}\n`;
      fs.writeFileSync(path.join(dir, "erasure-journal.json"), raw, "utf8");
      const { options, calls } = makeOptions(dir);

      await expect(resumeSaga(options)).rejects.toThrow();

      expect(
        fs.readFileSync(path.join(dir, "erasure-journal.json"), "utf8"),
      ).toBe(raw);
      expect(calls.snapshotPayload).not.toHaveBeenCalled();
      expect(calls.snapshotWrite).not.toHaveBeenCalled();
      expect(calls.snapshotCanRollback).not.toHaveBeenCalled();
      expect(calls.snapshotSweep).not.toHaveBeenCalled();
      expect(calls.purge).not.toHaveBeenCalled();
      expect(calls.rescan).not.toHaveBeenCalled();
    },
  );

  it("resumes an explicitly authorized delete_all journal and verifies every store", async () => {
    const dir = fixtureDir();
    const journal = journalFixture();
    journal.state = "deleting";
    journal.stores[0] = {
      store: "sqlite_storage",
      state: "in_progress",
      attempts: 1,
    };
    fs.writeFileSync(
      path.join(dir, "erasure-journal.json"),
      JSON.stringify(journal),
    );
    const { options, calls } = makeOptions(dir);

    const result = await resumeSaga(options);

    expect(calls.purge).toHaveBeenCalledOnce();
    expect(calls.rescan).toHaveBeenCalledOnce();
    expect(result.journal?.state).toBe("committed");
    expect(result.journal?.stores).toEqual([
      { store: "sqlite_storage", state: "done", attempts: 2 },
    ]);
    expect(result.receipt?.stores_completed).toEqual(["sqlite_storage"]);
  });
});
