/** @vitest-environment node */

/**
 * Exact new-namespace delete-all — RED-first contracts for:
 *
 *  1. the durable, PII-free journal persisted BEFORE any purge,
 *  2. the one-use, expiring nonce bound to operation/profile/exact 3 targets,
 *  3. the exact three-row purge via the dedicated helpers (no broad adapter),
 *  4. the trusted-process rescan postcondition (never a renderer report),
 *  5. idempotent retry, snapshot retention, and the fail-closed lock,
 *  6. unknown/mixed/legacy targets failing closed before any delete.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  claimNewPiiErasure,
  loadNewPiiErasureJournal,
  newPiiErasureJournalPath,
  newPiiErasureLocksPii,
  newPiiErasureSnapshotPath,
  newPiiErasureStatus,
  NewPiiErasureRefusedError,
  requestNewPiiErasure,
  runNewPiiErasure,
} from "../newPiiErasure.js";
import type { MinimalStorageDb } from "../persistGate.js";
import { NEW_PII_STORAGE_KEYS } from "../../src/shared/lib/crypto/newPiiNamespace.js";

const [CUSTOMERS, QUOTES, HISTORY] = NEW_PII_STORAGE_KEYS;
const SEALED = 'enc1:profileKey:{"v":"2.0"}';
const PROFILE = "profile-synthetic";

let dir: string;

function makeDatabase(
  seed: Array<[string, string]> = [],
  options: { deleteNoop?: boolean } = {},
) {
  const rows = new Map<string, string>(seed);
  const calls = { prepare: [] as string[], run: 0 };
  const db: MinimalStorageDb = {
    prepare(sql: string) {
      calls.prepare.push(sql);
      return {
        get(...params: unknown[]) {
          const value = rows.get(String(params[0]));
          return value === undefined ? undefined : { value };
        },
        run(...params: unknown[]) {
          calls.run++;
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
          return [...rows.keys()].sort().map((key) => ({ key }));
        },
      };
    },
  };
  return { db, rows, calls };
}

const seededRows = (): Array<[string, string]> => [
  [CUSTOMERS, SEALED],
  [QUOTES, SEALED],
  [HISTORY, SEALED],
  ["open3dcalc_customers_v1", "legacy-bytes"],
  ["open3dcalc_consent_v1", "consent-bytes"],
];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-newpii-erase-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("new-PII delete-all — durable one-use authorization", () => {
  it("persists a PII-free journal before any purge and issues an exact nonce", () => {
    const authorization = requestNewPiiErasure(
      dir,
      PROFILE,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    expect(typeof authorization.token).toBe("string");
    expect(authorization.token.length).toBeGreaterThan(0);
    expect(authorization.targets.map((t) => t.id)).toEqual(
      expect.arrayContaining([CUSTOMERS, QUOTES, HISTORY]),
    );

    const file = newPiiErasureJournalPath(dir);
    expect(fs.existsSync(file)).toBe(true);
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).not.toContain("Fernanda");
    expect(raw).not.toContain("customerSnapshot");

    const journal = loadNewPiiErasureJournal(dir);
    expect(journal?.state).toBe("pending");
    expect(journal?.claimed_nonce).toBeNull();
    expect(newPiiErasureLocksPii(dir)).toBe(true);
  });

  it("is idempotent while a request is pending: same nonce, file not rewritten", () => {
    const first = requestNewPiiErasure(dir, PROFILE);
    const file = newPiiErasureJournalPath(dir);
    const before = fs.readFileSync(file, "utf8");
    const second = requestNewPiiErasure(dir, PROFILE);
    expect(second.token).toBe(first.token);
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });

  it("refuses a different profile while one request is in progress", () => {
    requestNewPiiErasure(dir, PROFILE);
    expect(() => requestNewPiiErasure(dir, "other-profile")).toThrow(
      NewPiiErasureRefusedError,
    );
  });

  it("consumes a one-use claim and refuses a replay without touching the journal", () => {
    const { token } = requestNewPiiErasure(
      dir,
      PROFILE,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    const file = newPiiErasureJournalPath(dir);
    const claimed = claimNewPiiErasure(
      dir,
      token,
      new Date("2026-10-07T00:05:00.000Z"),
    );
    expect(claimed.targets).toHaveLength(3);
    const afterClaim = fs.readFileSync(file, "utf8");

    const replay = (() => {
      try {
        claimNewPiiErasure(dir, token, new Date("2026-10-07T00:05:00.000Z"));
      } catch (error) {
        return error as NewPiiErasureRefusedError;
      }
      return null;
    })();
    expect(replay?.reason).toBe("already_claimed");
    expect(fs.readFileSync(file, "utf8")).toBe(afterClaim);
  });

  it("refuses an expired or wrongly-bound claim", () => {
    const { token } = requestNewPiiErasure(
      dir,
      PROFILE,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    expect(() =>
      claimNewPiiErasure(dir, token, new Date("2026-10-07T02:00:00.000Z")),
    ).toThrow(/expired/);
    expect(() =>
      claimNewPiiErasure(
        dir,
        "not-the-token",
        new Date("2026-10-07T00:05:00.000Z"),
      ),
    ).toThrow(/binding_mismatch/);
  });

  it("renews an expired pending request with a fresh, usable nonce (no dead token)", () => {
    const first = requestNewPiiErasure(
      dir,
      PROFILE,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    // Past the 10-minute TTL, re-requesting must NOT hand back the dead token:
    // that deadlock is the defect. It issues a fresh nonce + expiry instead.
    const renewedAt = new Date("2026-10-07T02:00:00.000Z");
    const renewed = requestNewPiiErasure(dir, PROFILE, renewedAt);
    expect(renewed.token).not.toBe(first.token);
    expect(renewed.expiresAt).not.toBe(first.expiresAt);
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(renewedAt.getTime());
    expect(renewed.targets).toHaveLength(3);

    // The superseded nonce is rejected: renewal invalidated it.
    expect(() =>
      claimNewPiiErasure(
        dir,
        first.token,
        new Date("2026-10-07T02:01:00.000Z"),
      ),
    ).toThrow(/binding_mismatch/);

    // The fresh token is usable end to end: claim, then start purges.
    const { db, rows } = makeDatabase(seededRows());
    const plan = claimNewPiiErasure(
      dir,
      renewed.token,
      new Date("2026-10-07T02:01:00.000Z"),
    );
    expect(plan.targets).toHaveLength(3);
    const receipt = runNewPiiErasure(
      dir,
      db,
      renewed.token,
      new Date("2026-10-07T02:02:00.000Z"),
    );
    expect(receipt.purged).toHaveLength(3);
    expect(rows.has(CUSTOMERS)).toBe(false);
    expect(rows.has(QUOTES)).toBe(false);
    expect(rows.has(HISTORY)).toBe(false);
  });
});

describe("new-PII delete-all — exact purge and trusted postcondition", () => {
  it("purges exactly the three new rows, rescans clean, cleans the snapshot and completes", () => {
    const { db, rows } = makeDatabase(seededRows());
    const { token } = requestNewPiiErasure(dir, PROFILE);
    claimNewPiiErasure(dir, token);

    const receipt = runNewPiiErasure(dir, db, token);

    expect(receipt.purged).toEqual(
      expect.arrayContaining([CUSTOMERS, QUOTES, HISTORY]),
    );
    expect(rows.has(CUSTOMERS)).toBe(false);
    expect(rows.has(QUOTES)).toBe(false);
    expect(rows.has(HISTORY)).toBe(false);
    // Legacy + consent rows are untouched.
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy-bytes");
    expect(rows.get("open3dcalc_consent_v1")).toBe("consent-bytes");

    expect(fs.existsSync(newPiiErasureSnapshotPath(dir))).toBe(false);
    expect(loadNewPiiErasureJournal(dir)?.state).toBe("completed");
    expect(newPiiErasureLocksPii(dir)).toBe(false);
  });

  it("is idempotent after completion: no re-purge", () => {
    const { db, rows } = makeDatabase(seededRows());
    const { token } = requestNewPiiErasure(dir, PROFILE);
    runNewPiiErasure(dir, db, token);
    const before = fs.readFileSync(newPiiErasureJournalPath(dir), "utf8");

    // A new, unrelated row appears after completion; a resumed run must not
    // touch anything.
    rows.set(QUOTES, "new-after-completion");
    const again = runNewPiiErasure(dir, db, token);
    expect(again.purged).toEqual([]);
    expect(rows.get(QUOTES)).toBe("new-after-completion");
    expect(fs.readFileSync(newPiiErasureJournalPath(dir), "utf8")).toBe(before);
  });

  it("resumes after a claim with the same token even once the nonce expires", () => {
    const { db, rows } = makeDatabase(seededRows());
    const { token } = requestNewPiiErasure(
      dir,
      PROFILE,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    claimNewPiiErasure(dir, token, new Date("2026-10-07T00:05:00.000Z"));

    const receipt = runNewPiiErasure(
      dir,
      db,
      token,
      new Date("2026-10-07T02:00:00.000Z"),
    );
    expect(receipt.purged).toHaveLength(3);
    expect(rows.size).toBe(2);
  });

  it("fails closed when a row survives the purge: incomplete, locked, snapshot retained", () => {
    const { db } = makeDatabase(seededRows(), { deleteNoop: true });
    const { token } = requestNewPiiErasure(dir, PROFILE);
    claimNewPiiErasure(dir, token);

    const error = (() => {
      try {
        runNewPiiErasure(dir, db, token);
      } catch (e) {
        return e as NewPiiErasureRefusedError;
      }
      return null;
    })();
    expect(error?.reason).toBe("purge_unverified");
    expect(loadNewPiiErasureJournal(dir)?.state).toBe("incomplete");
    expect(newPiiErasureLocksPii(dir)).toBe(true);
    // The snapshot is retained for the retry.
    expect(fs.existsSync(newPiiErasureSnapshotPath(dir))).toBe(true);
  });

  it("retains the original snapshot across a retry and then completes", () => {
    const noop = makeDatabase(seededRows(), { deleteNoop: true });
    const { token } = requestNewPiiErasure(dir, PROFILE);
    claimNewPiiErasure(dir, token);
    expect(() => runNewPiiErasure(dir, noop.db, token)).toThrow(
      /purge_unverified/,
    );
    const snapshotAfterFailure = JSON.parse(
      fs.readFileSync(newPiiErasureSnapshotPath(dir), "utf8"),
    ) as { rows: Record<string, string | null> };
    expect(snapshotAfterFailure.rows[CUSTOMERS]).toBe(SEALED);

    // Retry against a working delete: the same snapshot must not be overwritten.
    const working = makeDatabase(seededRows());
    const receipt = runNewPiiErasure(dir, working.db, token);
    expect(receipt.purged).toHaveLength(3);
    expect(fs.existsSync(newPiiErasureSnapshotPath(dir))).toBe(false);
    expect(loadNewPiiErasureJournal(dir)?.state).toBe("completed");
  });

  it("refuses a start whose token differs from the claimed nonce", () => {
    const { db } = makeDatabase(seededRows());
    const { token } = requestNewPiiErasure(dir, PROFILE);
    claimNewPiiErasure(dir, token);
    expect(() => runNewPiiErasure(dir, db, "other-token")).toThrow(
      /binding_mismatch/,
    );
  });

  it("fails closed on a tampered plan before any delete", () => {
    const { db, rows, calls } = makeDatabase(seededRows());
    const { token } = requestNewPiiErasure(dir, PROFILE);
    // Tamper the durable plan to include a legacy key.
    const file = newPiiErasureJournalPath(dir);
    const journal = JSON.parse(fs.readFileSync(file, "utf8")) as {
      targets: Array<{ surface: string; id: string }>;
    };
    journal.targets = [
      ...journal.targets,
      { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
    ];
    fs.writeFileSync(file, JSON.stringify(journal), "utf8");

    expect(() => runNewPiiErasure(dir, db, token)).toThrow(/plan_refused/);
    expect(rows.get("open3dcalc_customers_v1")).toBe("legacy-bytes");
    expect(rows.size).toBe(5);
    expect(calls.run).toBe(0);
    expect(loadNewPiiErasureJournal(dir)?.state).toBe("incomplete");
    expect(newPiiErasureLocksPii(dir)).toBe(true);
  });
});

describe("new-PII delete-all — lock and status", () => {
  it("locks fail-closed on a corrupt journal", () => {
    fs.writeFileSync(newPiiErasureJournalPath(dir), "{ not json", "utf8");
    expect(newPiiErasureLocksPii(dir)).toBe(true);
    expect(newPiiErasureStatus(dir)).toMatchObject({
      active: true,
      available: false,
      blockerCodes: ["journal_invalid"],
      state: "invalid",
    });
  });

  it("reports an available, inactive surface without a journal", () => {
    expect(newPiiErasureStatus(dir)).toMatchObject({
      active: false,
      available: true,
      blockerCodes: [],
    });
    expect(newPiiErasureStatus(dir).targets).toHaveLength(3);
  });

  it("reports the pending state and refuses start without a request", () => {
    const { db } = makeDatabase(seededRows());
    expect(() => runNewPiiErasure(dir, db, "token")).toThrow(/no_request/);
    expect(() => claimNewPiiErasure(dir, "token")).toThrow(/no_request/);

    requestNewPiiErasure(dir, PROFILE);
    expect(newPiiErasureStatus(dir)).toMatchObject({
      active: true,
      available: true,
      state: "pending",
    });
  });

  it("issues a fresh request after a completed erase", () => {
    const { db } = makeDatabase(seededRows());
    const first = requestNewPiiErasure(dir, PROFILE);
    runNewPiiErasure(dir, db, first.token);
    expect(loadNewPiiErasureJournal(dir)?.state).toBe("completed");

    const second = requestNewPiiErasure(dir, PROFILE);
    expect(second.token).not.toBe(first.token);
    expect(loadNewPiiErasureJournal(dir)?.state).toBe("pending");
    expect(newPiiErasureLocksPii(dir)).toBe(true);
  });

  it("reports a tampered, non-exact plan as unavailable", () => {
    requestNewPiiErasure(dir, PROFILE);
    const file = newPiiErasureJournalPath(dir);
    const journal = JSON.parse(fs.readFileSync(file, "utf8")) as {
      targets: unknown;
    };
    journal.targets = [
      { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
    ];
    fs.writeFileSync(file, JSON.stringify(journal), "utf8");

    expect(newPiiErasureStatus(dir)).toMatchObject({
      available: false,
      blockerCodes: ["plan_refused"],
    });
  });
});
