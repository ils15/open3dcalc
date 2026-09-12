import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  issueReceipt,
  evaluateReceipt,
  receiptDigest,
  currentPolicyHash,
  annotateWithdrawn,
  consentErasurePlan,
  anonymizeRecord,
} from "@/shared/lib/consentReceipt";
import { canonicalJson } from "@/shared/lib/crypto/envelope";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import { createExportEnvelope } from "@/shared/lib/exportEnvelope";

// ---------------------------------------------------------------------------
// D1.1 S8 — consent receipt contract tests (TEST-MATRIX §8, SPEC-04).
// Synthetic payloads only — never real PII.
// ---------------------------------------------------------------------------

const SCOPE = ["customers", "quotes", "history", "dashboard"];
const PURPOSES = ["issue_quotes", "cross_device_sync"];

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("§8.1 receipt issuance and verification", () => {
  it("issues a policy-bound receipt that verifies as valid", async () => {
    const { receipt, digest } = await issueReceipt(SCOPE, PURPOSES);
    expect(receipt.receipt_version).toBe("1.0");
    expect(receipt.policy_version).toBe(
      (manifestFixture as { policy_version: string }).policy_version,
    );
    expect(receipt.withdrawn_at).toBeNull();
    // policy_hash binds the exact canonical manifest content:
    const expectedHash = `sha256:${
      (await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalJson(manifestFixture)),
      )) instanceof Object
        ? Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(canonicalJson(manifestFixture)),
              ),
            ),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        : ""
    }`;
    expect(receipt.policy_hash).toBe(expectedHash);
    const evaluation = await evaluateReceipt({ receipt, digest });
    expect(evaluation.status).toBe("valid");
    expect(evaluation.consentGiven).toBe(true);
    expect(evaluation.currentPolicyHash).toBe(receipt.policy_hash);
  });

  it("the digest verifies and detects any mutation (§5)", async () => {
    const { receipt, digest } = await issueReceipt(SCOPE, PURPOSES);
    expect(await receiptDigest(receipt)).toBe(digest);
    const mutated = { ...receipt, granted_at: "2020-01-01T00:00:00Z" };
    expect(await receiptDigest(mutated)).not.toBe(digest);
  });
});

describe("§8.2 tamper detection (default-deny, never repaired)", () => {
  it("a flipped receipt byte ⇒ tampered ⇒ consent not given", async () => {
    const { receipt, digest } = await issueReceipt(SCOPE, PURPOSES);
    const tamperedReceipt = { ...receipt, scope: ["everything"] };
    const evaluation = await evaluateReceipt({
      receipt: tamperedReceipt,
      digest,
    });
    expect(evaluation.status).toBe("tampered");
    expect(evaluation.consentGiven).toBe(false);
  });

  it("a tampered receipt is never repaired — re-evaluation stays denied", async () => {
    const { receipt, digest } = await issueReceipt(SCOPE, PURPOSES);
    const tampered = { ...receipt, purposes: ["whatever"] };
    const first = await evaluateReceipt({ receipt: tampered, digest });
    const second = await evaluateReceipt({ receipt: tampered, digest });
    expect(first.status).toBe("tampered");
    expect(second.status).toBe("tampered");
    expect(second.consentGiven).toBe(false);
  });
});

describe("§8.3 flags-only state — consent NOT given", () => {
  it("absent receipt ⇒ default-deny even with every flag set", async () => {
    // Tutorial/onboarding/migration/quickstart flags may all be set — they
    // are onboarding_flag records and NEVER satisfy consent (SPEC-04 §2).
    window.localStorage.setItem("open3dcalc_tutorial_v1", "done");
    window.localStorage.setItem("open3dcalc_onboarded", "true");
    window.localStorage.setItem("open3dcalc_quickstart_dismissed", "true");
    const evaluation = await evaluateReceipt(null);
    expect(evaluation.status).toBe("absent");
    expect(evaluation.consentGiven).toBe(false);
  });
});

describe("§8.4 withdrawal — exact effect per the manifest", () => {
  it("annotates withdrawn_at and keeps the receipt as the audit record", async () => {
    const { receipt } = await issueReceipt(SCOPE, PURPOSES);
    const withdrawn = annotateWithdrawn(receipt, "2026-09-12T00:00:00Z");
    expect(withdrawn.withdrawn_at).toBe("2026-09-12T00:00:00Z");
    const evaluation = await evaluateReceipt({
      receipt: withdrawn,
      digest: await receiptDigest(withdrawn),
    });
    expect(evaluation.status).toBe("withdrawn");
    expect(evaluation.consentGiven).toBe(false);
  });

  it("the erasure plan derives from legal_basis/erasure per the manifest", () => {
    const plan = consentErasurePlan();
    const fixtureKeys = (
      manifestFixture as {
        keys: Array<{ key: string; legal_basis: string; erasure: string }>;
      }
    ).keys;
    const expectedErase = fixtureKeys
      .filter(
        (k) =>
          k.legal_basis === "consent" && k.erasure === "erase_on_delete_all",
      )
      .map((k) => k.key);
    const expectedAnonymize = fixtureKeys
      .filter(
        (k) => k.legal_basis === "consent" && k.erasure === "retain_anonymized",
      )
      .map((k) => k.key);
    expect(plan.erase).toEqual(expectedErase);
    expect(plan.anonymize).toEqual(expectedAnonymize);
  });

  it("anonymizeRecord strips identifying fields, keeps aggregates", () => {
    const anonymized = anonymizeRecord({
      name: "Fernanda Sintética",
      email: "fernanda@exemplo.teste",
      totalCost: 42,
      quantity: 3,
    }) as Record<string, unknown>;
    expect(anonymized.name).toBeUndefined();
    expect(anonymized.email).toBeUndefined();
    expect(anonymized.totalCost).toBe(42);
    expect(anonymized.quantity).toBe(3);
    const list = anonymizeRecord([
      { name: "A", customerId: "c1", profit: 1 },
      { name: "B", customerId: "c2", profit: 2 },
    ]) as Array<Record<string, unknown>>;
    expect(
      list.every((r) => r.name === undefined && r.customerId === undefined),
    ).toBe(true);
    expect(list.every((r) => typeof r.profit === "number")).toBe(true);
  });
});

describe("§8.5 policy version change — re-consent required", () => {
  it("a receipt bound to another policy does not carry over", async () => {
    const { receipt, digest } = await issueReceipt(SCOPE, PURPOSES);
    const evaluation = await evaluateReceipt({ receipt, digest });
    expect(evaluation.status).toBe("valid");
    // Policy changed ⇒ the receipt's hash no longer matches the current one:
    const changed = {
      ...receipt,
      policy_version: "9.9",
      policy_hash: "sha256:deadbeef",
    };
    const mismatch = await evaluateReceipt({
      receipt: changed,
      digest: await receiptDigest(changed),
    });
    expect(mismatch.status).toBe("policy_mismatch");
    expect(mismatch.consentGiven).toBe(false);
    // The old receipt is retained for the delta/history UI:
    expect(mismatch.receipt).toBeDefined();
  });

  it("the current policy hash is stable across calls", async () => {
    expect(await currentPolicyHash()).toBe(await currentPolicyHash());
    expect(await currentPolicyHash()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("§8.6 receipts never leave the device", () => {
  it("the SPEC-03 export envelope never contains receipt material", async () => {
    const payload = {
      settings: {},
      history: [],
      customers: [],
      quotes: [],
      catalog: { printers: [], materials: [], marketplaces: [] },
      filaments: [],
      theme: "dark",
      dashboard: {},
      sections: {},
    };
    const envelope = await createExportEnvelope(
      payload,
      "senha-sintética-3131",
    );
    expect(envelope).not.toContain("receipt_id");
    expect(envelope).not.toContain("receipt_digest");
    expect(envelope).not.toContain("withdrawn_at");
  });
});
