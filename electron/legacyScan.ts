/**
 * Legacy plaintext scanner (D1.1 S3) — ADR-002 §2.3.
 *
 * The startup scan compares every manifest PII key found on a surface
 * against the manifest's expected encrypted form. This is the SAME scan the
 * SPEC-02 erasure saga reuses as its post-condition, implemented once:
 * pure classification here, surface readers provided by the caller (main
 * process for the storage table; S4 extends it to renderer surfaces).
 *
 * Metadata only: the report carries key NAMES and counts, never values
 * (TEST-MATRIX §3.2).
 */

import { getEntry, isKnownKey } from "../src/shared/lib/dataManifest.js";
import { loadManifestFromDisk } from "./manifestSource.js";

const ENCRYPTED_PREFIX = "enc1:";

export type ScanStatus =
  "encrypted_at_rest" | "legacy_plaintext" | "non_pii_plaintext" | "absent";

export interface ScanEntry {
  /** Storage key NAME (metadata only — never a value). */
  key: string;
  surface: string;
  status: ScanStatus;
}

export interface ScanReport {
  scannedAt: string;
  /** localStorage-surface keys, mirrored on desktop into the storage table. */
  entries: ScanEntry[];
  legacyCount: number;
  encryptedCount: number;
  /** Row counts of the SQLite domain tables (any row there is plaintext today). */
  domainTables: { customers: number; quotes: number; quote_items: number };
  manifestAvailable: boolean;
}

/**
 * Classify one stored value for a key. Pure.
 *  - unknown key ⇒ treated as legacy_plaintext (default-deny reports it);
 *  - non-PII ⇒ non_pii_plaintext (allowed, unaffected by quarantine);
 *  - PII with the encrypted prefix ⇒ encrypted_at_rest;
 *  - PII without it ⇒ legacy_plaintext.
 */
export function classifyStoredValue(
  key: string,
  stored: string | null | undefined,
  manifest: ReturnType<typeof loadManifestFromDisk>,
): ScanStatus {
  if (stored === null || stored === undefined) return "absent";
  if (!isKnownKey(manifest, key)) return "legacy_plaintext";
  const entry = getEntry(manifest, key);
  if (!entry?.pii) return "non_pii_plaintext";
  return stored.startsWith(ENCRYPTED_PREFIX)
    ? "encrypted_at_rest"
    : "legacy_plaintext";
}

/** Classify a full set of storage rows (key/value pairs read by the caller). */
export function scanStorageRows(
  rows: Array<{ key: string; value: string }>,
): ScanEntry[] {
  let manifest: ReturnType<typeof loadManifestFromDisk>;
  try {
    manifest = loadManifestFromDisk();
  } catch {
    // Fail-closed: an unreadable manifest means nothing can be trusted as
    // encrypted — every present row is reported as legacy plaintext.
    return rows.map((r) => ({
      key: r.key,
      surface: "localStorage",
      status: "legacy_plaintext" as ScanStatus,
    }));
  }
  return rows.map((r) => ({
    key: r.key,
    surface: "localStorage",
    status: classifyStoredValue(r.key, r.value, manifest),
  }));
}

/** Build the full report from storage rows + domain-table row counts. */
export function buildScanReport(
  rows: Array<{ key: string; value: string }>,
  domainCounts: { customers: number; quotes: number; quote_items: number },
): ScanReport {
  const entries = scanStorageRows(rows);
  let manifestAvailable = true;
  try {
    loadManifestFromDisk();
  } catch {
    manifestAvailable = false;
  }
  return {
    scannedAt: new Date().toISOString(),
    entries,
    legacyCount: entries.filter((e) => e.status === "legacy_plaintext").length,
    encryptedCount: entries.filter((e) => e.status === "encrypted_at_rest")
      .length,
    domainTables: domainCounts,
    manifestAvailable,
  };
}

/** Startup log summary — metadata only (TEST-MATRIX §3.2: no values). */
export function summarizeReport(report: ScanReport): string {
  const parts = [
    `legacy=${report.legacyCount}`,
    `encrypted=${report.encryptedCount}`,
    `domainTables(customers=${report.domainTables.customers},quotes=${report.domainTables.quotes},quote_items=${report.domainTables.quote_items})`,
  ];
  if (report.legacyCount > 0) {
    const legacyKeys = report.entries
      .filter((e) => e.status === "legacy_plaintext")
      .map((e) => e.key)
      .sort();
    parts.push(`keys=${legacyKeys.join(",")}`);
  }
  return parts.join(" ");
}
