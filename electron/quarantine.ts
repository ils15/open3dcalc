/**
 * Legacy plaintext quarantine (D1.1 S4) — ADR-002 §2.2/§2.3.
 *
 * The quarantine STATE is derived from the ADR-002 §2.3 startup scan — a
 * PII key whose stored value is legacy plaintext is QUARANTINED: readable,
 * excluded from new writes (the persistence gate refuses them), and surfaced
 * in the privacy screen. It never auto-resolves; the only exits are the
 * explicit user actions below:
 *
 * - MIGRATE: encrypt the plaintext through the ADR-001 capability layer,
 *   replace the row, verify the encrypted copy reads back byte-identical,
 *   and only then is the plaintext copy considered destroyed. Requires a
 *   capability — on deny-path platforms the only exit is elimination.
 * - ELIMINATE: delete the quarantined rows (per-key; the SPEC-02 saga with
 *   journal/receipts formalizes this in S7).
 *
 * All operations are metadata-only in logs (key NAMES, never values).
 */

import { loadManifestFromDisk } from "./manifestSource.js";
import { isKnownKey, getEntry } from "../src/shared/lib/dataManifest.js";
import {
  CryptoDeniedError,
  encryptForStorage,
  getCapability,
} from "./cryptoCapability.js";
import {
  gateLoad,
  readStoredRow,
  writeStoredRow,
  type PgSql,
} from "./persistGate.js";

const ENCRYPTED_PREFIX = "enc1:";

export type QuarantineStatus =
  | "quarantined"
  | "encrypted"
  | "absent"
  | "non_pii"
  | "unknown_key";

export interface QuarantineEntry {
  key: string;
  status: QuarantineStatus;
  /** Record count when the stored value is a JSON array (display only). */
  recordCount?: number;
}

export interface QuarantineReport {
  scannedAt: string;
  entries: QuarantineEntry[];
  quarantinedKeys: string[];
}

function countRecords(value: string): number | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.length;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Derive the quarantine report from the live storage table. */
export async function buildQuarantineReport(
  sql: PgSql,
): Promise<QuarantineReport> {
  const rows = await sql`SELECT key, value FROM storage`;
  let manifest: ReturnType<typeof loadManifestFromDisk>;
  try {
    manifest = loadManifestFromDisk();
  } catch {
    return {
      scannedAt: new Date().toISOString(),
      entries: rows.map((r) => ({
        key: r.key as string,
        status: "quarantined" as QuarantineStatus,
        recordCount: countRecords(r.value as string),
      })),
      quarantinedKeys: rows.map((r) => r.key as string),
    };
  }
  const entries: QuarantineEntry[] = rows.map((r) => {
    const key = r.key as string;
    const value = r.value as string;
    if (!isKnownKey(manifest, key)) {
      return { key, status: "unknown_key" };
    }
    const entry = getEntry(manifest, key);
    if (!entry?.pii) return { key, status: "non_pii" };
    if (value.startsWith(ENCRYPTED_PREFIX)) {
      return { key, status: "encrypted" };
    }
    return {
      key,
      status: "quarantined",
      recordCount: countRecords(value),
    };
  });
  return {
    scannedAt: new Date().toISOString(),
    entries,
    quarantinedKeys: entries
      .filter((e) => e.status === "quarantined")
      .map((e) => e.key)
      .sort(),
  };
}

export interface MigrateResult {
  key: string;
  migrated: boolean;
  verified: boolean;
  alreadyEncrypted?: boolean;
}

/**
 * ADR-002 §2.2.3 MIGRATE: encrypt the quarantined plaintext with the
 * ADR-001 capability, replace the row, and verify the encrypted copy reads
 * back identical BEFORE considering the plaintext destroyed.
 */
export async function migrateKey(
  sql: PgSql,
  key: string,
): Promise<MigrateResult> {
  const manifest = loadManifestFromDisk();
  if (!isKnownKey(manifest, key)) {
    throw new CryptoDeniedError("unknown_key");
  }
  const entry = getEntry(manifest, key);
  if (!entry?.pii) throw new CryptoDeniedError("not_pii");

  const stored = await readStoredRow(sql, key);
  if (stored === null) throw new CryptoDeniedError("nothing_to_migrate");
  if (stored.startsWith(ENCRYPTED_PREFIX)) {
    return { key, migrated: false, verified: true, alreadyEncrypted: true };
  }
  if (getCapability().piiPersistence !== "encrypted_at_rest") {
    throw new CryptoDeniedError("no_capability");
  }

  const plaintext = stored;
  const blob = await encryptForStorage(key, plaintext);
  await writeStoredRow(sql, key, blob);

  const loaded = await gateLoad(key, (await readStoredRow(sql, key)) ?? "");
  if (loaded.action !== "decrypted" || loaded.value !== plaintext) {
    await writeStoredRow(sql, key, plaintext);
    throw new CryptoDeniedError("migration_verification_failed");
  }
  return { key, migrated: true, verified: true };
}

export interface EliminateResult {
  key: string;
  eliminated: boolean;
}

/**
 * ADR-002 §2.2.3 ELIMINATE: delete the quarantined rows for a PII key and
 * verify absence.
 */
export async function eliminateKey(
  sql: PgSql,
  key: string,
): Promise<EliminateResult> {
  const manifest = loadManifestFromDisk();
  if (!isKnownKey(manifest, key)) {
    throw new CryptoDeniedError("unknown_key");
  }
  const entry = getEntry(manifest, key);
  if (!entry?.pii) throw new CryptoDeniedError("not_pii");

  await sql`DELETE FROM storage WHERE key = ${key}`;
  const eliminated = (await readStoredRow(sql, key)) === null;
  if (!eliminated) throw new CryptoDeniedError("elimination_failed");
  return { key, eliminated: true };
}