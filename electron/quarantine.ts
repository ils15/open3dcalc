/**
 * Legacy plaintext quarantine (D1.1 S4) — ADR-002 §2.2/§2.3.
 *
 * The quarantine STATE is derived from the ADR-002 §2.3 startup scan — a
 * PII key whose stored value is legacy plaintext is QUARANTINED: readable,
 * excluded from new writes (the persistence gate refuses them), and surfaced
 * in the privacy screen. It never auto-resolves; the only exits are the
 * explicit user actions below:
 *
 *  - MIGRATE: encrypt the plaintext through the ADR-001 capability layer,
 *    replace the row, verify the encrypted copy reads back byte-identical,
 *    and only then is the plaintext copy considered destroyed. Requires a
 *    capability — on deny-path platforms the only exit is elimination.
 *  - ELIMINATE: delete the quarantined rows (per-key; the SPEC-02 saga with
 *    journal/receipts formalizes this in S7).
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
  writeStoredRow,
  type MinimalStorageDb,
} from "./persistGate.js";

const ENCRYPTED_PREFIX = "enc1:";

export type QuarantineStatus =
  "quarantined" | "encrypted" | "absent" | "non_pii" | "unknown_key";

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

export function readStoredRow(
  db: MinimalStorageDb,
  key: string,
): string | null {
  const row = db.prepare("SELECT value FROM storage WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row ? row.value : null;
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
export function buildQuarantineReport(db: MinimalStorageDb): QuarantineReport {
  const rows = db.prepare("SELECT key, value FROM storage").all() as Array<{
    key: string;
    value: string;
  }>;
  let manifest: ReturnType<typeof loadManifestFromDisk>;
  try {
    manifest = loadManifestFromDisk();
  } catch {
    // Fail-closed: unreadable manifest ⇒ nothing can be trusted as encrypted.
    return {
      scannedAt: new Date().toISOString(),
      entries: rows.map((r) => ({
        key: r.key,
        status: "quarantined" as QuarantineStatus,
        recordCount: countRecords(r.value),
      })),
      quarantinedKeys: rows.map((r) => r.key),
    };
  }
  const entries: QuarantineEntry[] = rows.map((r) => {
    if (!isKnownKey(manifest, r.key)) {
      return { key: r.key, status: "unknown_key" };
    }
    const entry = getEntry(manifest, r.key);
    if (!entry?.pii) return { key: r.key, status: "non_pii" };
    if (r.value.startsWith(ENCRYPTED_PREFIX)) {
      return { key: r.key, status: "encrypted" };
    }
    return {
      key: r.key,
      status: "quarantined",
      recordCount: countRecords(r.value),
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
 * back identical BEFORE considering the plaintext destroyed. Atomic per
 * key: on verification failure the plaintext row is restored.
 */
export async function migrateKey(
  db: MinimalStorageDb,
  key: string,
): Promise<MigrateResult> {
  const manifest = loadManifestFromDisk();
  if (!isKnownKey(manifest, key)) {
    throw new CryptoDeniedError("unknown_key");
  }
  const entry = getEntry(manifest, key);
  if (!entry?.pii) throw new CryptoDeniedError("not_pii");

  const stored = readStoredRow(db, key);
  if (stored === null) throw new CryptoDeniedError("nothing_to_migrate");
  if (stored.startsWith(ENCRYPTED_PREFIX)) {
    return { key, migrated: false, verified: true, alreadyEncrypted: true };
  }
  if (getCapability().piiPersistence !== "encrypted_at_rest") {
    // Deny-path platform: migration impossible, elimination is the exit.
    throw new CryptoDeniedError("no_capability");
  }

  const plaintext = stored;
  const blob = await encryptForStorage(key, plaintext);
  writeStoredRow(db, key, blob);

  // Verify the encrypted copy reads back identical before declaring the
  // plaintext destroyed (ADR-002 §2.2.3).
  const loaded = await gateLoad(key, readStoredRow(db, key) ?? "");
  if (loaded.action !== "decrypted" || loaded.value !== plaintext) {
    // Restore the plaintext row — never lose data to a failed migration.
    writeStoredRow(db, key, plaintext);
    throw new CryptoDeniedError("migration_verification_failed");
  }
  // §2.2.3: physically scrub the freed pages so the plaintext copy is
  // destroyed, not just logically replaced. (WAL/SHM handling is finalized
  // by the SPEC-02 saga in S7.)
  db.exec?.("VACUUM");
  return { key, migrated: true, verified: true };
}

export interface EliminateResult {
  key: string;
  eliminated: boolean;
}

/**
 * ADR-002 §2.2.3 ELIMINATE: delete the quarantined rows for a PII key and
 * verify absence. (The SPEC-02 saga with journal, snapshots and receipts
 * formalizes the cross-surface erasure in S7.)
 */
export function eliminateKey(
  db: MinimalStorageDb,
  key: string,
): EliminateResult {
  const manifest = loadManifestFromDisk();
  if (!isKnownKey(manifest, key)) {
    throw new CryptoDeniedError("unknown_key");
  }
  const entry = getEntry(manifest, key);
  if (!entry?.pii) throw new CryptoDeniedError("not_pii");
  db.prepare("DELETE FROM storage WHERE key = ?").run(key);
  const eliminated = readStoredRow(db, key) === null;
  if (!eliminated) throw new CryptoDeniedError("elimination_failed");
  // Physically scrub the freed pages (same rationale as migrateKey).
  db.exec?.("VACUUM");
  return { key, eliminated: true };
}
