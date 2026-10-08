/**
 * The desktop-aware, value-free disclosure of the legacy PII residue.
 *
 * A thin React wrapper over `getLegacyPiiDisclosure` that feeds it the merged
 * reader from `useLegacyPiiRead`, so the Privacy screen's residue panel is
 * honest on desktop too (where the residue is in SQLite, not `localStorage`).
 *
 * `enabled: false` skips the derivation entirely and returns `null` — the panel
 * uses that when a caller injects its own disclosure, so an injected test value
 * never triggers a live read.
 */

import { useEffect, useState } from "react";
import {
  getLegacyPiiDisclosure,
  type LegacyPiiDisclosure,
} from "@/shared/lib/migration/legacyPiiDisclosure";
import { installPiiStoreRuntimeEnvironment } from "@/shared/lib/crypto/piiStoreHydration";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { mergeLegacyPiiRead } from "@/shared/hooks/useLegacyPiiResidue";
import { fetchDesktopLegacyPiiRows } from "@/shared/lib/migration/desktopLegacyRows";

export type LegacyPiiDisclosureLoad =
  | { status: "idle" | "loading" }
  | { status: "ready"; disclosure: LegacyPiiDisclosure }
  | { status: "unavailable"; reason: string };

/** The live disclosure state; it is fetched only after an explicit request. */
export function useLegacyPiiDisclosure(
  enabled = false,
): LegacyPiiDisclosureLoad {
  const [state, setState] = useState<LegacyPiiDisclosureLoad>({
    status: "idle",
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void fetchDesktopLegacyPiiRows()
      .then((source) => {
        if (cancelled) return;
        if (source.status === "unavailable") {
          setState({ status: "unavailable", reason: source.reason });
          return;
        }

        const localRead = (key: string) => guardedStorage.getItem(key);
        const rows = source.status === "available" ? source.rows : null;
        const read = mergeLegacyPiiRead(localRead, rows);
        // Install the capability snapshot before reading markers, or a capable
        // browser would report `capability_unknown` in the vault section.
        installPiiStoreRuntimeEnvironment();
        setState({
          status: "ready",
          disclosure: getLegacyPiiDisclosure({ read }),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
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
  return state.status === "idle" ? { status: "loading" } : state;
}
