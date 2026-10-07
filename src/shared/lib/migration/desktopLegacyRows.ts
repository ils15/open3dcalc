/**
 * Read-only, renderer-side classification of the Desktop legacy PII source.
 * A missing/disabled bridge is not evidence that legacy rows are absent.
 */

import { LEGACY_PII_PLAINTEXT_KEYS } from "@/shared/lib/legacyPiiPlaintext";
import type { LegacyPiiPlaintextKey } from "@/shared/lib/legacyPiiPlaintext";
import type {
  LegacyPiiRowsReport,
  LegacyPiiRowStatus,
} from "../../../../electron/legacyRows.js";

/** Key NAME → raw legacy value, for the declared keys that have one. */
export type LegacyPiiRowMap = Partial<Record<LegacyPiiPlaintextKey, string>>;

export type DesktopLegacyPiiRowsResult =
  | { status: "not_applicable" }
  | { status: "unavailable" }
  | { status: "absent"; rows: LegacyPiiRowMap }
  | { status: "available"; rows: LegacyPiiRowMap };

const ROW_STATUSES: readonly LegacyPiiRowStatus[] = [
  "legacy_plaintext",
  "already_encrypted",
  "absent",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Renderer user agents include Electron when this is the Desktop target. */
export function isElectronRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /\bElectron\//i.test(navigator.userAgent)
  );
}

/** Validate the IPC payload before its values are trusted by inspection UI. */
export function isLegacyPiiRowsReport(
  report: unknown,
): report is LegacyPiiRowsReport {
  if (!isRecord(report) || typeof report.scannedAt !== "string") return false;
  if (Number.isNaN(Date.parse(report.scannedAt))) return false;
  if (
    !Array.isArray(report.rows) ||
    report.rows.length !== LEGACY_PII_PLAINTEXT_KEYS.length
  ) {
    return false;
  }

  const seen = new Set<string>();
  return (
    report.rows.every((candidate) => {
      if (!isRecord(candidate)) return false;
      const { key, value, status } = candidate;
      if (
        typeof key !== "string" ||
        !LEGACY_PII_PLAINTEXT_KEYS.includes(key as LegacyPiiPlaintextKey) ||
        seen.has(key) ||
        !ROW_STATUSES.includes(status as LegacyPiiRowStatus)
      ) {
        return false;
      }
      seen.add(key);
      return status === "legacy_plaintext"
        ? typeof value === "string"
        : value === null;
    }) && LEGACY_PII_PLAINTEXT_KEYS.every((key) => seen.has(key))
  );
}

/**
 * Map a validated report to its plaintext values. Non-plaintext rows never
 * contribute values, even if a malformed caller bypasses runtime validation.
 */
export function toLegacyPiiRowMap(
  report: LegacyPiiRowsReport,
): LegacyPiiRowMap {
  const map: LegacyPiiRowMap = {};
  for (const row of report.rows) {
    if (row.status === "legacy_plaintext" && typeof row.value === "string") {
      map[row.key] = row.value;
    }
  }
  return map;
}

/**
 * Read the Desktop legacy source when explicitly requested by the user.
 * `not_applicable` is reserved for a non-Electron runtime; all missing, disabled,
 * rejected, or malformed Desktop bridge responses are `unavailable`.
 */
export async function fetchDesktopLegacyPiiRows(): Promise<DesktopLegacyPiiRowsResult> {
  if (typeof window === "undefined") return { status: "not_applicable" };

  try {
    const electronAPI = window.electronAPI;
    if (!electronAPI) {
      return isElectronRuntime()
        ? { status: "unavailable" }
        : { status: "not_applicable" };
    }

    const legacyRows = electronAPI.privacy?.legacyRows;
    if (typeof legacyRows !== "function") return { status: "unavailable" };

    const report: unknown = await legacyRows();
    if (!isLegacyPiiRowsReport(report)) return { status: "unavailable" };
    const rows = toLegacyPiiRowMap(report);
    return Object.keys(rows).length === 0
      ? { status: "absent", rows }
      : { status: "available", rows };
  } catch {
    return { status: "unavailable" };
  }
}
