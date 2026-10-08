/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  claimWithdrawalVerification,
  completeWithdrawal,
  loadWithdrawalJournal,
  markWithdrawalIncomplete,
  requestWithdrawal,
  withdrawalJournalPath,
  withdrawalLocksPii,
} from "../withdrawalJournal.js";
import type { WithdrawalClaim } from "../../src/shared/lib/consent/withdrawal.js";

let dir: string;

const INPUT = {
  requestId: "req-1",
  profile: "profile-1",
  targets: [
    { surface: "localStorage", id: "open3dcalc_customers_v1" },
    { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
  ],
  receiptId: "receipt-1",
  nonce: "nonce-1",
  issuedAt: "2026-10-07T00:00:00.000Z",
  expiresAt: "2026-10-07T01:00:00.000Z",
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "o3dc-withdrawal-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("durable withdrawal journal", () => {
  it("persists a PII-free request durably before any purge", () => {
    const journal = requestWithdrawal(dir, INPUT);
    expect(journal.state).toBe("pending");

    const file = withdrawalJournalPath(dir);
    expect(fs.existsSync(file)).toBe(true);
    const raw = fs.readFileSync(file, "utf8");
    // Metadata only: no value-bearing field ever reaches the journal.
    expect(raw).not.toContain("Fernanda");
    expect(raw).not.toContain("customerSnapshot");
    expect(loadWithdrawalJournal(dir)).toEqual(journal);
    expect(withdrawalLocksPii(dir)).toBe(true);
  });

  it("is idempotent on retry: the same request id does not rewrite the file", () => {
    const first = requestWithdrawal(dir, INPUT);
    const file = withdrawalJournalPath(dir);
    const before = fs.readFileSync(file, "utf8");

    const second = requestWithdrawal(dir, INPUT);
    expect(second).toEqual(first);
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });

  it("refuses a different request while one is pending (no silent overwrite)", () => {
    requestWithdrawal(dir, INPUT);
    expect(() =>
      requestWithdrawal(dir, { ...INPUT, requestId: "req-2" }),
    ).toThrow(/pending/i);
  });

  it("consumes a one-use, exactly-bound, unexpired verification claim", () => {
    requestWithdrawal(dir, INPUT);
    const claim: WithdrawalClaim = {
      nonce: "nonce-1",
      operation: "withdraw_consent",
      profile: "profile-1",
      targets: INPUT.targets,
    };
    const now = new Date("2026-10-07T00:30:00.000Z");

    expect(claimWithdrawalVerification(dir, claim, now)).toMatchObject({
      ok: true,
    });
    // One-use: a replay is refused.
    expect(claimWithdrawalVerification(dir, claim, now)).toEqual({
      ok: false,
      reason: "already_claimed",
    });
  });

  it("refuses an expired or wrongly-bound claim without touching the journal", () => {
    requestWithdrawal(dir, INPUT);
    const before = fs.readFileSync(withdrawalJournalPath(dir), "utf8");
    const base: WithdrawalClaim = {
      nonce: "nonce-1",
      operation: "withdraw_consent",
      profile: "profile-1",
      targets: INPUT.targets,
    };

    expect(
      claimWithdrawalVerification(
        dir,
        base,
        new Date("2026-10-07T02:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "expired" });
    expect(
      claimWithdrawalVerification(
        dir,
        { ...base, profile: "other" },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });
    expect(fs.readFileSync(withdrawalJournalPath(dir), "utf8")).toBe(before);
  });

  it("keeps the PII lock until the withdrawal is verifiably completed", () => {
    requestWithdrawal(dir, INPUT);
    const incomplete = markWithdrawalIncomplete(dir, "req-1");
    expect(incomplete.state).toBe("incomplete");
    expect(withdrawalLocksPii(dir)).toBe(true);
  });

  it("survives a restart as completed: lock releases, re-apply is a no-op", () => {
    // Durable BEFORE the purge: pending → claimed (one-use nonce consumed).
    requestWithdrawal(dir, INPUT);
    const claim: WithdrawalClaim = {
      nonce: "nonce-1",
      operation: "withdraw_consent",
      profile: "profile-1",
      targets: INPUT.targets,
    };
    expect(
      claimWithdrawalVerification(
        dir,
        claim,
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toMatchObject({ ok: true });

    const completed = completeWithdrawal(dir, "req-1");
    expect(completed.state).toBe("completed");
    const file = withdrawalJournalPath(dir);
    const durableBytes = fs.readFileSync(file, "utf8");

    // ── Restart ────────────────────────────────────────────────────────
    // A fresh reader with no in-memory state recovers the terminal state from
    // the fsync+rename record alone.
    const reloaded = loadWithdrawalJournal(dir);
    expect(reloaded?.state).toBe("completed");
    // Only a verifiably COMPLETED journal releases the new-PII write lock.
    expect(withdrawalLocksPii(dir)).toBe(false);

    // ── No re-purge / idempotent re-apply ─────────────────────────────
    // A resumed pass re-applies completion as a no-op: the durable record is
    // byte-identical, so nothing re-runs and nothing is downgraded.
    expect(completeWithdrawal(dir, "req-1")).toEqual(reloaded);
    expect(fs.readFileSync(file, "utf8")).toBe(durableBytes);

    // A late "incomplete" (a retry racing the completion) cannot reopen it.
    expect(markWithdrawalIncomplete(dir, "req-1")).toEqual(reloaded);
    expect(fs.readFileSync(file, "utf8")).toBe(durableBytes);
  });

  it("refuses to complete a request that is not the durable one", () => {
    requestWithdrawal(dir, INPUT);
    const file = withdrawalJournalPath(dir);
    const before = fs.readFileSync(file, "utf8");
    expect(() => completeWithdrawal(dir, "req-other")).toThrow(/not found/i);
    expect(fs.readFileSync(file, "utf8")).toBe(before);
  });

  it("preserves an invalid journal rather than overwriting it", () => {
    const file = withdrawalJournalPath(dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, "{ not json", "utf8");
    expect(() => loadWithdrawalJournal(dir)).toThrow();
    expect(() => requestWithdrawal(dir, INPUT)).toThrow();
    expect(fs.readFileSync(file, "utf8")).toBe("{ not json");
  });
});
