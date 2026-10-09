/**
 * T4.6 — value-free post-commit migration drift detection.
 *
 * The retired legacy migration was copy-without-delete: it left the plaintext
 * source in place, so an older client could keep writing to it after the
 * logical commit. It recorded a VALUE-FREE FINGERPRINT (counts only) of the
 * source it committed. The current disclosure compares the source against that
 * historical fingerprint without rendering any record values.
 *
 *  - no fingerprint       → nothing to compare: no drift (`detected: false`)
 *  - source unchanged     → no drift
 *  - source changed       → drift, with the changed KEY NAMES (never values)
 *
 * This module only DETECTS. It never reconciles: re-importing or discarding a
 * post-commit write automatically is exactly the silent action the privacy
 * policy forbids, so the disclosure surfaces the fact and stops there.
 *
 * The fingerprint is declared in SPEC-01 as a non-PII `onboarding_flag`
 * (`open3dcalc_migration_fingerprint_v1`): plaintext allowed, never synced,
 * never exported, erased on delete-all.
 */

import { guardedStorage } from "@/shared/lib/manifestStorage";

/** The SPEC-01 key holding the value-free migration fingerprint. */
export const MIGRATION_FINGERPRINT_KEY = "open3dcalc_migration_fingerprint_v1";

/** The legacy history source the migration reads (copy-without-delete). */
export const LEGACY_HISTORY_SOURCE_KEY = "open3dcalc_history_v2";
/** The legacy product source the migration may convert and drop. */
export const LEGACY_PRODUCTS_SOURCE_KEY = "open3dcalc_products";

const FINGERPRINT_TYPE = "open3dcalc-migration-fingerprint";
const FINGERPRINT_VERSION = 1;

/** The value-free facts a later scan compares against. Counts only. */
export interface MigrationFingerprint {
  /** Length of the legacy history array at migration time. */
  history: number;
  /**
   * Legacy product count, or `null` when the product source was absent or was
   * dropped because it converted completely.
   */
  products: number | null;
}

/** The drift verdict shown to the user. Key names only — never values. */
export interface MigrationDrift {
  detected: boolean;
  /** The KEY NAMES of the sources that changed. Never a record. */
  sources: string[];
}

/** The exact value-free payload format used by the retired migration. */
export function migrationFingerprintValue(
  history: number,
  products: number | null,
): string {
  return JSON.stringify({
    type: FINGERPRINT_TYPE,
    v: FINGERPRINT_VERSION,
    history,
    products,
  });
}

type Read = (key: string) => string | null;

/**
 * Parse the stored fingerprint, or `null` when absent/unreadable. Pure and
 * read-only; a malformed value reads as "no fingerprint" rather than throwing.
 */
export function readMigrationFingerprint(
  read: Read = (key) => guardedStorage.getItem(key),
): MigrationFingerprint | null {
  const raw = read(MIGRATION_FINGERPRINT_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MigrationFingerprint> & {
      type?: unknown;
      v?: unknown;
    };
    if (parsed.type !== FINGERPRINT_TYPE || parsed.v !== FINGERPRINT_VERSION) {
      return null;
    }
    if (
      typeof parsed.history !== "number" ||
      !Number.isFinite(parsed.history)
    ) {
      return null;
    }
    if (
      parsed.products !== null &&
      (typeof parsed.products !== "number" || !Number.isFinite(parsed.products))
    ) {
      return null;
    }
    return { history: parsed.history, products: parsed.products ?? null };
  } catch {
    return null;
  }
}

/**
 * The length of a RAW legacy array under `key`, or `null` when the key is
 * absent or does not hold the pre-zustand array shape. A zustand persist
 * wrapper is the CURRENT store, not legacy residue, so it reads as `null`
 * (matching a fingerprint recorded for an absent/removed source).
 */
function rawArrayLength(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

/**
 * Detect whether the legacy source changed after the migration committed.
 *
 * Pure and read-only. Compares a VALUE-FREE count of the current source against
 * the recorded fingerprint and reports the changed key NAMES. Never contains a
 * record value.
 */
export function detectMigrationDrift(
  read: Read = (key) => guardedStorage.getItem(key),
): MigrationDrift {
  const recorded = readMigrationFingerprint(read);
  if (recorded === null) return { detected: false, sources: [] };

  const sources: string[] = [];
  // An ABSENT source and a source present-but-EMPTY are the same value-free
  // fact: zero records. The migration records a COUNT, and a missing key
  // contributes nothing, so both sides are read as `0`. That is what lets a
  // never-written (or emptied) history source match a recorded `0`, and an
  // absent product source match a recorded `null` (absent or fully converted).
  const historyNow = rawArrayLength(read(LEGACY_HISTORY_SOURCE_KEY)) ?? 0;
  if (historyNow !== recorded.history) sources.push(LEGACY_HISTORY_SOURCE_KEY);
  const productsNow = rawArrayLength(read(LEGACY_PRODUCTS_SOURCE_KEY)) ?? 0;
  if (productsNow !== (recorded.products ?? 0)) {
    sources.push(LEGACY_PRODUCTS_SOURCE_KEY);
  }

  return { detected: sources.length > 0, sources };
}
