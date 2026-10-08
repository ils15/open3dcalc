/**
 * Structural validation for the persisted consent record (`open3dcalc_consent_v1`).
 *
 * The generic `db:save` IPC used to carry an opaque string into the consent
 * row. The row is the only durable home of the SPEC-04 receipt and the
 * withdrawn-receipt audit trail, so an arbitrary renderer write could replace
 * the receipt — or append a payload the manifest would never classify as
 * `pii:false` — and nothing would notice. The row is still non-PII by
 * contract, and this validator is what keeps it that way at the IPC boundary:
 * it accepts ONLY the shape zustand's `persist` middleware writes for the
 * consent store, and rejects everything else before SQLite is touched.
 *
 * Fail-closed on every uncertainty: unknown keys anywhere, an unexpected value
 * type, an illegal `legal_basis`, or an oversized payload is a DENIAL, not a
 * best-effort coercion.
 */

/** The consent store's persisted version (`version: 1` in consentStore.ts). */
const CONSENT_RECORD_VERSION = 1;

/**
 * Bound the row before JSON.parse. The real record is a few hundred bytes; a
 * megabyte-scale payload is not a consent record and should never be parsed.
 */
const MAX_CONSENT_RECORD_BYTES = 64 * 1024;

/** Top-level keys zustand writes: `{ state, version }` and nothing else. */
const ALLOWED_RECORD_KEYS = new Set(["state", "version"]);

/**
 * The data fields of the consent store's persisted slice, derived from the
 * `ConsentStore` interface. Actions are functions and are dropped by
 * `JSON.stringify`, so only these data fields can appear.
 */
const ALLOWED_STATE_KEYS = new Set([
  "privacyBannerDismissed",
  "consentGiven",
  "consentDate",
  "receipt",
  "receiptDigest",
  "withdrawnReceipts",
  "migrationConsentGiven",
  "migrationConsentDate",
  "migrationReceipt",
  "migrationReceiptDigest",
  "withdrawnMigrationReceipts",
]);

/** The exact field set of a `ConsentReceipt` (consentReceipt.ts). */
const RECEIPT_KEYS = [
  "receipt_id",
  "receipt_version",
  "policy_version",
  "policy_hash",
  "granted_at",
  "scope",
  "legal_basis",
  "purposes",
  "withdrawn_at",
] as const;
const RECEIPT_KEY_SET = new Set<string>(RECEIPT_KEYS);

const BOOLEAN_STATE_KEYS = [
  "privacyBannerDismissed",
  "consentGiven",
  "migrationConsentGiven",
] as const;
const DATE_STATE_KEYS = ["consentDate", "migrationConsentDate"] as const;
const DIGEST_STATE_KEYS = ["receiptDigest", "migrationReceiptDigest"] as const;
const RECEIPT_STATE_KEYS = ["receipt", "migrationReceipt"] as const;
const RECEIPT_ARRAY_STATE_KEYS = [
  "withdrawnReceipts",
  "withdrawnMigrationReceipts",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isReceipt(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== RECEIPT_KEYS.length) return false;
  if (!keys.every((key) => RECEIPT_KEY_SET.has(key))) return false;
  return (
    typeof value.receipt_id === "string" &&
    value.receipt_id.length > 0 &&
    typeof value.receipt_version === "string" &&
    typeof value.policy_version === "string" &&
    typeof value.policy_hash === "string" &&
    typeof value.granted_at === "string" &&
    isStringArray(value.scope) &&
    value.legal_basis === "consent" &&
    isStringArray(value.purposes) &&
    (value.withdrawn_at === null || typeof value.withdrawn_at === "string")
  );
}

function isState(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  // Unknown keys anywhere are a denial: an appended field is the whole attack
  // this validator exists to stop.
  if (!keys.every((key) => ALLOWED_STATE_KEYS.has(key))) return false;

  for (const key of BOOLEAN_STATE_KEYS) {
    if (key in value && typeof value[key] !== "boolean") return false;
  }
  for (const key of DATE_STATE_KEYS) {
    if (key in value && value[key] !== null && !Number.isFinite(value[key])) {
      return false;
    }
  }
  for (const key of DIGEST_STATE_KEYS) {
    if (key in value && value[key] !== null && typeof value[key] !== "string") {
      return false;
    }
  }
  for (const key of RECEIPT_STATE_KEYS) {
    if (key in value && value[key] !== null && !isReceipt(value[key])) {
      return false;
    }
  }
  for (const key of RECEIPT_ARRAY_STATE_KEYS) {
    if (key in value) {
      const entries = value[key];
      if (!Array.isArray(entries) || !entries.every(isReceipt)) return false;
    }
  }
  return true;
}

/**
 * True only when `raw` is exactly the persisted consent-store envelope.
 *
 * `raw` is the string a renderer asked `db:save` to store. Any other string —
 * HTML, a PII blob, a JSON primitive, an object with an extra field, a receipt
 * with an illegal legal_basis — is refused.
 */
export function isValidConsentRecordValue(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length > MAX_CONSENT_RECORD_BYTES) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!isPlainObject(parsed)) return false;
  const keys = Object.keys(parsed);
  if (!keys.every((key) => ALLOWED_RECORD_KEYS.has(key))) return false;
  if (!("state" in parsed) || !("version" in parsed)) return false;
  if (parsed.version !== CONSENT_RECORD_VERSION) return false;
  return isState(parsed.state);
}
