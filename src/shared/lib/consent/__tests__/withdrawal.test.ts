import { describe, expect, it } from "vitest";
import {
  applyWithdrawalOutcome,
  createWithdrawalJournal,
  isWithdrawalExpired,
  isValidWithdrawalJournal,
  verifyWithdrawalClaim,
  withdrawalBlocksPiiWrites,
  type WithdrawalJournal,
} from "../withdrawal";

const TARGETS = [
  { surface: "localStorage", id: "open3dcalc_customers_v1" },
  { surface: "vault", id: "open3dcalc_customers_v1" },
];

function fixture(
  overrides: Partial<WithdrawalJournal> = {},
): WithdrawalJournal {
  return {
    ...createWithdrawalJournal({
      requestId: "req-1",
      profile: "profile-1",
      targets: TARGETS,
      receiptId: "receipt-1",
      nonce: "nonce-1",
      issuedAt: "2026-10-07T00:00:00.000Z",
      expiresAt: "2026-10-07T01:00:00.000Z",
    }),
    ...overrides,
  };
}

describe("withdrawal journal contract", () => {
  it("creates a PII-free, target-scoped journal", () => {
    const journal = fixture();
    // No value-bearing field: identifiers and policy metadata only.
    expect(Object.keys(journal).sort()).toEqual(
      [
        "attempts",
        "claimed_nonce",
        "expires_at",
        "issued_at",
        "nonce",
        "operation",
        "profile",
        "receipt_id",
        "request_id",
        "state",
        "targets",
      ].sort(),
    );
    expect(journal.state).toBe("pending");
    expect(journal.claimed_nonce).toBeNull();
  });

  it("normalizes target order and refuses duplicates", () => {
    const journal = createWithdrawalJournal({
      requestId: "req-1",
      profile: "profile-1",
      targets: [TARGETS[1], TARGETS[0], TARGETS[0]],
      receiptId: "receipt-1",
      nonce: "nonce-1",
      issuedAt: "2026-10-07T00:00:00.000Z",
      expiresAt: "2026-10-07T01:00:00.000Z",
    });
    expect(journal.targets).toEqual(TARGETS);
  });

  it.each([
    ["missing request id", { request_id: "" }],
    ["missing profile", { profile: "" }],
    ["unknown operation", { operation: "delete_all" }],
    ["empty targets", { targets: [] }],
    ["unknown state", { state: "almost_done" }],
    ["negative attempts", { attempts: -1 }],
    ["extra field", { pii: "x" }],
  ])("rejects a journal with %s", (_name, override) => {
    expect(isValidWithdrawalJournal({ ...fixture(), ...override })).toBe(false);
  });

  it("accepts a well-formed journal", () => {
    expect(isValidWithdrawalJournal(fixture())).toBe(true);
  });

  it("treats a journal as expired at or after expires_at", () => {
    const journal = fixture();
    expect(
      isWithdrawalExpired(journal, new Date("2026-10-07T00:59:00.000Z")),
    ).toBe(false);
    expect(
      isWithdrawalExpired(journal, new Date("2026-10-07T01:00:00.000Z")),
    ).toBe(true);
  });

  it("verifies a one-use claim bound to operation, profile and exact targets", () => {
    const journal = fixture();
    const claim = {
      nonce: "nonce-1",
      operation: "withdraw_consent" as const,
      profile: "profile-1",
      targets: TARGETS,
    };
    expect(
      verifyWithdrawalClaim(
        journal,
        claim,
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: true });

    expect(
      verifyWithdrawalClaim(
        journal,
        { ...claim, profile: "other" },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });

    expect(
      verifyWithdrawalClaim(
        journal,
        { ...claim, targets: [TARGETS[0], { surface: "vault", id: "extra" }] },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });

    expect(
      verifyWithdrawalClaim(
        journal,
        { ...claim, nonce: "wrong" },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });
  });

  it("refuses an expired claim and a replayed (already-claimed) nonce", () => {
    const journal = fixture();
    const claim = {
      nonce: "nonce-1",
      operation: "withdraw_consent" as const,
      profile: "profile-1",
      targets: TARGETS,
    };
    expect(
      verifyWithdrawalClaim(
        journal,
        claim,
        new Date("2026-10-07T02:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "expired" });

    expect(
      verifyWithdrawalClaim(
        fixture({ claimed_nonce: "nonce-1" }),
        claim,
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "already_claimed" });
  });

  it("applies an outcome idempotently and never downgrades a completion", () => {
    const pending = fixture();
    const incomplete = applyWithdrawalOutcome(pending, "incomplete");
    expect(incomplete.state).toBe("incomplete");
    expect(incomplete.attempts).toBe(1);
    // Re-applying the same outcome does not inflate attempts.
    expect(applyWithdrawalOutcome(incomplete, "incomplete")).toEqual(
      incomplete,
    );

    const completed = applyWithdrawalOutcome(incomplete, "completed");
    expect(completed.state).toBe("completed");
    // A late incomplete result cannot reopen a completed withdrawal.
    expect(applyWithdrawalOutcome(completed, "incomplete")).toEqual(completed);
  });

  it("blocks new PII writes until the withdrawal is verifiably completed", () => {
    expect(withdrawalBlocksPiiWrites(fixture())).toBe(true);
    expect(
      withdrawalBlocksPiiWrites(
        applyWithdrawalOutcome(fixture(), "incomplete"),
      ),
    ).toBe(true);
    expect(
      withdrawalBlocksPiiWrites(applyWithdrawalOutcome(fixture(), "completed")),
    ).toBe(false);
  });
});
