import { useEffect, useState } from "react";

import { parseGcodeChestnut } from "@/shared/lib/gcodeChestnut";
import type { ChestnutBounds } from "@/shared/lib/gcodeChestnut";

/**
 * Effective dimension state: "measuring" while the parallel adapter pass is in
 * flight (or its result is stale), "unavailable" when the bounds are not
 * measurable, or a finite box.
 */
export type DimensionsStatus =
  | { kind: "bounds"; bounds: ChestnutBounds; honest: boolean }
  | { kind: "unavailable" }
  | { kind: "measuring" };

// Re-exported so the panel's own type imports stay in one place.
export type { ChestnutBounds };

/**
 * D-CL6 — object dimensions for the toolpath preview.
 *
 * Parses the viewer's already-owned bytes through the chestnut adapter
 * *separately* from the viewer itself. The engine's public viewer API exposes
 * no bounds getter (only `frameContent: 'object'` framing), and the adapter is
 * the one module that already normalizes the engine's empty-bounds sentinel
 * (±Infinity) to `undefined` — so a file with no measurable geometry yields
 * `—`, never a fake 0-size box (the D-EA6 null-guard).
 *
 * **Scope:** this is display-only. Filament/time the adapter also computes are
 * discarded here — the calculation engine stays legacy (D-CL3 proved it more
 * accurate on those axes). Only bounds flow to the UI.
 *
 * **State shape:** only the settled result lives in state, tagged with the
 * bytes it belongs to so a stale result (file changed / unmount) reads as
 * "measuring" via the render-time derivation below — no `setState` fires inside
 * the effect body (the same discipline `useOwnedBytes` uses).
 */
export function useObjectDimensions(
  bytes: Uint8Array | null,
): DimensionsStatus {
  const [settled, setSettled] = useState<
    | {
        kind: "bounds";
        bounds: ChestnutBounds;
        honest: boolean;
        for: Uint8Array;
      }
    | { kind: "unavailable"; for: Uint8Array }
    | null
  >(null);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    parseGcodeChestnut(bytes)
      .then((result) => {
        if (cancelled) return;
        // Framing precedence mirrors the adapter's own: modelBounds (excludes
        // all housekeeping — skirt/brim/support/wipe towers) → objectBounds
        // (excludes skirt/prime/purge) → bounds (extrusion-only fallback).
        const bounds =
          result.modelBounds ?? result.objectBounds ?? result.bounds;
        setSettled(
          bounds
            ? {
                kind: "bounds",
                bounds,
                honest: result.modelBounds != null,
                for: bytes,
              }
            : { kind: "unavailable", for: bytes },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setSettled({ kind: "unavailable", for: bytes });
      });
    return () => {
      cancelled = true;
    };
  }, [bytes]);

  // A result that isn't about the current bytes is stale and reads as
  // "measuring" until the fresh pass settles.
  if (!settled || settled.for !== bytes) {
    return { kind: "measuring" };
  }
  if (settled.kind === "unavailable") {
    return { kind: "unavailable" };
  }
  return { kind: "bounds", bounds: settled.bounds, honest: settled.honest };
}
