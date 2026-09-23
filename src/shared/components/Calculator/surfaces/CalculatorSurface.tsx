import { useLayoutStore } from "@/shared/stores/layoutStore";
import { ClassicSurface } from "./ClassicSurface";

/**
 * The single switch point between calculator layout surfaces (V2.0 Wave 1).
 *
 * Reads `layoutMode` from the layout store and renders the matching surface.
 * Only "classic" exists today — "guided" (wizard, W4) and "bento" (card grid,
 * W3) intentionally fall back to ClassicSurface until their waves land, so a
 * persisted future mode never renders a blank surface.
 *
 * New surfaces: add the component in this folder and branch the switch. The
 * classic mode must keep rendering ClassicSurface verbatim (behavior parity
 * is locked by tabsParity/TabletOptimization tests).
 */
export function CalculatorSurface(): React.ReactElement {
  const layoutMode = useLayoutStore((state) => state.layoutMode);

  switch (layoutMode) {
    case "guided":
      // TODO(W4): render <GuidedSurface /> (step-by-step wizard).
      return <ClassicSurface />;
    case "bento":
      // TODO(W3): render <BentoSurface /> (compact card grid).
      return <ClassicSurface />;
    case "classic":
    default:
      return <ClassicSurface />;
  }
}
