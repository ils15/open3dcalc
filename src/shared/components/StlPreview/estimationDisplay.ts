import {
  resolveAnchorGrams,
  resolveAnchorMinutes,
  resolveCalibrationK,
  resolveFixedMinutes,
  type EstimationMode,
  type GcodeAnchor,
} from "@/shared/types/estimation";

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
  /** Fixed setup time in minutes (advanced only, default 0). */
  fixedMinutes?: number;
}

export interface DisplayEstimate {
  weight: number;
  hours: number;
  weightFromGcode: boolean;
  timeFromGcode: boolean;
}

/**
 * Panel display values: simple returns the base untouched; advanced mirrors
 * `estimateWeight`/`estimatePrintTime` (anchor wins, otherwise ×k, plus fixed
 * setup time) with the same rounding as the estimators.
 */
export function resolveDisplayEstimate(
  input: DisplayEstimateInput,
): DisplayEstimate {
  const { weight, minutes, hours, mode, calibrationK, anchor, fixedMinutes } =
    input;
  if (mode !== "advanced") {
    return { weight, hours, weightFromGcode: false, timeFromGcode: false };
  }
  const k = resolveCalibrationK({ mode, calibrationK });
  const fixed = resolveFixedMinutes({ mode, fixedMinutes });
  // Anchor validation lives in estimation.ts (E1) — display only consumes.
  const anchorGrams = resolveAnchorGrams(anchor);
  const rawAnchorMinutes = resolveAnchorMinutes(anchor);
  const anchorMinutes =
    rawAnchorMinutes !== undefined
      ? Math.round(rawAnchorMinutes + fixed)
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
  const scaledMinutes = Math.round(minutes * k + fixed);
  return {
    weight: displayWeight,
    // 1-decimal hours, same as the estimator (H1).
    hours: Math.round((scaledMinutes / 60) * 10) / 10,
    weightFromGcode: anchorGrams !== undefined,
    timeFromGcode: false,
  };
}
