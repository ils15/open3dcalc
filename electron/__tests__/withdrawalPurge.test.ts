/** @vitest-environment node */

/**
 * Production withdrawal purge — RED-first contracts for:
 *
 *  1. receipt-scoped purge of ONLY the linked new-PII rows,
 *  2. `completeWithdrawal` as the production completion path,
 *  3. the lock releasing only after a verified purge,
 *  4. incomplete staying locked and retryable, never a false success,
 *  5. legacy/mixed targets failing closed before any delete.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { WithdrawalClaim } from "../../src/shared/lib/consent/withdrawal.js";
import { NEW_PII_STORAGE_KEYS } from "../../src/shared/lib/localData/newPiiNamespace.js";
import type { MinimalStorageDb } from "../storageRows.js";
import {
  runWithdrawalPurge,
  newPiiWithdrawalTargets,
} from "../withdrawalPurge.js";
import {
  loadWithdrawalJournal,
  requestWithdrawal,
  withdrawalLocksPii,
} from "../withdrawalJournal.js";

const [CUSTOMERS, QUOTES, HISTORY] = NEW_PII_STORAGE_KEYS;
const SEALED = 'enc1:profileKey:{"v":"2.0"}';
const PROFILE = "profile-synthetic";

let dir: string;

function makeDatabase(
  seed: Array<[string, string]> = [],
  options: { deleteNoop?: boolean } = {},
) {
  const rows = new Map<string, string>(seed);
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      return {
        get(...params: unknown[]) {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          if (sql.includes("INSERT INTO storage")) {
            rows.set(String(params[0]), String(params[1]));
          } else if (
            sql.includes("DELETE FROM storage") &&
            !options.deleteNoop
          ) {
            rows.delete(String(params[0]));
          }
          return undefined;
        },
        all() {
          return [...rows.keys()].map((key) => ({ key }));
        },
      };
    },
  };
  return { db, rows };
}

function seedJournal(
  targets = newPiiWithdrawalTargets(["customers", "quotes", "history"]),
) {
  const input = {
    requestId: "req-w-1",
    profile: PROFILE,
    targets,
    receiptId: "receipt-1",
    nonce: "nonce-w-1",
    issuedAt: "2026-10-07T00:00:00.000Z",
    expiresAt: "2026-10-07T00:10:00.000Z",
  };
  requestWithdrawal(dir, input);
  const claim: WithdrawalClaim = {
    nonce: "nonce-w-1",
    operation: "withdraw_consent",
    profile: PROFILE,
    targets,
  };
  return claim;
}

const seeded = (): Array<[string, string]> => [
  [CUSTOMERS, SEALED],
  [QUOTES, SEALED],
  [HISTORY, SEALED],
  ["open3dcalc_customers_v1", "legacy"],
];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-withdrawal-purge-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("newPiiWithdrawalTargets", () => {
  it("maps only the scoped new-PII domains", () => {
    expect(
      newPiiWithdrawalTargets(["customers", "history"]).map((t) => t.id),
    ).toEqual([CUSTOMERS, HISTORY]);
    expect(newPiiWithdrawalTargets(["dashboard"])).toEqual([]);
  });
});

describe("runWithdrawalPurge", () => {
  it("purges only the scoped new-PII rows and completes through completeWithdrawal", () => {
    const { db, rows } = makeDatabase(seeded());
    const claim = seedJournal();
    const now = new Date("2026-10-07T00:05:00.000Z");

    const result = runWithdrawalPurge({ dir, db, claim, now });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      purged: expect.arrayContaining([CUSTOMERS, QUOTES, HISTORY]),
    });
    expect(rows.has(CUSTOMERS)).toBe(false);
    expect(rows.has(QUOTES)).toBe(false);
    expect(rows.has(HISTORY)).toBe(false);
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy");
    expect(loadWithdrawalJournal(dir)?.state).toBe("completed");
    expect(withdrawalLocksPii(dir)).toBe(false);
  });

  it("is idempotent after completion: no re-purge", () => {
    const { db, rows } = makeDatabase(seeded());
    const claim = seedJournal();
    const now = new Date("2026-10-07T00:05:00.000Z");
    runWithdrawalPurge({ dir, db, claim, now });

    rows.set(QUOTES, "new-after-completion");
    const again = runWithdrawalPurge({ dir, db, claim, now });
    expect(again).toEqual({ ok: true, purged: [] });
    expect(rows.get(QUOTES)).toBe("new-after-completion");
  });

  it("fails closed on a legacy target before any delete, keeping the lock", () => {
    const { db, rows } = makeDatabase(seeded());
    const claim = seedJournal([
      { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
    ]);
    const now = new Date("2026-10-07T00:05:00.000Z");

    const result = runWithdrawalPurge({ dir, db, claim, now });

    expect(result).toEqual({ ok: false, reason: "plan_refused" });
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy");
    expect(loadWithdrawalJournal(dir)?.state).toBe("incomplete");
    expect(withdrawalLocksPii(dir)).toBe(true);
  });

  it("stays locked and retryable when a row survives, then completes on retry", () => {
    const noop = makeDatabase(seeded(), { deleteNoop: true });
    const claim = seedJournal();
    const now = new Date("2026-10-07T00:05:00.000Z");

    expect(runWithdrawalPurge({ dir, db: noop.db, claim, now })).toEqual({
      ok: false,
      reason: "purge_unverified",
    });
    expect(loadWithdrawalJournal(dir)?.state).toBe("incomplete");
    expect(withdrawalLocksPii(dir)).toBe(true);

    const working = makeDatabase(seeded());
    const retried = runWithdrawalPurge({ dir, db: working.db, claim, now });
    expect(retried.ok).toBe(true);
    expect(retried).toMatchObject({
      purged: expect.arrayContaining([CUSTOMERS, QUOTES, HISTORY]),
    });
    expect(loadWithdrawalJournal(dir)?.state).toBe("completed");
    expect(withdrawalLocksPii(dir)).toBe(false);
  });

  it("refuses a wrong token and an expired request", () => {
    const { db } = makeDatabase(seeded());
    const claim = seedJournal();
    expect(
      runWithdrawalPurge({
        dir,
        db,
        claim: { ...claim, nonce: "other" },
        now: new Date("2026-10-07T00:05:00.000Z"),
      }),
    ).toEqual({ ok: false, reason: "binding_mismatch" });

    const expired = makeDatabase(seeded());
    expect(
      runWithdrawalPurge({
        dir,
        db: expired.db,
        claim,
        now: new Date("2026-10-07T02:00:00.000Z"),
      }),
    ).toEqual({ ok: false, reason: "expired" });
    expect(withdrawalLocksPii(dir)).toBe(true);
  });

  it("refuses without a durable journal", () => {
    const { db } = makeDatabase(seeded());
    const claim: WithdrawalClaim = {
      nonce: "nonce-w-1",
      operation: "withdraw_consent",
      profile: PROFILE,
      targets: newPiiWithdrawalTargets(["customers"]),
    };
    expect(runWithdrawalPurge({ dir, db, claim, now: new Date() })).toEqual({
      ok: false,
      reason: "no_request",
    });
  });
});
