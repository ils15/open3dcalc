import { Calculator } from "@/shared/components/Calculator/Calculator";

/**
 * Classic layout surface (V2.0 Wave 1).
 *
 * The section-based calculator: SectionNav + SectionRenderer + ResultsPanel,
 * exactly as it behaves today. This thin wrapper keeps Calculator.tsx
 * untouched while giving every layout mode a named surface component, so
 * W3/W4 can add BentoSurface/GuidedSurface as siblings without editing the
 * classic path.
 */
export function ClassicSurface(): React.ReactElement {
  return <Calculator />;
}
