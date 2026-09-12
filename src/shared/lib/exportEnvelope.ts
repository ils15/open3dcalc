/**
 * SPEC-03 export envelope v1.1 (D1.1 S5) — producer + consumer.
 *
 * The user export is a single, fully-specified, encrypted envelope:
 * canonical JSON plaintext, SHA-256 digest over the canonical plaintext,
 * PBKDF2-SHA256 with exactly 310,000 iterations, AES-256-GCM (128-bit tag)
 * with the header bound as AAD, and declared limits (50,000 records /
 * 50 MiB). Import validates strictly — unknown fields, unknown versions
 * and parameter drift are rejected (fail-closed); wrong password and
 * tampering are indistinguishable by design (GCM auth).
 *
 * Canonicalization: RFC 8785 (JCS) equivalent — sorted object keys (UTF-16
 * code unit order via `<`), ECMAScript number serialization (JSON.stringify
 * delegates to Number::toString), no whitespace, UTF-8 output (Tested by
 * the vector tests in exportEnvelope.test.ts per SPEC-03 §3).
 *
 * Password handling (§6): the password is received as an argument from the
 * UI prompt, held in memory for the duration of the operation and never
 * written to logs, storage, argv or environment.
 */

import { canonicalJson } from "./crypto/envelope";
import { getShippedPolicyVersion } from "./shippedManifest";
import type { SyncData } from "./dataSync";

export const EXPORT_FORMAT = "open3dcalc-export";
export const EXPORT_VERSION = "1.1";
export const PBKDF2_ITERATIONS = 310_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const KEY_BITS = 256;
export const MAX_RECORDS = 50_000;
export const MAX_BYTES = 52_428_800;

const TOP_LEVEL_FIELDS = [
  "format",
  "version",
  "kdf",
  "cipher",
  "aad",
  "integrity",
  "limits",
  "payload",
] as const;

export type EnvelopeErrorCode =
  | "INVALID_ENVELOPE"
  | "UNSUPPORTED_VERSION"
  | "LIMITS_EXCEEDED"
  | "CORRUPTED"
  | "AUTH_FAILED"
  | "PASSWORD_REQUIRED";

export class EnvelopeError extends Error {
  readonly code: EnvelopeErrorCode;
  constructor(code: EnvelopeErrorCode, message: string) {
    super(message);
    this.name = "EnvelopeError";
    this.code = code;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string, expectedBytes: number): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== expectedBytes * 2) {
    throw new EnvelopeError("INVALID_ENVELOPE", "invalid hex field");
  }
  const out = new Uint8Array(new ArrayBuffer(expectedBytes));
  for (let i = 0; i < expectedBytes; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new EnvelopeError("INVALID_ENVELOPE", "no WebCrypto");
  return c.subtle;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  globalThis.crypto.getRandomValues(out);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await subtle().digest("SHA-256", bytes as BufferSource);
  return toHex(new Uint8Array(digest));
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const base = await subtle().importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * SPEC-01-derived record count: every collection item in the payload
 * counts toward the 50,000-record limit.
 */
export function countRecords(payload: SyncData): number {
  const arrays: unknown[] = [
    payload.history,
    payload.customers,
    payload.quotes,
    payload.filaments,
    payload.products ?? [],
    payload.catalog?.printers,
    payload.catalog?.materials,
    payload.catalog?.marketplaces,
  ];
  return arrays.reduce<number>(
    (total, arr) => total + (Array.isArray(arr) ? arr.length : 0),
    0,
  );
}

function strictFields(
  obj: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const extra = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (extra.length > 0) {
    throw new EnvelopeError(
      "INVALID_ENVELOPE",
      `unknown field(s): ${extra.join(", ")}`,
    );
  }
}

/**
 * Producer: build the v1.1 envelope JSON for a collected payload.
 * Enforces the §7 limits before encrypting anything.
 */
export async function createExportEnvelope(
  payload: SyncData,
  password: string,
): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new EnvelopeError(
      "PASSWORD_REQUIRED",
      "o pacote de exportação é sempre criptografado: informe uma senha",
    );
  }
  const canonicalPlaintext = canonicalJson(payload);
  const plaintextBytes = new TextEncoder().encode(canonicalPlaintext);
  if (plaintextBytes.length > MAX_BYTES) {
    throw new EnvelopeError("LIMITS_EXCEEDED", "payload exceeds 50 MiB");
  }
  if (countRecords(payload) > MAX_RECORDS) {
    throw new EnvelopeError(
      "LIMITS_EXCEEDED",
      "payload exceeds 50,000 records",
    );
  }

  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const aad = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    policy_version: getShippedPolicyVersion(),
  };
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await subtle().encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      additionalData: new TextEncoder().encode(
        canonicalJson(aad),
      ) as BufferSource,
      tagLength: 128,
    },
    key,
    plaintextBytes as BufferSource,
  );

  const envelope = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    kdf: {
      algorithm: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      salt_hex: toHex(salt),
    },
    cipher: { algorithm: "AES-256-GCM", iv_hex: toHex(iv), tag_bits: 128 },
    aad,
    integrity: {
      algorithm: "SHA-256",
      plaintext_digest_hex: await sha256Hex(plaintextBytes),
    },
    limits: { records: MAX_RECORDS, bytes: MAX_BYTES },
    payload: { ciphertext_base64: toBase64(new Uint8Array(ciphertext)) },
  };
  return JSON.stringify(envelope);
}

/**
 * Consumer (SPEC-03 §5): strict header validation → allowlist check →
 * decrypt with AAD binding → digest verification → limits → parse.
 * GCM failures (wrong password or tamper) share one error by design.
 */
export async function readExportEnvelope(
  envelopeJson: string,
  password: string,
): Promise<SyncData> {
  let doc: unknown;
  try {
    doc = JSON.parse(envelopeJson);
  } catch {
    throw new EnvelopeError("INVALID_ENVELOPE", "envelope is not valid JSON");
  }
  if (typeof doc !== "object" || doc === null) {
    throw new EnvelopeError("INVALID_ENVELOPE", "envelope must be an object");
  }
  const env = doc as Record<string, unknown>;
  strictFields(env, TOP_LEVEL_FIELDS);

  if (env.format !== EXPORT_FORMAT) {
    throw new EnvelopeError("INVALID_ENVELOPE", "unknown format");
  }
  if (env.version !== EXPORT_VERSION) {
    // §7 downgrade/unknown-version rejection — no best-effort parsing.
    throw new EnvelopeError(
      "UNSUPPORTED_VERSION",
      `unsupported envelope version: ${String(env.version)}`,
    );
  }

  const kdf = env.kdf as Record<string, unknown> | null;
  const cipher = env.cipher as Record<string, unknown> | null;
  const integrity = env.integrity as Record<string, unknown> | null;
  const aad = env.aad as Record<string, unknown> | null;
  const limits = env.limits as Record<string, unknown> | null;
  const payload = env.payload as Record<string, unknown> | null;
  if (
    typeof kdf !== "object" ||
    kdf === null ||
    typeof cipher !== "object" ||
    cipher === null ||
    typeof integrity !== "object" ||
    integrity === null ||
    typeof aad !== "object" ||
    aad === null ||
    typeof limits !== "object" ||
    limits === null ||
    typeof payload !== "object" ||
    payload === null
  ) {
    throw new EnvelopeError("INVALID_ENVELOPE", "malformed header section");
  }

  strictFields(kdf, ["algorithm", "iterations", "salt_hex"]);
  strictFields(cipher, ["algorithm", "iv_hex", "tag_bits"]);
  strictFields(integrity, ["algorithm", "plaintext_digest_hex"]);
  strictFields(aad, ["format", "version", "policy_version"]);
  strictFields(limits, ["records", "bytes"]);
  strictFields(payload, ["ciphertext_base64"]);

  if (
    kdf.algorithm !== "PBKDF2-SHA256" ||
    kdf.iterations !== PBKDF2_ITERATIONS
  ) {
    throw new EnvelopeError("INVALID_ENVELOPE", "kdf outside the allowlist");
  }
  const salt = fromHex(String(kdf.salt_hex), SALT_BYTES);
  if (cipher.algorithm !== "AES-256-GCM" || cipher.tag_bits !== 128) {
    throw new EnvelopeError("INVALID_ENVELOPE", "cipher outside the allowlist");
  }
  const iv = fromHex(String(cipher.iv_hex), IV_BYTES);
  if (integrity.algorithm !== "SHA-256") {
    throw new EnvelopeError(
      "INVALID_ENVELOPE",
      "integrity outside the allowlist",
    );
  }
  const expectedDigest = String(integrity.plaintext_digest_hex);
  if (aad.format !== EXPORT_FORMAT || aad.version !== EXPORT_VERSION) {
    throw new EnvelopeError(
      "INVALID_ENVELOPE",
      "aad does not match the header",
    );
  }
  if (limits.records !== MAX_RECORDS || limits.bytes !== MAX_BYTES) {
    throw new EnvelopeError("INVALID_ENVELOPE", "limits do not match the spec");
  }
  if (typeof payload.ciphertext_base64 !== "string") {
    throw new EnvelopeError("INVALID_ENVELOPE", "missing ciphertext");
  }

  // §5.4 — GCM auth: wrong password and tamper are indistinguishable.
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  let plaintextBytes: Uint8Array;
  try {
    const decrypted = await subtle().decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: new TextEncoder().encode(
          canonicalJson(aad),
        ) as BufferSource,
        tagLength: 128,
      },
      key,
      fromBase64(payload.ciphertext_base64) as BufferSource,
    );
    plaintextBytes = new Uint8Array(decrypted);
  } catch {
    throw new EnvelopeError(
      "AUTH_FAILED",
      "senha incorreta ou pacote adulterado",
    );
  }

  if (plaintextBytes.length > MAX_BYTES) {
    throw new EnvelopeError("LIMITS_EXCEEDED", "plaintext exceeds 50 MiB");
  }

  // §5.5 — digest over the canonical plaintext.
  const actualDigest = await sha256Hex(plaintextBytes);
  if (actualDigest !== expectedDigest) {
    throw new EnvelopeError("CORRUPTED", "plaintext digest mismatch");
  }

  const plaintext = new TextDecoder().decode(plaintextBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new EnvelopeError("INVALID_ENVELOPE", "plaintext is not valid JSON");
  }

  // §7 limits on the logical payload.
  const recordCount = countRecords(parsed as SyncData);
  if (recordCount > MAX_RECORDS) {
    throw new EnvelopeError(
      "LIMITS_EXCEEDED",
      "payload exceeds 50,000 records",
    );
  }
  return parsed as SyncData;
}
