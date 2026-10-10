/**
 * Legacy plaintext PII detection (ADR-002 §2.2 quarantine).
 *
 * Read-only detection of customer, quote, and history data left under legacy
 * browser storage keys. The current stores use readable local persistence; this
 * helper remains only for the privacy disclosure and does not migrate or delete.
 *
 * This module is ONLY the detection half. It answers "is there legacy plaintext
 * PII, and how much?", so the migration/keep-read-only/export/delete choice can
 * render without doing any discovery of its own. It deliberately does not
 * implement a migration state machine or mutate any stored content.
 *
 * ## Why reading plaintext is allowed here
 *
 * The disclosure reads counts only — never record contents — and returns
 * nothing that can be rendered as PII.
 */

import { guardedStorage } from "./manifestStorage.js";

/** The three localStorage keys covered by this historical disclosure. */
export const LEGACY_PII_PLAINTEXT_KEYS = [
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
] as const;

export type LegacyPiiPlaintextKey = (typeof LEGACY_PII_PLAINTEXT_KEYS)[number];

export interface LegacyPiiPlaintextKeyReport {
  key: LegacyPiiPlaintextKey;
  /** True when the key holds anything at all. */
  present: boolean;
  /** Number of records found, or 0 when present but unrecognizable. */
  count: number;
}

export interface LegacyPiiPlaintextReport {
  /** True when at least one of the three keys holds data. */
  present: boolean;
  /** Sum of the per-key counts. */
  total: number;
  keys: LegacyPiiPlaintextKeyReport[];
}

/** The array field a zustand persist wrapper holds for each key. */
const RECORD_FIELD: Record<LegacyPiiPlaintextKey, string> = {
  open3dcalc_customers_v1: "customers",
  open3dcalc_quotes_v1: "quotes",
  open3dcalc_history_v2: "entries",
};

function countRecords(raw: string, field: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 0;
  }
  // A zustand persist wrapper is `{ state: {...}, version: N }`. A raw array is
  // the pre-zustand shape the same key held. Anything else is unrecognizable.
  if (Array.isArray(parsed)) return parsed.length;
  if (parsed && typeof parsed === "object") {
    const state = (parsed as { state?: unknown }).state;
    if (state && typeof state === "object") {
      const records = (state as Record<string, unknown>)[field];
      if (Array.isArray(records)) return records.length;
    }
  }
  return 0;
}

/**
 * Detect legacy plaintext PII under the three replaced keys.
 *
 * `read` is injectable so a test can exercise the counting without a DOM; the
 * default reads through the manifest-gated `localStorage` facade, so an
 * undeclared key is denied rather than read.
 */
export function detectLegacyPlaintextPii(
  read: (key: string) => string | null = (key) => guardedStorage.getItem(key),
): LegacyPiiPlaintextReport {
  const keys = LEGACY_PII_PLAINTEXT_KEYS.map((key) => {
    const raw = read(key);
    const present = raw !== null;
    return {
      key,
      present,
      count: present ? countRecords(raw, RECORD_FIELD[key]) : 0,
    };
  });

  return {
    present: keys.some((entry) => entry.present),
    total: keys.reduce((sum, entry) => sum + entry.count, 0),
    keys,
  };
}
