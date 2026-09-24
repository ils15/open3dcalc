import { useLayoutStore } from "@/shared/stores/layoutStore";
import { BentoSurface } from "./BentoSurface";
import { ClassicSurface } from "./ClassicSurface";
import { GuidedSurface } from "./GuidedSurface";

/**
 * The single switch point between calculator layout surfaces (V2.0 Wave 1).
 *
 * Reads `layoutMode` from the layout store and renders the matching surface.
 * Classic and guided retain their dedicated surfaces; bento renders the compact
 * five-card grid. The classic mode must keep rendering ClassicSurface verbatim
 * (behavior parity is locked by tabsParity/TabletOptimization tests).
 */
export function CalculatorSurface(): React.ReactElement {
  const layoutMode = useLayoutStore((state) => state.layoutMode);

  switch (layoutMode) {
    case "guided":
      return <GuidedSurface />;
    case "bento":
      return <BentoSurface />;
    case "classic":
    default:
      return <ClassicSurface />;
  }
}
