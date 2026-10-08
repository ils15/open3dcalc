/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { isValidConsentRecordValue } from "../consentRecord.js";

/**
 * The generic `db:save` IPC is keyed by a fixed non-PII allowlist, but the
 * VALUE it carries was previously unvalidated: any renderer (or a compromised
 * one) could write an arbitrary blob into the consent row. The consent row is
 * the tamper-evident receipt's only durable home, so its shape is part of the
 * contract. These tests pin the fail-closed validator.
 */

function validRecord(state: Record<string, unknown> = {}): string {
  return JSON.stringify({
    state: {
      privacyBannerDismissed: false,
      consentGiven: false,
      consentDate: null,
      receipt: null,
      receiptDigest: null,
      withdrawnReceipts: [],
      migrationConsentGiven: false,
      migrationConsentDate: null,
      migrationReceipt: null,
      migrationReceiptDigest: null,
      withdrawnMigrationReceipts: [],
      ...state,
    },
    version: 1,
  });
}

describe("consent record value validation", () => {
  it("accepts a structurally valid persisted consent record", () => {
    expect(isValidConsentRecordValue(validRecord())).toBe(true);
  });

  it("accepts a record whose receipt fields are present", () => {
    const receipt = {
      receipt_id: "synthetic-id",
      receipt_version: "1.0",
      policy_version: "1.8",
      policy_hash: "sha256:synthetic",
      granted_at: "2026-10-07T00:00:00.000Z",
      scope: ["customers"],
      legal_basis: "consent",
      purposes: ["issue_quotes"],
      withdrawn_at: null,
    };
    expect(
      isValidConsentRecordValue(
        validRecord({
          consentGiven: true,
          consentDate: 1,
          receipt,
          receiptDigest: "sha256:synthetic",
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["arbitrary text", "not json at all"],
    ["a JSON array", "[]"],
    ["a JSON string", '"consent"'],
    ["a number", "42"],
    ["null", "null"],
  ])("rejects %s", (_name, raw) => {
    expect(isValidConsentRecordValue(raw)).toBe(false);
  });

  it("rejects a record missing the state envelope", () => {
    expect(isValidConsentRecordValue(JSON.stringify({ version: 1 }))).toBe(
      false,
    );
  });

  it("rejects unknown top-level and state fields", () => {
    expect(
      isValidConsentRecordValue(
        JSON.stringify({ state: {}, version: 1, extra: "x" }),
      ),
    ).toBe(false);
    expect(
      isValidConsentRecordValue(validRecord({ customerName: "Fernanda" })),
    ).toBe(false);
  });

  it("rejects a receipt with an unexpected field or illegal legal_basis", () => {
    const base = {
      receipt_id: "synthetic-id",
      receipt_version: "1.0",
      policy_version: "1.8",
      policy_hash: "sha256:synthetic",
      granted_at: "2026-10-07T00:00:00.000Z",
      scope: ["customers"],
      legal_basis: "consent",
      purposes: ["issue_quotes"],
      withdrawn_at: null,
    };
    expect(
      isValidConsentRecordValue(
        validRecord({
          receipt: { ...base, email: "a@b.c" },
          receiptDigest: "sha256:x",
        }),
      ),
    ).toBe(false);
    expect(
      isValidConsentRecordValue(
        validRecord({
          receipt: { ...base, legal_basis: "not_personal_data" },
          receiptDigest: "sha256:x",
        }),
      ),
    ).toBe(false);
  });

  it("rejects an oversized value before parsing", () => {
    expect(isValidConsentRecordValue("x".repeat(70 * 1024))).toBe(false);
  });

  it.each([
    ["consentGiven", "yes"],
    ["consentDate", "not-a-date"],
    ["receiptDigest", 5],
    ["withdrawnReceipts", "not-an-array"],
  ])("rejects a malformed state field %s", (field, value) => {
    expect(isValidConsentRecordValue(validRecord({ [field]: value }))).toBe(
      false,
    );
  });
});
