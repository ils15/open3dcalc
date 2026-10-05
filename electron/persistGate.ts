/**
 * Persistence gate (D1.1 S3) — ADR-002 §2.1 default-deny at the write path.
 *
 * Every `db:save`/`db:load` of a manifest-known key is classified before it
 * touches the storage table:
 *
 * - unknown key ⇒ DENIED (SPEC-01 default-deny);
 * - `pii: false` ⇒ passthrough (manifest enforces plaintext_allowed only
 *   for non-PII keys);
 * - `pii: true` ⇒ the value MUST go through the ADR-001 capability layer
 *   (`encryptForStorage`); when no capability exists the write is REFUSED
 *   (fail-closed), never downgraded to plaintext.
 *
 * Legacy plaintext PII (written before D1.1) stays READABLE on load
 * (ADR-002 §2.2.1 — the user must be able to see what exists and choose);
 * the startup scanner (`legacyScan.ts`) is what flags it for the S4
 * quarantine regime. Logs carry key NAMES only, never values (§3.2).
 */

import type postgres from "postgres";
import {
  type ManifestEntry,
  type ManifestIndex,
  isKnownKey,
  getEntry,
} from "../src/shared/lib/dataManifest.js";
import { loadManifestFromDisk } from "./manifestSource.js";
import {
  CryptoDeniedError,
  encryptForStorage,
  decryptFromStorage,
  LegacyUnboundBlobError,
  UnknownBlobError,
} from "./cryptoCapability.js";

export type PolicyRefusalReason = "unknown_key" | "manifest_unavailable";

export type KeyPolicy =
  | { allowed: true; entry: ManifestEntry }
  | { allowed: false; reason: PolicyRefusalReason };

export function resolveKeyPolicy(key: string): KeyPolicy {
  let manifest: ManifestIndex;
  try {
    manifest = loadManifestFromDisk();
  } catch {
    return { allowed: false, reason: "manifest_unavailable" };
  }
  if (!isKnownKey(manifest, key)) {
    return { allowed: false, reason: "unknown_key" };
  }
  return { allowed: true, entry: getEntry(manifest, key)! };
}

export type PersistOutcome =
  | { action: "passthrough"; value: string }
  | { action: "encrypted"; value: string }
  | {
      action: "denied";
      reason: "unknown_key" | "no_capability" | "manifest_unavailable";
    };

export async function gatePersist(
  key: string,
  value: string,
): Promise<PersistOutcome> {
  const policy = resolveKeyPolicy(key);
  if (!policy.allowed) return { action: "denied", reason: policy.reason };
  const entry = policy.entry;
  if (!entry.pii) return { action: "passthrough", value };
  try {
    const blob = await encryptForStorage(key, value);
    return { action: "encrypted", value: blob };
  } catch (error) {
    if (error instanceof CryptoDeniedError) {
      return { action: "denied", reason: "no_capability" };
    }
    throw error;
  }
}

export type LoadOutcome =
  | { action: "passthrough"; value: string }
  | { action: "decrypted"; value: string }
  | { action: "legacy_plaintext"; value: string }
  | {
      action: "unreadable";
      reason:
        | "legacy_unbound_encryption"
        | "legacy_envelope_v1_1"
        | "authentication_failed"
        | "locked"
        | "no_capability";
    }
  | {
      action: "denied";
      reason: "unknown_key" | "locked" | "manifest_unavailable";
    };

export async function gateLoad(
  key: string,
  stored: string,
): Promise<LoadOutcome> {
  const policy = resolveKeyPolicy(key);
  if (!policy.allowed) return { action: "denied", reason: policy.reason };
  const entry = policy.entry;
  if (!entry.pii) return { action: "passthrough", value: stored };
  try {
    const plaintext = await decryptFromStorage(key, stored);
    return { action: "decrypted", value: plaintext };
  } catch (error) {
    if (error instanceof UnknownBlobError) {
      return { action: "legacy_plaintext", value: stored };
    }
    if (error instanceof LegacyUnboundBlobError) {
      return {
        action: "unreadable",
        reason: "legacy_unbound_encryption",
      };
    }
    if (error instanceof CryptoDeniedError) {
      return error.reason === "locked"
        ? { action: "unreadable", reason: "locked" }
        : { action: "unreadable", reason: "no_capability" };
    }
    if (isEnvelopeRejection(error)) {
      return { action: "unreadable", reason: envelopeReasonFor(error) };
    }
    throw error;
  }
}

function isEnvelopeRejection(error: unknown): boolean {
  const reason = (error as { reason?: unknown } | null)?.reason;
  return (
    reason === "legacy_self_asserted_aad" ||
    reason === "metadata_mismatch" ||
    reason === "authentication_failed" ||
    reason === "parameter_drift" ||
    reason === "malformed_envelope" ||
    reason === "unknown_envelope_version"
  );
}

function envelopeReasonFor(
  error: unknown,
): "legacy_envelope_v1_1" | "authentication_failed" {
  const reason = (error as { reason?: string } | null)?.reason;
  return reason === "legacy_self_asserted_aad"
    ? "legacy_envelope_v1_1"
    : "authentication_failed";
}

export async function loadRowForHydration(
  key: string,
  stored: string,
): Promise<LoadOutcome> {
  return gateLoad(key, stored);
}

/* ------------------------------------------------------------------ */
/* Storage-table operations (async PG)                                */
/* ------------------------------------------------------------------ */

export type PgSql = postgres.Sql;

export async function writeStoredRow(
  sql: PgSql,
  key: string,
  value: string,
): Promise<void> {
  await sql`
    INSERT INTO storage (key, value, updated_at)
    VALUES (${key}, ${value}, ${Date.now()})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `;
}

export async function readStoredRow(
  sql: PgSql,
  key: string,
): Promise<string | null> {
  const rows = await sql`SELECT value FROM storage WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as string) : null;
}

export async function saveGated(
  sql: PgSql,
  key: string,
  value: string,
): Promise<void> {
  const outcome = await gatePersist(key, value);
  if (outcome.action === "denied") {
    throw new CryptoDeniedError(outcome.reason);
  }
  if (outcome.action === "encrypted") {
    const current = await readStoredRow(sql, key);
    if (current !== null && !current.startsWith("enc1:")) {
      throw new CryptoDeniedError("quarantined_read_only");
    }
  }
  await writeStoredRow(sql, key, outcome.value);
}

export async function deleteGated(sql: PgSql, key: string): Promise<void> {
  const policy = resolveKeyPolicy(key);
  if (!policy.allowed && policy.reason === "manifest_unavailable") {
    throw new CryptoDeniedError("manifest_unavailable");
  }
  await sql`DELETE FROM storage WHERE key = ${key}`;
}

export async function loadGated(
  sql: PgSql,
  key: string,
): Promise<string | null> {
  const stored = await readStoredRow(sql, key);
  if (stored === null) return null;
  const outcome = await gateLoad(key, stored);
  if (outcome.action === "denied" || outcome.action === "unreadable") {
    return null;
  }
  return outcome.value;
}