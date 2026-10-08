/**
 * Residue source for the legacy-PII surfaces, desktop-aware.
 *
 * The web residue lives in `localStorage` and is read SYNCHRONOUSLY. On desktop
 * the persistence bridge never hydrates the three migrated PII keys, so the
 * residue is in SQLite and only reachable asynchronously through the read-only
 * `privacy:legacy-rows` IPC. A surface that only read `localStorage` would show
 * nothing on desktop: no prompt, and no residue in the disclosure panel — which
 * is exactly the "retained but invisible" defect the re-home closes.
 *
 * These hooks bridge the two: they start from the sync `localStorage` reader
 * (so the web behaviour and every existing test are unchanged) and, when a
 * desktop source answers, merge the fetched values in. The merge NEVER writes
 * anything and never persists PII — it only feeds detection and the re-home's
 * read path.
 */

import { useEffect, useMemo, useState } from "react";
import {
  detectLegacyPlaintextPii,
  type LegacyPiiPlaintextReport,
} from "@/shared/lib/legacyPiiPlaintext";
import type { LegacyPiiPlaintextKey } from "@/shared/lib/legacyPiiPlaintext";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import {
  fetchDesktopLegacyPiiRows,
  type LegacyPiiRowMap,
} from "@/shared/lib/migration/desktopLegacyRows";

/** A sync reader of a raw storage value, the shape the detection half takes. */
export type LegacyPiiRead = (key: string) => string | null;

export type LegacyPiiReadLoad =
  | { status: "idle" | "loading" }
  | { status: "ready"; read: LegacyPiiRead }
  | { status: "unavailable"; reason: string };

export type LegacyPiiResidueLoad =
  | { status: "idle" | "loading" }
  | { status: "ready"; report: LegacyPiiPlaintextReport }
  | { status: "unavailable"; reason: string };

/**
 * Merge validated desktop rows over a local reader. A desktop value wins for a
 * key it carries; every other key falls through to the local reader.
 */
export function mergeLegacyPiiRead(
  localRead: LegacyPiiRead,
  rows: LegacyPiiRowMap | null,
): LegacyPiiRead {
  if (!rows) return localRead;
  return (key) => rows[key as LegacyPiiPlaintextKey] ?? localRead(key);
}

/**
 * Fetches the source only when enabled. An unavailable desktop source never
 * falls through to a local-only empty report.
 */
export function useLegacyPiiRead(enabled = true): LegacyPiiReadLoad {
  const [source, setSource] = useState<LegacyPiiReadLoad>({ status: "idle" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchDesktopLegacyPiiRows()
      .then((fetched) => {
        if (cancelled) return;
        if (fetched.status === "unavailable") {
          setSource({ status: "unavailable", reason: fetched.reason });
          return;
        }
        const rows = fetched.status === "available" ? fetched.rows : null;
        setSource({
          status: "ready",
          read: mergeLegacyPiiRead((key) => guardedStorage.getItem(key), rows),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSource({
            status: "unavailable",
            reason: "legacy_source_unavailable",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  if (!enabled) return { status: "idle" };
  return source.status === "idle" ? { status: "loading" } : source;
}

/** The value-free residue report, available only after its source is resolved. */
export function useLegacyPiiResidue(enabled = true): LegacyPiiResidueLoad {
  const source = useLegacyPiiRead(enabled);
  const report = useMemo(
    () =>
      source.status === "ready" ? detectLegacyPlaintextPii(source.read) : null,
    [source],
  );
  if (source.status !== "ready") return source;
  if (report === null) return { status: "loading" };
  return { status: "ready", report };
}
