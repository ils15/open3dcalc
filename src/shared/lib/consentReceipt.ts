/**
 * Consent receipt (D1.1 S8) — SPEC-04.
 *
 * Consent is a tamper-EVIDENT, canonicalized, policy-bound record — never a
 * boolean flag. Tutorial/onboarding/migration flags and banner dismissal
 * NEVER satisfy consent (§2). If the receipt is absent, tampered, or bound
 * to a different policy version, consent is NOT given (default-deny, §6).
 *
 * - `policy_hash` = sha256 of the canonical SPEC-01 manifest document (the
 *   exact policy the user saw) — deterministic across platforms.
 * - `receipt_digest` = sha256 of the canonical receipt; recomputed on every
 *   load. Mismatch ⇒ invalid ⇒ re-consent (the app never repairs).
 * - Withdrawal annotates `withdrawn_at` and triggers the scoped SPEC-02
 *   saga over `legal_basis: consent` keys — never touching non-consent data.
 * - Receipts are `sync: never`, `export: never` — they never leave the
 *   device.
 */

import { canonicalJson } from "./crypto/envelope";
import { getShippedPolicyVersion } from "./shippedManifest";
import manifestFixture from "../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "./dataManifest";

export const RECEIPT_VERSION = "1.0";

export interface ConsentReceipt {
  receipt_id: string;
  receipt_version: string;
  policy_version: string;
  policy_hash: string;
  granted_at: string;
  scope: string[];
  legal_basis: "consent";
  purposes: string[];
  withdrawn_at: null | string;
}

export type ReceiptStatus =
  "valid" | "absent" | "tampered" | "policy_mismatch" | "withdrawn";

export interface ReceiptEvaluation {
  status: ReceiptStatus;
  /** True only for status `valid` (default-deny otherwise, §6). */
  consentGiven: boolean;
  /** sha256:<hex> of the CURRENT canonical policy — for the delta UI. */
  currentPolicyHash: string;
  currentPolicyVersion: string;
  receipt?: ConsentReceipt;
}

/** sha256 hex over a UTF-8 string. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text) as BufferSource,
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * The canonical policy document hash (SPEC-04 §4): sha256 of the canonical
 * SPEC-01 manifest content. Deterministic across platforms/versions.
 */
export async function currentPolicyHash(): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(manifestFixture))}`;
}

/** The receipt digest: sha256 of the canonical receipt (SPEC-04 §5). */
export async function receiptDigest(receipt: ConsentReceipt): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(receipt))}`;
}

function uuidV4(): string {
  const c = globalThis.crypto;
  if (c.randomUUID) return c.randomUUID();
  return [crypto.getRandomValues(new Uint32Array(4))]
    .map((u) =>
      Array.from(u)
        .map((n) => n.toString(16))
        .join(""),
    )
    .join("-");
}

/** §3: issue a receipt bound to the CURRENT policy (issue time). */
export async function issueReceipt(
  scope: string[],
  purposes: string[],
): Promise<{ receipt: ConsentReceipt; digest: string }> {
  const receipt: ConsentReceipt = {
    receipt_id: uuidV4(),
    receipt_version: RECEIPT_VERSION,
    policy_version: getShippedPolicyVersion(),
    policy_hash: await currentPolicyHash(),
    granted_at: new Date().toISOString(),
    scope,
    legal_basis: "consent",
    purposes,
    withdrawn_at: null,
  };
  return { receipt, digest: await receiptDigest(receipt) };
}

/**
 * §5/§6: evaluate a stored receipt + digest. Absent/tampered/withdrawn/
 * policy-mismatched ⇒ consent is NOT given (default-deny).
 */
export async function evaluateReceipt(
  stored: { receipt: ConsentReceipt; digest: string } | null | undefined,
): Promise<ReceiptEvaluation> {
  const currentHash = await currentPolicyHash();
  const currentVersion = getShippedPolicyVersion();
  const base: ReceiptEvaluation = {
    status: "absent",
    consentGiven: false,
    currentPolicyHash: currentHash,
    currentPolicyVersion: currentVersion,
  };
  if (
    !stored ||
    typeof stored.receipt !== "object" ||
    stored.receipt === null
  ) {
    return base;
  }
  const receipt = stored.receipt;
  // Digest first — recomputed over the canonical receipt (§5).
  const expected = await receiptDigest(receipt);
  if (stored.digest !== expected) {
    return { ...base, status: "tampered", receipt };
  }
  if (receipt.withdrawn_at !== null) {
    return { ...base, status: "withdrawn", receipt };
  }
  // Policy binding: a receipt from another policy does NOT carry over (§6).
  if (
    receipt.policy_hash !== currentHash ||
    receipt.policy_version !== currentVersion
  ) {
    return { ...base, status: "policy_mismatch", receipt };
  }
  return { ...base, status: "valid", consentGiven: true, receipt };
}

/** §6.3: annotate the withdrawal — the receipt is kept, never re-usable. */
export function annotateWithdrawn(
  receipt: ConsentReceipt,
  at: string,
): ConsentReceipt {
  return { ...receipt, withdrawn_at: at };
}

/**
 * §6.1: the manifest-derived erasure plan for withdrawal — every key with
 * `legal_basis: consent`, partitioned by its `erasure` policy.
 */
export function consentErasurePlan(): {
  erase: string[];
  anonymize: string[];
} {
  const doc = manifestFixture as ManifestDocument;
  const erase: string[] = [];
  const anonymize: string[] = [];
  for (const key of doc.keys) {
    if (key.legal_basis !== "consent") continue;
    if (key.erasure === "retain_anonymized") anonymize.push(key.key);
    else erase.push(key.key);
  }
  return { erase, anonymize };
}

/**
 * §6.5: anonymization for `retain_anonymized` keys — strip the identifying
 * fields from a persisted collection, keeping non-identifying aggregates.
 */
export function anonymizeRecord(record: unknown): unknown {
  if (Array.isArray(record)) return record.map(anonymizeRecord);
  if (record !== null && typeof record === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
      if (PII_FIELD_NAMES.has(k)) continue;
      out[k] = anonymizeRecord(v);
    }
    return out;
  }
  return record;
}

const PII_FIELD_NAMES = new Set([
  "name",
  "customer",
  "customerId",
  "customer_id",
  "customerName",
  "customerSnapshot",
  "email",
  "phone",
  "address",
  "notes",
]);
