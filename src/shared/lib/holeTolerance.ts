/**
 * Pure Maker Toolbox engineering helpers:
 * 1. Hole Tolerance & Press-Fit compensation by material (PLA, PETG, ABS, ASA, TPU).
 * 2. Brass Heat-Set Threaded Insert dimensions (M2 .. M6).
 * 3. Volumetric Flow Rate (mm³/s) calculator & hotend tier classifier.
 */

export type ToolboxMaterial = "PLA" | "PETG" | "ABS" | "ASA" | "TPU";

export type FitType = "clearance_loose" | "snug_fit" | "press_fit";

export interface MaterialToleranceProfile {
  material: ToolboxMaterial;
  shrinkageNote: string;
  /** Extra diameter compensation added to nominal hole/pin diameter (mm). */
  offsetsMm: Record<FitType, number>;
}

export const MATERIAL_TOLERANCE_PROFILES: Record<
  ToolboxMaterial,
  MaterialToleranceProfile
> = {
  PLA: {
    material: "PLA",
    shrinkageNote: "Baixa contração (~0.2%). Ideal para encaixes precisos.",
    offsetsMm: {
      clearance_loose: 0.35,
      snug_fit: 0.2,
      press_fit: 0.05,
    },
  },
  PETG: {
    material: "PETG",
    shrinkageNote: "Leve expansão de perímetro e stringing; exige folga maior.",
    offsetsMm: {
      clearance_loose: 0.45,
      snug_fit: 0.25,
      press_fit: 0.1,
    },
  },
  ABS: {
    material: "ABS",
    shrinkageNote: "Contração térmica (~0.6–0.8%); compense furos internos.",
    offsetsMm: {
      clearance_loose: 0.5,
      snug_fit: 0.3,
      press_fit: 0.15,
    },
  },
  ASA: {
    material: "ASA",
    shrinkageNote: "Comportamento dimensional próximo ao ABS (~0.5–0.7%).",
    offsetsMm: {
      clearance_loose: 0.48,
      snug_fit: 0.28,
      press_fit: 0.12,
    },
  },
  TPU: {
    material: "TPU",
    shrinkageNote: "Material flexível; furos cedem facilmente em press-fit.",
    offsetsMm: {
      clearance_loose: 0.4,
      snug_fit: 0.15,
      press_fit: -0.1,
    },
  },
};

export interface HeatSetInsertSpec {
  thread: "M2" | "M2.5" | "M3" | "M4" | "M5" | "M6";
  /** Recommended CAD hole diameter (mm). */
  holeDiameterMm: number;
  /** Minimum recommended boss/wall thickness around the hole (mm). */
  minWallThicknessMm: number;
  /** Standard insert length / minimum hole depth (mm). */
  minHoleDepthMm: number;
}

export const HEAT_SET_INSERTS: readonly HeatSetInsertSpec[] = [
  {
    thread: "M2",
    holeDiameterMm: 3.2,
    minWallThicknessMm: 1.6,
    minHoleDepthMm: 4.5,
  },
  {
    thread: "M2.5",
    holeDiameterMm: 3.6,
    minWallThicknessMm: 1.8,
    minHoleDepthMm: 5.5,
  },
  {
    thread: "M3",
    holeDiameterMm: 4.0,
    minWallThicknessMm: 2.0,
    minHoleDepthMm: 6.5,
  },
  {
    thread: "M4",
    holeDiameterMm: 5.6,
    minWallThicknessMm: 2.4,
    minHoleDepthMm: 8.5,
  },
  {
    thread: "M5",
    holeDiameterMm: 6.4,
    minWallThicknessMm: 2.8,
    minHoleDepthMm: 10.0,
  },
  {
    thread: "M6",
    holeDiameterMm: 8.0,
    minWallThicknessMm: 3.2,
    minHoleDepthMm: 12.5,
  },
];

export function computeRecommendedHoleDiameter(
  nominalDiameterMm: number,
  material: ToolboxMaterial,
  fitType: FitType,
): {
  nominalMm: number;
  offsetMm: number;
  cadHoleMm: number;
} {
  const safeNominal = Number.isFinite(nominalDiameterMm)
    ? Math.max(0.5, nominalDiameterMm)
    : 4;
  const profile = MATERIAL_TOLERANCE_PROFILES[material];
  const offsetMm = profile.offsetsMm[fitType];
  return {
    nominalMm: Number(safeNominal.toFixed(2)),
    offsetMm,
    cadHoleMm: Number(Math.max(0.5, safeNominal + offsetMm).toFixed(2)),
  };
}

export type HotendFlowTier =
  | "standard_ptfe"
  | "all_metal"
  | "high_flow"
  | "ultra_high_flow";

export interface VolumetricFlowResult {
  flowMm3PerSec: number;
  tier: HotendFlowTier;
  maxSafeSpeedForAllMetalMmPerSec: number;
  maxSafeSpeedForHighFlowMmPerSec: number;
}

export function computeVolumetricFlow(
  layerHeightMm: number,
  lineWidthMm: number,
  speedMmPerSec: number,
): VolumetricFlowResult {
  const lh = Number.isFinite(layerHeightMm) && layerHeightMm > 0 ? layerHeightMm : 0.2;
  const lw = Number.isFinite(lineWidthMm) && lineWidthMm > 0 ? lineWidthMm : 0.42;
  const spd = Number.isFinite(speedMmPerSec) && speedMmPerSec > 0 ? speedMmPerSec : 60;

  const flow = Number((lh * lw * spd).toFixed(2));
  const area = lh * lw;

  let tier: HotendFlowTier = "standard_ptfe";
  if (flow > 28) tier = "ultra_high_flow";
  else if (flow > 18) tier = "high_flow";
  else if (flow > 12) tier = "all_metal";

  return {
    flowMm3PerSec: flow,
    tier,
    maxSafeSpeedForAllMetalMmPerSec: Math.round(18 / area),
    maxSafeSpeedForHighFlowMmPerSec: Math.round(28 / area),
  };
}
