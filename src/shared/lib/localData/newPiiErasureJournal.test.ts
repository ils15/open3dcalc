import { describe, expect, it } from "vitest";
import {
  applyNewPiiErasureOutcome,
  createNewPiiErasureJournal,
  isExactNewPiiErasurePlan,
  isNewPiiErasureExpired,
  isValidNewPiiErasureJournal,
  NEW_PII_ERASURE_OPERATION,
  NEW_PII_ERASURE_SURFACE,
  newPiiErasureBlocksPiiWrites,
  newPiiErasureKeyForTarget,
  newPiiErasureTargets,
  verifyNewPiiErasureClaim,
  type NewPiiErasureClaim,
  type NewPiiErasureTarget,
} from "./newPiiErasureJournal";
import { NEW_PII_STORAGE_KEYS } from "./newPiiNamespace";

const TARGETS = newPiiErasureTargets();
const INPUT = {
  requestId: "req-1",
  profile: "profile-1",
  targets: TARGETS,
  nonce: "nonce-1",
  issuedAt: "2026-10-07T00:00:00.000Z",
  expiresAt: "2026-10-07T01:00:00.000Z",
};

const CLAIM: NewPiiErasureClaim = {
  nonce: "nonce-1",
  operation: NEW_PII_ERASURE_OPERATION,
  profile: "profile-1",
  targets: TARGETS,
};

describe("new-PII erasure target plan", () => {
  it("is exactly the three authorised keys on the storage surface", () => {
    expect(TARGETS).toEqual(
      NEW_PII_STORAGE_KEYS.map((id) => ({
        surface: NEW_PII_ERASURE_SURFACE,
        id,
      })),
    );
    expect(isExactNewPiiErasurePlan(TARGETS)).toBe(true);
  });

  it.each<[string, NewPiiErasureTarget]>([
    [
      "legacy customers",
      { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
    ],
    ["domain table", { surface: "sqlite_domain_tables", id: "customers" }],
    ["stage table", { surface: "sqlite_storage_table", id: "pii_stage" }],
    [
      "residue table",
      { surface: "sqlite_storage_table", id: "legacy_residue" },
    ],
    [
      "prefix-only invented",
      { surface: "sqlite_storage_table", id: "open3dcalc_pwless_invented_v9" },
    ],
    [
      "foreign surface",
      { surface: "localStorage", id: NEW_PII_STORAGE_KEYS[0] },
    ],
  ])("refuses the %s target", (_label, target) => {
    expect(newPiiErasureKeyForTarget(target)).toBeNull();
    expect(isExactNewPiiErasurePlan([target])).toBe(false);
  });

  it("refuses a plan that is short, duplicated, or widened", () => {
    expect(isExactNewPiiErasurePlan(TARGETS.slice(1))).toBe(false);
    expect(isExactNewPiiErasurePlan([...TARGETS, TARGETS[0]])).toBe(false);
    expect(
      isExactNewPiiErasurePlan([
        ...TARGETS,
        { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
      ]),
    ).toBe(false);
    expect(isExactNewPiiErasurePlan([])).toBe(false);
    expect(isExactNewPiiErasurePlan(null as unknown as [])).toBe(false);
  });
});

describe("new-PII erasure journal", () => {
  it("builds a pending, PII-free, exactly-bound journal", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    expect(journal.state).toBe("pending");
    expect(journal.operation).toBe(NEW_PII_ERASURE_OPERATION);
    expect(journal.claimed_nonce).toBeNull();
    expect(journal.attempts).toBe(0);
    // Normalised on the way in: exact keys, sorted, de-duplicated.
    expect(journal.targets).toEqual(
      [...TARGETS].sort(
        (a, b) =>
          a.surface.localeCompare(b.surface) || a.id.localeCompare(b.id),
      ),
    );
    expect(isValidNewPiiErasureJournal(journal)).toBe(true);
    // The durable record carries no value-bearing field.
    const raw = JSON.stringify(journal);
    expect(raw).not.toContain("Fernanda");
    expect(raw).not.toContain("customerSnapshot");
  });

  it("refuses a plan that is not the exact three-key set", () => {
    expect(() =>
      createNewPiiErasureJournal({
        ...INPUT,
        targets: [
          { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
        ],
      }),
    ).toThrow(/exactly the authorised/i);
    expect(() =>
      createNewPiiErasureJournal({ ...INPUT, targets: [] }),
    ).toThrow();
    expect(() =>
      createNewPiiErasureJournal({
        ...INPUT,
        targets: "not-an-array" as never,
      }),
    ).toThrow();
    expect(() =>
      createNewPiiErasureJournal({ ...INPUT, requestId: "" }),
    ).toThrow(/requestId/);
    expect(() => createNewPiiErasureJournal({ ...INPUT, profile: "" })).toThrow(
      /profile/,
    );
  });

  it("refuses an invalid nonce or interval", () => {
    expect(() => createNewPiiErasureJournal({ ...INPUT, nonce: "" })).toThrow(
      /nonce/,
    );
    expect(() =>
      createNewPiiErasureJournal({
        ...INPUT,
        issuedAt: INPUT.expiresAt,
        expiresAt: INPUT.issuedAt,
      }),
    ).toThrow(/interval/);
    expect(() =>
      createNewPiiErasureJournal({ ...INPUT, issuedAt: "not-a-date" }),
    ).toThrow(/interval/);
  });

  it("validates the persisted shape strictly", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    expect(isValidNewPiiErasureJournal(journal)).toBe(true);
    expect(
      isValidNewPiiErasureJournal({
        ...journal,
        operation: "withdraw_consent",
      }),
    ).toBe(false);
    expect(isValidNewPiiErasureJournal({ ...journal, extra: 1 })).toBe(false);
    expect(isValidNewPiiErasureJournal({ ...journal, targets: [] })).toBe(
      false,
    );
    expect(isValidNewPiiErasureJournal({ ...journal, targets: "x" })).toBe(
      false,
    );
    expect(
      isValidNewPiiErasureJournal({
        ...journal,
        targets: [journal.targets[0], journal.targets[0]],
      }),
    ).toBe(false);
    expect(isValidNewPiiErasureJournal({ ...journal, claimed_nonce: 5 })).toBe(
      false,
    );
    expect(isValidNewPiiErasureJournal({ ...journal, state: "bogus" })).toBe(
      false,
    );
    expect(
      isValidNewPiiErasureJournal({ ...journal, issued_at: "not-a-date" }),
    ).toBe(false);
    expect(isValidNewPiiErasureJournal({ ...journal, request_id: "" })).toBe(
      false,
    );
    expect(isValidNewPiiErasureJournal({ ...journal, profile: "" })).toBe(
      false,
    );
    expect(isValidNewPiiErasureJournal({ ...journal, nonce: "" })).toBe(false);
    expect(isValidNewPiiErasureJournal({ ...journal, attempts: -1 })).toBe(
      false,
    );
    expect(isValidNewPiiErasureJournal(null)).toBe(false);
    expect(isValidNewPiiErasureJournal("nope")).toBe(false);
  });

  it("verifies an exactly-bound, unexpired claim once", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    const now = new Date("2026-10-07T00:30:00.000Z");
    expect(verifyNewPiiErasureClaim(journal, CLAIM, now)).toEqual({ ok: true });

    // A claimed journal refuses a replay.
    const claimed = { ...journal, claimed_nonce: "nonce-1" };
    expect(verifyNewPiiErasureClaim(claimed, CLAIM, now)).toEqual({
      ok: false,
      reason: "already_claimed",
    });
  });

  it("refuses expired or wrongly-bound claims", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    expect(
      verifyNewPiiErasureClaim(
        journal,
        CLAIM,
        new Date("2026-10-07T02:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "expired" });
    expect(
      verifyNewPiiErasureClaim(
        journal,
        { ...CLAIM, profile: "other" },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });
    expect(
      verifyNewPiiErasureClaim(
        journal,
        { ...CLAIM, nonce: "other" },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });
    expect(
      verifyNewPiiErasureClaim(
        journal,
        { ...CLAIM, targets: TARGETS.slice(1) },
        new Date("2026-10-07T00:30:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "binding_mismatch" });
  });

  it("applies outcomes idempotently and never reopens a completed journal", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    const incomplete = applyNewPiiErasureOutcome(journal, "incomplete");
    expect(incomplete.state).toBe("incomplete");
    expect(incomplete.attempts).toBe(1);
    expect(applyNewPiiErasureOutcome(incomplete, "incomplete")).toEqual(
      incomplete,
    );

    const completed = applyNewPiiErasureOutcome(incomplete, "completed");
    expect(completed.state).toBe("completed");
    expect(applyNewPiiErasureOutcome(completed, "incomplete")).toEqual(
      completed,
    );
  });

  it("blocks new-PII writes until verifiably completed", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    expect(newPiiErasureBlocksPiiWrites(journal)).toBe(true);
    expect(
      newPiiErasureBlocksPiiWrites(
        applyNewPiiErasureOutcome(journal, "incomplete"),
      ),
    ).toBe(true);
    expect(
      newPiiErasureBlocksPiiWrites(
        applyNewPiiErasureOutcome(journal, "completed"),
      ),
    ).toBe(false);
  });

  it("reports expiry at and after the deadline", () => {
    const journal = createNewPiiErasureJournal(INPUT);
    expect(
      isNewPiiErasureExpired(journal, new Date("2026-10-07T00:59:59.999Z")),
    ).toBe(false);
    expect(
      isNewPiiErasureExpired(journal, new Date("2026-10-07T01:00:00.000Z")),
    ).toBe(true);
  });
});
