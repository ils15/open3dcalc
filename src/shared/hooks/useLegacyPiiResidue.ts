import { useEffect, useState } from "react";
import {
  getLegacyPiiDisclosure,
  type LegacyPiiDisclosure,
} from "@/shared/lib/migration/legacyPiiDisclosure";
import { LEGACY_PII_PLAINTEXT_KEYS } from "@/shared/lib/legacyPiiPlaintext";
import { installPiiStoreRuntimeEnvironment } from "@/shared/lib/crypto/piiStoreHydration";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import {
  fetchDesktopLegacyPiiRows,
  isElectronRuntime,
  type DesktopLegacyPiiRowsResult,
  type LegacyPiiRowMap,
} from "@/shared/lib/migration/desktopLegacyRows";

export type LegacyPiiInspectionStatus =
  | "not_inspected"
  | "loading"
  | "not_applicable"
  | "absent"
  | "available"
  | "partial"
  | "unavailable";

export interface LegacyPiiInspection {
  status: LegacyPiiInspectionStatus;
  disclosure: LegacyPiiDisclosure | null;
}

interface InspectionState extends LegacyPiiInspection {
  revision: number;
}

/** Merge validated Desktop rows over the local legacy source without losing local evidence. */
export function mergeLegacyPiiRead(
  localRead: (key: string) => string | null,
  rows: LegacyPiiRowMap | null,
): (key: string) => string | null {
  if (!rows) return localRead;
  return (key) => {
    if (
      LEGACY_PII_PLAINTEXT_KEYS.includes(
        key as (typeof LEGACY_PII_PLAINTEXT_KEYS)[number],
      )
    ) {
      return rows[key as keyof LegacyPiiRowMap] ?? localRead(key);
    }
    return localRead(key);
  };
}

function isUnavailable(
  source: DesktopLegacyPiiRowsResult,
): source is { status: "unavailable" } {
  return source.status === "unavailable";
}

/**
 * Inspect legacy values only after a caller explicitly enables the hook.
 * Desktop row inspection is disabled in this build, so Desktop runtimes inspect
 * only local evidence and report the combined profile as unavailable.
 */
export function useLegacyPiiDisclosure(
  enabled = false,
  revision = 0,
): LegacyPiiInspection {
  const [inspection, setInspection] = useState<InspectionState>({
    status: "not_inspected",
    disclosure: null,
    revision: -1,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const source: DesktopLegacyPiiRowsResult = isElectronRuntime()
        ? { status: "unavailable" }
        : await fetchDesktopLegacyPiiRows();
      if (cancelled) return;

      try {
        installPiiStoreRuntimeEnvironment();
        const localRead = (key: string): string | null =>
          guardedStorage.getItem(key);
        if (isUnavailable(source)) {
          const localDisclosure = getLegacyPiiDisclosure({ read: localRead });
          setInspection({
            status: "unavailable",
            disclosure: localDisclosure,
            revision,
          });
          return;
        }

        const rows =
          source.status === "available" || source.status === "absent"
            ? source.rows
            : null;
        const disclosure = getLegacyPiiDisclosure({
          read: mergeLegacyPiiRead(localRead, rows),
        });
        const status =
          source.status === "not_applicable"
            ? "not_applicable"
            : source.status === "available" || disclosure.residue.present
              ? "available"
              : "absent";
        setInspection({ status, disclosure, revision });
      } catch {
        setInspection({
          status: "unavailable",
          disclosure: null,
          revision,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, revision]);

  if (enabled && inspection.revision !== revision) {
    return { status: "loading", disclosure: null };
  }
  return inspection;
}
