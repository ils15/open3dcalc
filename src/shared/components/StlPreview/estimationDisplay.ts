import type { EstimationMode } from "@/shared/types/estimation";
import type { GcodeAnchor } from "./EstimationModeSection";

export interface DisplayEstimateInput {
  /** Base (simple) weight in grams. */
  weight: number;
  /** Base (simple) time in minutes; null when unknown (keeps hours as-is). */
  minutes: number | null;
  /** Base (simple) time in hours. */
  hours: number;
  mode: EstimationMode;
  calibrationK: number;
  anchor: GcodeAnchor | null;
}

export interface DisplayEstimate {
  weight: number;
  hours: number;
  weightFromGcode: boolean;
  timeFromGcode: boolean;
}

/**
 * Valores exibidos no painel: simples devolve a base intocada; avançado
 * espelha `estimateWeight`/`estimatePrintTime` (âncora vence, senão ×k)
 * com os mesmos arredondamentos dos estimadores.
 */
export function resolveDisplayEstimate(
  input: DisplayEstimateInput,
): DisplayEstimate {
  const { weight, minutes, hours, mode, calibrationK, anchor } = input;
  if (mode !== "advanced") {
    return { weight, hours, weightFromGcode: false, timeFromGcode: false };
  }
  const k =
    Number.isFinite(calibrationK) && calibrationK > 0 ? calibrationK : 1;
  const anchorGrams =
    anchor && Number.isFinite(anchor.grams) && anchor.grams > 0
      ? anchor.grams
      : undefined;
  const anchorMinutes =
    anchor &&
    anchor.minutes != null &&
    Number.isFinite(anchor.minutes) &&
    anchor.minutes > 0
      ? Math.round(anchor.minutes)
      : undefined;
  const displayWeight = anchorGrams ?? parseFloat((weight * k).toFixed(2));
  if (anchorMinutes !== undefined) {
    return {
      weight: displayWeight,
      hours: Math.round((anchorMinutes / 60) * 10) / 10,
      weightFromGcode: anchorGrams !== undefined,
      timeFromGcode: true,
    };
  }
  if (minutes == null || !Number.isFinite(minutes)) {
    return {
      weight: displayWeight,
      hours,
      weightFromGcode: anchorGrams !== undefined,
      timeFromGcode: false,
    };
  }
  const scaledMinutes = Math.round(minutes * k);
  return {
    weight: displayWeight,
    hours: Math.round((scaledMinutes / 60) * 100) / 100,
    weightFromGcode: anchorGrams !== undefined,
    timeFromGcode: false,
  };
}
