/**
 * Renderer-side source of the DESKTOP legacy PII residue (Beta5 desktop
 * re-home).
 *
 * The web re-home reads the residue from `localStorage`. On desktop the
 * `persistence-bridge` deliberately never hydrates the three migrated PII keys,
 * so `localStorage` holds none of it: the residue lives in SQLite `storage`
 * rows and reaches the renderer through the READ-ONLY `privacy:legacy-rows` IPC
 * (see `electron/legacyRows.ts`).
 *
 * This module is the thin adapter between that IPC contract and the re-home's
 * `read` function. It is deliberately NOT where PII is written: it returns the
 * values in memory so the caller can copy them into the encrypted vault. The
 * values are never persisted here — the persistence bridge refuses these keys,
 * and the vault is the only destination.
 *
 * Source state is explicit: a browser has no desktop source, while an Electron
 * bridge failure is unavailable (not proof that the legacy rows are absent).
 */

import type { LegacyPiiPlaintextKey } from "@/shared/lib/legacyPiiPlaintext";
import type { LegacyPiiRowsReport } from "../../../../electron/legacyRows.js";

/** Key NAME → raw legacy value, for the declared keys that have one. */
export type LegacyPiiRowMap = Partial<Record<LegacyPiiPlaintextKey, string>>;

export type DesktopLegacyPiiRowsResult =
  | { status: "not_applicable" }
  | { status: "absent" }
  | { status: "available"; rows: LegacyPiiRowMap }
  | { status: "unavailable"; reason: string };

const EXPECTED_KEYS = new Set<string>([
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
]);

function isLegacyRowsReport(value: unknown): value is LegacyPiiRowsReport {
  if (!value || typeof value !== "object") return false;
  const report = value as { scannedAt?: unknown; rows?: unknown };
  if (
    typeof report.scannedAt !== "string" ||
    report.scannedAt.length === 0 ||
    !Array.isArray(report.rows) ||
    report.rows.length !== EXPECTED_KEYS.size
  ) {
    return false;
  }

  const seen = new Set<string>();
  return (
    report.rows.every((candidate: unknown) => {
      if (!candidate || typeof candidate !== "object") return false;
      const row = candidate as {
        key?: unknown;
        status?: unknown;
        value?: unknown;
      };
      if (
        typeof row.key !== "string" ||
        !EXPECTED_KEYS.has(row.key) ||
        seen.has(row.key)
      ) {
        return false;
      }
      seen.add(row.key);
      if (row.status === "legacy_plaintext")
        return typeof row.value === "string";
      return (
        (row.status === "already_encrypted" || row.status === "absent") &&
        row.value === null
      );
    }) && seen.size === EXPECTED_KEYS.size
  );
}

/**
 * Map a `privacy:legacy-rows` report to the value map the re-home reads.
 *
 * Only rows that carry a value (`legacy_plaintext`) are kept; an
 * `already_encrypted` or `absent` row contributes nothing, so the merge can
 * never treat a ciphertext as residue.
 */
export function toLegacyPiiRowMap(
  report: LegacyPiiRowsReport,
): LegacyPiiRowMap {
  const map: LegacyPiiRowMap = {};
  for (const row of report.rows) {
    if (row.value !== null) map[row.key] = row.value;
  }
  return map;
}

/**
 * Fetch the desktop legacy rows over IPC. A report is absent only after all
 * expected rows have been validated and none contains plaintext.
 */
export async function fetchDesktopLegacyPiiRows(): Promise<DesktopLegacyPiiRowsResult> {
  if (typeof window === "undefined") return { status: "not_applicable" };
  const electronRuntime =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Electron");
  const api = window.electronAPI;
  if (!api) {
    return electronRuntime
      ? { status: "unavailable", reason: "preload_bridge_unavailable" }
      : { status: "not_applicable" };
  }
  const privacy = api.privacy;
  if (typeof privacy?.legacyRows !== "function") {
    return { status: "unavailable", reason: "legacy_rows_api_unavailable" };
  }
  try {
    const report: unknown = await privacy.legacyRows();
    if (!isLegacyRowsReport(report)) {
      return { status: "unavailable", reason: "invalid_legacy_rows_report" };
    }
    const rows = toLegacyPiiRowMap(report);
    return Object.keys(rows).length > 0
      ? { status: "available", rows }
      : { status: "absent" };
  } catch {
    return { status: "unavailable", reason: "legacy_rows_read_failed" };
  }
}
