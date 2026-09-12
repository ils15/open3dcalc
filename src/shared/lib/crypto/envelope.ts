/**
 * At-rest passphrase envelope (D1.1 S2) — ADR-001 §2.1/§2.2.
 *
 * AES-256-GCM with a key derived from a user passphrase, using the normative
 * SPEC-03 envelope parameters: PBKDF2-SHA256 with exactly 310,000 iterations
 * (OWASP 2023), 128-bit random salt, 96-bit random IV, 128-bit tag, and an
 * AAD binding that authenticates the envelope header.
 *
 * The passphrase is held in memory only for the session (ADR-001 §2.1); this
 * module never persists it, never derives to a stored key, and never logs
 * plaintext or key material. Relies only on the Web Crypto API
 * (globalThis.crypto.subtle), so the same module runs in the Electron main
 * process, the web renderer, and tests.
 */

export const ENVELOPE_VERSION = "1.1" as const;
/** SPEC-03: iterations are exactly 310,000 for the 1.1 envelope. */
export const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16; // 128-bit
const IV_BYTES = 12; // 96-bit
const KEY_BITS = 256;

export interface EnvelopeAad {
  /** Why this envelope exists (binds the ciphertext to its purpose). */
  purpose: string;
  /** Storage key NAME the payload belongs to (names are metadata, not PII). */
  key: string;
}

export interface AtRestEnvelope {
  v: typeof ENVELOPE_VERSION;
  kdf: { alg: "PBKDF2-SHA256"; it: number; salt: string };
  cipher: { alg: "AES-256-GCM"; iv: string };
  aad: EnvelopeAad;
  ct: string;
}

/** Single rejection error: tamper, wrong passphrase, and drift are all "rejected" —
 * callers must not be able to distinguish them (SPEC-03 §7.3 principle). */
export class EnvelopeRejectedError extends Error {
  constructor() {
    super("envelope rejected");
    this.name = "EnvelopeRejectedError";
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(
  hex: string,
  expectedBytes: number,
): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== expectedBytes * 2) {
    throw new EnvelopeRejectedError();
  }
  const out = new Uint8Array(new ArrayBuffer(expectedBytes));
  for (let i = 0; i < expectedBytes; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Canonical JSON (sorted keys, no whitespace) — used for the AAD binding. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new EnvelopeRejectedError();
  return c.subtle;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n));
  globalThis.crypto.getRandomValues(out);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(passphrase);
  const base = await subtle().importKey("raw", enc, "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt `plaintext` into an at-rest envelope JSON string.
 * The AAD (purpose + key name) is bound into the GCM authentication so any
 * header drift breaks decryption.
 */
export async function encryptWithPassphrase(
  plaintext: string,
  passphrase: string,
  aad: EnvelopeAad,
): Promise<string> {
  if (passphrase.length === 0) throw new EnvelopeRejectedError();
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  const aadBytes = new TextEncoder().encode(canonicalJson(aad));
  const ct = await subtle().encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      additionalData: aadBytes,
      tagLength: 128,
    },
    key,
    new TextEncoder().encode(plaintext),
  );
  const envelope: AtRestEnvelope = {
    v: ENVELOPE_VERSION,
    kdf: { alg: "PBKDF2-SHA256", it: PBKDF2_ITERATIONS, salt: toHex(salt) },
    cipher: { alg: "AES-256-GCM", iv: toHex(iv) },
    aad,
    ct: toBase64(new Uint8Array(ct)),
  };
  return JSON.stringify(envelope);
}

/** Decrypt an at-rest envelope. Throws EnvelopeRejectedError on any drift. */
export async function decryptWithPassphrase(
  envelopeJson: string,
  passphrase: string,
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelopeJson);
  } catch {
    throw new EnvelopeRejectedError();
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new EnvelopeRejectedError();
  }
  const env = parsed as Record<string, unknown>;
  if (env.v !== ENVELOPE_VERSION) throw new EnvelopeRejectedError();
  const kdf = env.kdf as Record<string, unknown> | undefined;
  const cipher = env.cipher as Record<string, unknown> | undefined;
  if (
    !kdf ||
    !cipher ||
    kdf.alg !== "PBKDF2-SHA256" ||
    kdf.it !== PBKDF2_ITERATIONS
  ) {
    throw new EnvelopeRejectedError();
  }
  const salt = fromHex(String(kdf.salt), SALT_BYTES);
  const iv = fromHex(String(cipher.iv), IV_BYTES);
  const aad = env.aad as EnvelopeAad | undefined;
  if (
    !aad ||
    typeof aad.purpose !== "string" ||
    typeof aad.key !== "string" ||
    Object.keys(aad).length !== 2
  ) {
    throw new EnvelopeRejectedError();
  }
  const key = await deriveKey(passphrase, salt);
  const aadBytes = new TextEncoder().encode(canonicalJson(aad));
  try {
    const pt = await subtle().decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        additionalData: aadBytes,
        tagLength: 128,
      },
      key,
      fromBase64(String(env.ct)),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new EnvelopeRejectedError();
  }
}
