import { useLayoutStore } from "@/shared/stores/layoutStore";
import { ClassicSurface } from "./ClassicSurface";
import { GuidedSurface } from "./GuidedSurface";

/**
 * The single switch point between calculator layout surfaces (V2.0 Wave 1).
 *
 * Reads `layoutMode` from the layout store and renders the matching surface.
 * "classic" and "guided" (wizard, W4) have dedicated surfaces; "bento" (card
 * grid, W3) intentionally falls back to ClassicSurface until its wave lands, so
 * a persisted future mode never renders a blank surface.
 *
 * New surfaces: add the component in this folder and branch the switch. The
 * classic mode must keep rendering ClassicSurface verbatim (behavior parity
 * is locked by tabsParity/TabletOptimization tests).
 */
export function CalculatorSurface(): React.ReactElement {
  const layoutMode = useLayoutStore((state) => state.layoutMode);

  switch (layoutMode) {
    case "guided":
      return <GuidedSurface />;
    case "bento":
      // TODO(W3): render <BentoSurface /> (compact card grid).
      return <ClassicSurface />;
    case "classic":
    default:
      return <ClassicSurface />;
  }
}
