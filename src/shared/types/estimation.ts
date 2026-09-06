/**
 * Estimation modes — ANTI-COMPLEXITY contract.
 *
 * UI: `simple` = "Standard" — instant estimate from profile parameters
 * (rough ±30%); `advanced` = "Custom" — fine-tuning: per-material k factor
 * plus real G-code as anchor.
 *
 * - `simple` (default): legacy path, byte-identical to current behavior.
 *   `calibrationK`, G-code anchors and `fixedMinutes` are ignored.
 * - `advanced`: applies `calibrationK` (default 1.0) on top of the final
 *   weight/time, lets G-code anchors (`gcodeGrams`/`gcodeMinutes`) win the
 *   estimate, and adds `fixedMinutes` setup time on top.
 *
 * YAGNI: no classes, no ML, no histogram (future).
 */

/**
 * Weight/time estimation mode.
 *
 * - `"simple"` → UI "Standard": instant estimate from profile parameters (rough ±30%).
 * - `"advanced"` → UI "Custom": fine-tuning with per-material k factor + real G-code as anchor.
 */
export type EstimationMode = "simple" | "advanced";

/** Slider bounds for the calibration factor (single source: UI + lib import from here). */
export const K_MIN = 0.5;
/** Slider bounds for the calibration factor (single source: UI + lib import from here). */
export const K_MAX = 2;
/** Step of the calibration slider. */
export const K_STEP = 0.05;
/** Neutral calibration factor (no-op). */
export const K_DEFAULT = 1;

/**
 * Per-mode behavior flags (Open/Closed Principle).
 *
 * Resolvers consult this table instead of branching on the mode value, so a
 * future mode (e.g. Klipper with its own anchor rules) becomes a single new
 * entry here — no resolver logic changes.
 *
 * - `standard` behavior = `simple`: legacy path, everything ignored.
 * - `custom` behavior = `advanced`: calibration + anchors + fixed setup apply.
 */
export interface ModeBehavior {
  /** Whether `calibrationK` scales the estimate. */
  applyCalibration: boolean;
  /** Whether G-code anchors (`gcodeGrams`/`gcodeMinutes`) win the estimate. */
  applyAnchors: boolean;
}

export const MODE_BEHAVIOR: Record<EstimationMode, ModeBehavior> = {
  simple: { applyCalibration: false, applyAnchors: false },
  advanced: { applyCalibration: true, applyAnchors: true },
};

/**
 * Behavior flags for the given options (unknown modes fall back to `simple`).
 */
export function getModeBehavior(
  options: EstimateOptions | undefined,
): ModeBehavior {
  const mode = options?.mode;
  if (mode !== undefined && MODE_BEHAVIOR[mode] !== undefined) {
    return MODE_BEHAVIOR[mode];
  }
  return MODE_BEHAVIOR.simple;
}

/**
 * Clamp a raw calibration value into `[K_MIN, K_MAX]`.
 * Non-finite input falls back to `K_DEFAULT`.
 */
export function clampCalibrationK(raw: number): number {
  if (!Number.isFinite(raw)) return K_DEFAULT;
  return Math.min(K_MAX, Math.max(K_MIN, raw));
}

/**
 * Estimate options. Extended by `WeightOptions` (stlParser) and
 * `PrintTimeParams` (printTimeEstimator) — never a parallel type.
 */
export interface EstimateOptions {
  /** Estimation mode. Default `simple` (legacy, ignores the rest). */
  mode?: EstimationMode;
  /**
   * Calibration factor (default 1.0). Only applies in `advanced`:
   * multiplies the final weight/time. Non-finite or <= 0 falls back to 1.0;
   * valid values are clamped to `[K_MIN, K_MAX]`.
   *
   * GEOMETRIC LIMIT: k only corrects systematic proportional bias
   * (k = actual/estimated, median over ≥ 10 jobs, per profile, never across
   * materials — see §8 of `docs/estimators-model.md`). It does not fix bias
   * that varies with geometry: the area×thickness formula counts edges twice,
   * leaving +13% residue on a 10 mm cube vs +0.4% on a 100 mm one — no single
   * k flattens that curve; fix the formula, not the factor.
   */
  calibrationK?: number;
  /**
   * Weight anchor in grams (e.g. total E from G-code, converted).
   * Only applies in `advanced`: when finite and > 0, it WINS the estimate.
   */
  gcodeGrams?: number;
  /**
   * Time anchor in minutes (e.g. G-code `;TIME`).
   * Only applies in `advanced`: when finite and > 0, it WINS the estimate.
   */
  gcodeMinutes?: number;
  /**
   * Fixed setup time in minutes (e.g. heat-up, bed prep, part removal).
   * Only applies in `advanced`: added on top of the (k-scaled or anchored)
   * time as `t_real = t_fixed + k * t`. Default 0 = current behavior.
   * Non-finite or negative values fall back to 0.
   */
  fixedMinutes?: number;
}

/** Effective `calibrationK`: only in advanced, otherwise 1.0 (no-op). */
export function resolveCalibrationK(
  options: EstimateOptions | undefined,
): number {
  if (!getModeBehavior(options).applyCalibration) return 1;
  const k = options?.calibrationK;
  if (!Number.isFinite(k) || (k as number) <= 0) return 1;
  return clampCalibrationK(k as number);
}

/** Valid weight anchor: only in advanced, finite and > 0. */
export function resolveWeightAnchor(
  options: EstimateOptions | undefined,
): number | undefined {
  if (!getModeBehavior(options).applyAnchors) return undefined;
  const g = options?.gcodeGrams;
  return Number.isFinite(g) && (g as number) > 0 ? (g as number) : undefined;
}

/** Valid time anchor: only in advanced, finite and > 0. */
export function resolveTimeAnchor(
  options: EstimateOptions | undefined,
): number | undefined {
  if (!getModeBehavior(options).applyAnchors) return undefined;
  const m = options?.gcodeMinutes;
  return Number.isFinite(m) && (m as number) > 0 ? (m as number) : undefined;
}

/**
 * Canonical G-code anchor (E1 — single place for anchor validation).
 * The UI re-exports this type instead of declaring a parallel one.
 */
export interface GcodeAnchor {
  fileName: string;
  grams: number;
  minutes?: number;
}

/**
 * Valid anchored weight in grams: finite and > 0 (E1 — display only consumes).
 */
export function resolveAnchorGrams(
  anchor: GcodeAnchor | null | undefined,
): number | undefined {
  const g = anchor?.grams;
  return Number.isFinite(g) && (g as number) > 0 ? (g as number) : undefined;
}

/**
 * Valid anchored time in minutes: finite and > 0 (E1 — display only consumes).
 */
export function resolveAnchorMinutes(
  anchor: GcodeAnchor | null | undefined,
): number | undefined {
  const m = anchor?.minutes;
  return Number.isFinite(m) && (m as number) > 0 ? (m as number) : undefined;
}

/**
 * Valid fixed setup time in minutes: finite and >= 0, otherwise 0.
 * Pure validation — mode gating happens at the call site via
 * `MODE_BEHAVIOR` (simple mode ignores every option).
 */
export function resolveFixedMinutes(
  options: EstimateOptions | undefined,
): number {
  const f = options?.fixedMinutes;
  return Number.isFinite(f) && (f as number) >= 0 ? (f as number) : 0;
}
