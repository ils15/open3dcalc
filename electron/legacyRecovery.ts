/**
 * ADR-001 §3.6 recovery, and per-key hydration isolation.
 *
 * Adapted for PostgreSQL: uses async postgres.Sql instead of sync MinimalStorageDb.
 * All db.prepare().get/all/run calls replaced with tagged template queries.
 */
import { safeStorage } from "electron";
import {
  CryptoDeniedError,
  LegacyUnboundBlobError,
  encryptForStorage,
  decryptFromStorage,
} from "./cryptoCapability.js";
import { getSessionPassphrase } from "../src/shared/lib/crypto/passphraseSession.js";
import {
  canonicalJson,
  PBKDF2_ITERATIONS,
} from "../src/shared/lib/crypto/envelope.js";
import { LEGACY_RESIDUE_TABLE } from "./piiDomainTables.js";
import {
  resolveKeyPolicy,
  loadRowForHydration,
  type PgSql,
} from "./persistGate.js";

const LEGACY_SAFE_STORAGE_PREFIX = "enc1:safeStorage:";
const LEGACY_ENVELOPE_PREFIX = "enc1:envelope:";
const LEGACY_ENVELOPE_VERSION = "1.1";

export type UnreadableReason =
  | "legacy_unbound_encryption"
  | "legacy_envelope_v1_1"
  | "legacy_undecryptable"
  | "legacy_key_mismatch"
  | "authentication_failed"
  | "no_capability"
  | "locked"
  | "unknown_key"
  | "manifest_unavailable";

export interface UnavailableKey {
  key: string;
  reason: UnreadableReason;
  recoverable: boolean;
}

export interface HydrationReport {
  values: Map<string, string>;
  unavailable: UnavailableKey[];
}

type LegacyShape = "enc1:safeStorage" | "enc1:envelope-v1.1";

export class LegacyUnreadableError extends Error {
  readonly reason: UnreadableReason;
  constructor(reason: UnreadableReason, message: string) {
    super(message);
    this.name = "LegacyUnreadableError";
    this.reason = reason;
  }
}

export class UnreadablePiiValueError extends Error {
  readonly code = "unreadable_pii_value";
  readonly reason: string;
  readonly key: string;
  constructor(key: string, reason: string) {
    super(
      `[cryptoCapability] ${key} is stored but unreadable (${reason}) — the value is NOT hydrated and NOT deleted`,
    );
    this.name = "UnreadablePiiValueError";
    this.reason = reason;
    this.key = key;
  }
}

function classifyLegacy(blob: string): LegacyShape | null {
  if (blob.startsWith(LEGACY_SAFE_STORAGE_PREFIX)) return "enc1:safeStorage";
  if (!blob.startsWith(LEGACY_ENVELOPE_PREFIX)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob.slice(LEGACY_ENVELOPE_PREFIX.length));
  } catch {
    return null;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as Record<string, unknown>).v === LEGACY_ENVELOPE_VERSION
  ) {
    return "enc1:envelope-v1.1";
  }
  return null;
}

const toHex = (b: Uint8Array): string =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string, bytes: number): Uint8Array<ArrayBuffer> => {
  if (hex.length !== bytes * 2 || /[^0-9a-f]/.test(hex)) {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] malformed legacy field",
    );
  }
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

async function readLegacyV11(
  env: Record<string, unknown>,
  passphrase: string,
  requestedKey: string,
): Promise<string> {
  const meta = env.meta as Record<string, unknown> | undefined;
  if (typeof meta !== "object" || meta === null) {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope has no meta",
    );
  }
  if (typeof meta.key !== "string" || typeof meta.purpose !== "string") {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope meta is malformed",
    );
  }
  if (meta.key !== requestedKey) {
    throw new LegacyUnreadableError(
      "legacy_key_mismatch",
      "[legacyRecovery] legacy envelope was found under a different storage key",
    );
  }
  const kdf = env.kdf as Record<string, unknown> | undefined;
  const cipher = env.cipher as Record<string, unknown> | undefined;
  if (
    typeof kdf !== "object" ||
    kdf === null ||
    typeof cipher !== "object" ||
    cipher === null ||
    typeof env.ct !== "string"
  ) {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope is malformed",
    );
  }
  if (kdf.alg !== "PBKDF2-SHA256" || cipher.alg !== "AES-256-GCM") {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope names an unknown algorithm",
    );
  }
  const iterations = kdf.it;
  if (iterations !== PBKDF2_ITERATIONS && iterations !== 100_000) {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope declares an unknown work factor",
    );
  }
  const salt = fromHex(String(kdf.salt), 16);
  const iv = fromHex(String(cipher.iv), 12);
  const enc = new TextEncoder();
  const base = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const derived = await globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  try {
    const pt = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: enc.encode(
          canonicalJson({ key: meta.key, purpose: meta.purpose }),
        ),
        tagLength: 128,
      },
      derived,
      Buffer.from(env.ct, "base64"),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope failed authentication",
    );
  }
}

export async function readLegacyValue(
  key: string,
  blob: string,
): Promise<string> {
  const shape = classifyLegacy(blob);
  if (shape === null) {
    throw new LegacyUnboundBlobError();
  }
  if (shape === "enc1:safeStorage") {
    let opened: string;
    try {
      opened = safeStorage.decryptString(
        Buffer.from(blob.slice(LEGACY_SAFE_STORAGE_PREFIX.length), "base64"),
      );
    } catch {
      throw new LegacyUnreadableError(
        "legacy_undecryptable",
        "[legacyRecovery] the OS keyring will not open this legacy blob",
      );
    }
    if (typeof opened !== "string" || opened.length === 0) {
      throw new LegacyUnreadableError(
        "legacy_undecryptable",
        "[legacyRecovery] the OS keyring returned nothing usable",
      );
    }
    return opened;
  }
  const passphrase = getSessionPassphrase();
  if (passphrase === null) {
    throw new CryptoDeniedError("locked");
  }
  let env: Record<string, unknown>;
  try {
    env = JSON.parse(blob.slice(LEGACY_ENVELOPE_PREFIX.length)) as Record<
      string,
      unknown
    >;
  } catch {
    throw new LegacyUnreadableError(
      "legacy_undecryptable",
      "[legacyRecovery] legacy envelope is not valid JSON",
    );
  }
  return readLegacyV11(env, passphrase, key);
}

function reasonForReadFailure(error: unknown): UnreadableReason {
  if (error instanceof LegacyUnboundBlobError)
    return "legacy_unbound_encryption";
  if (error instanceof CryptoDeniedError) {
    if (error.reason === "locked") return "locked";
    return "no_capability";
  }
  const reason = (error as { reason?: string } | null)?.reason ?? "";
  if (reason === "legacy_self_asserted_aad") return "legacy_envelope_v1_1";
  return "authentication_failed";
}

const RECOVERABLE_REASONS = new Set<UnreadableReason>([
  "legacy_unbound_encryption",
  "legacy_envelope_v1_1",
]);

export async function hydrateAll(
  sql: PgSql,
): Promise<HydrationReport> {
  const rows = await sql`SELECT key, value FROM storage`;
  const values = new Map<string, string>();
  const unavailable: UnavailableKey[] = [];

  for (const row of rows) {
    const key = row.key as string;
    const value = row.value as string;
    const policy = resolveKeyPolicy(key);
    if (!policy.allowed) {
      unavailable.push({
        key,
        reason: policy.reason,
        recoverable: false,
      });
      continue;
    }
    if (!policy.entry.pii) {
      values.set(key, value);
      continue;
    }
    try {
      const outcome = await loadRowForHydration(key, value);
      if (outcome.action === "unreadable") {
        unavailable.push({
          key,
          reason: outcome.reason,
          recoverable: RECOVERABLE_REASONS.has(outcome.reason),
        });
        continue;
      }
      if (outcome.action === "denied") {
        unavailable.push({
          key,
          reason: "no_capability",
          recoverable: false,
        });
        continue;
      }
      values.set(key, outcome.value);
    } catch (error) {
      unavailable.push({
        key,
        reason: reasonForReadFailure(error),
        recoverable: false,
      });
    }
  }
  return { values, unavailable };
}

export type RecoveryFailure =
  | "legacy_undecryptable"
  | "legacy_key_mismatch"
  | "no_capability"
  | "recovery_write_failed"
  | "recovery_residue_failed"
  | "recovery_verification_failed"
  | "not_legacy"
  | "unknown_key"
  | "not_pii"
  | "nothing_to_recover";

export interface RecoveryResult {
  key: string;
  recovered: boolean;
  verified: boolean;
  shape?: LegacyShape;
  reason?: RecoveryFailure | UnreadableReason;
  residueRetained?: boolean;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return toHex(new Uint8Array(digest));
}

export async function recoverLegacyKey(
  sql: PgSql,
  key: string,
): Promise<RecoveryResult> {
  const policy = resolveKeyPolicy(key);
  if (!policy.allowed)
    return { key, recovered: false, verified: false, reason: policy.reason };
  if (!policy.entry?.pii)
    return { key, recovered: false, verified: false, reason: "not_pii" };

  const rows = await sql`SELECT value FROM storage WHERE key = ${key}`;
  const stored = rows.length > 0 ? (rows[0].value as string) : undefined;
  if (stored === undefined) {
    return {
      key,
      recovered: false,
      verified: false,
      reason: "nothing_to_recover",
    };
  }

  const shape = classifyLegacy(stored);
  if (shape === null) {
    return { key, recovered: false, verified: false, reason: "not_legacy" };
  }

  let plaintext: string;
  try {
    plaintext = await readLegacyValue(key, stored);
  } catch (error) {
    const reason =
      error instanceof LegacyUnreadableError
        ? error.reason
        : error instanceof CryptoDeniedError && error.reason === "locked"
          ? "no_capability"
          : "legacy_undecryptable";
    return { key, recovered: false, verified: false, shape, reason };
  }

  const digest = await sha256Hex(plaintext);
  try {
    await sql`
      INSERT INTO ${sql(LEGACY_RESIDUE_TABLE)} (key, shape, blob, recovered_value_sha, recovered_at)
      VALUES (${key}, ${shape}, ${stored}, ${digest}, ${Date.now()})
      ON CONFLICT (key) DO NOTHING
    `;
  } catch {
    return {
      key,
      recovered: false,
      verified: false,
      shape,
      reason: "recovery_residue_failed",
    };
  }

  let sealed: string;
  try {
    sealed = await encryptForStorage(key, plaintext);
  } catch (error) {
    const reason =
      error instanceof CryptoDeniedError
        ? "no_capability"
        : "recovery_write_failed";
    return { key, recovered: false, verified: false, shape, reason };
  }

  let written: string | null;
  try {
    await sql`
      INSERT INTO storage (key, value, updated_at)
      VALUES (${key}, ${sealed}, ${Date.now()})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `;
    const readBackRows = await sql`SELECT value FROM storage WHERE key = ${key}`;
    written = readBackRows.length > 0 ? (readBackRows[0].value as string) : null;
  } catch {
    return {
      key,
      recovered: false,
      verified: false,
      shape,
      reason: "recovery_write_failed",
    };
  }

  let readBack: string;
  try {
    readBack = await decryptFromStorage(key, written ?? "");
  } catch {
    return {
      key,
      recovered: false,
      verified: false,
      shape,
      reason: "recovery_verification_failed",
      residueRetained: true,
    };
  }
  if (readBack !== plaintext) {
    return {
      key,
      recovered: false,
      verified: false,
      shape,
      reason: "recovery_verification_failed",
      residueRetained: true,
    };
  }

  return {
    key,
    recovered: true,
    verified: true,
    shape,
    residueRetained: true,
  };
}

export async function buildRecoveryReport(
  sql: PgSql,
): Promise<{ scannedAt: string; unavailable: UnavailableKey[] }> {
  const report = await hydrateAll(sql);
  return {
    scannedAt: new Date().toISOString(),
    unavailable: report.unavailable,
  };
}