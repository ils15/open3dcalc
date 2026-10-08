/**
 * Policy 1.9 supersedes the former staged-migration manifest target while
 * preserving the exact Stable plaintext scope and receipt version binding.
 */

import { describe, it, expect } from "vitest";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import {
  getEntry,
  isKnownKey,
  loadManifest,
  type ManifestDocument,
} from "@/shared/lib/dataManifest";
import {
  evaluateReceipt,
  issueReceipt,
  receiptDigest,
  type ConsentReceipt,
} from "@/shared/lib/consentReceipt";
import { PII_CONTENT_TABLES } from "../../../../electron/piiDomainTables";

const doc = manifestFixture as ManifestDocument;
const manifest = loadManifest(doc);
const CURRENT_PII_KEY = "open3dcalc_customers_v1";

async function receiptUnderPolicy(
  policyVersion: string,
  policyHash: string,
): Promise<{ receipt: ConsentReceipt; digest: string }> {
  const { receipt } = await issueReceipt(
    [CURRENT_PII_KEY],
    ["local_plaintext"],
  );
  const under = {
    ...receipt,
    policy_version: policyVersion,
    policy_hash: policyHash,
  };
  return { receipt: under, digest: await receiptDigest(under) };
}

describe("SPEC-01 policy 1.9: former staged migration targets are retired", () => {
  it.each(["pii_stage", "legacy_residue"])(
    "%s is not an active manifest destination",
    (key) => {
      expect(isKnownKey(manifest, key)).toBe(false);
      expect(doc.keys.some((entry) => entry.key === key)).toBe(false);
    },
  );

  it("keeps the four current PII SQLite content tables encrypted", () => {
    const entries = doc.keys.filter(
      (entry) => entry.surface === "sqlite_domain_tables" && entry.pii,
    );
    expect(entries.map((entry) => entry.key).sort()).toEqual(
      [...PII_CONTENT_TABLES].sort(),
    );
    expect(
      entries.every((entry) => entry.persistence === "encrypted_at_rest"),
    ).toBe(true);
    expect(getEntry(manifest, CURRENT_PII_KEY)?.persistence).toBe(
      "plaintext_allowed",
    );
  });

  it("does not turn retirement into a data migration or cleanup", () => {
    // The policy version changes the active contract only; historical profile
    // bytes are outside this fixture-level test and remain untouched.
    expect(doc.policy_version).toBe("1.9");
  });
});

describe("SPEC-04: policy 1.9 re-consents a policy 1.8 receipt", () => {
  it("marks an intact old receipt policy_mismatch, not tampered", async () => {
    const { receipt, digest } = await receiptUnderPolicy(
      "1.8",
      `sha256:${"0".repeat(64)}`,
    );
    const evaluation = await evaluateReceipt({ receipt, digest });
    expect(evaluation.status).toBe("policy_mismatch");
    expect(evaluation.consentGiven).toBe(false);
    expect(evaluation.receipt?.policy_version).toBe("1.8");
    expect(evaluation.currentPolicyVersion).toBe("1.9");
  });

  it("accepts a receipt issued under the current policy", async () => {
    const { receipt } = await issueReceipt(
      [CURRENT_PII_KEY],
      ["local_plaintext"],
    );
    const evaluation = await evaluateReceipt({
      receipt,
      digest: await receiptDigest(receipt),
    });
    expect(receipt.policy_version).toBe("1.9");
    expect(evaluation.status).toBe("valid");
    expect(evaluation.consentGiven).toBe(true);
  });
});
