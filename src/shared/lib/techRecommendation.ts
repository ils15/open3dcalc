/**
 * Technology recommendation (Fase 2) — FDM vs Resin suggestion from the mesh.
 *
 * Heuristic model from 3D-printing domain rules:
 *  - Resin excels at small, highly detailed parts (miniatures, mini figs):
 *    small build volume (typical resin printers ≤ ~145 mm), high triangle
 *    density (detail), fine features.
 *  - FDM excels at larger, functional, lower-detail parts: cheaper material,
 *    larger build volume, better mechanical properties.
 *
 * The output is a SUGGESTION only — the user stays in control (the roadmap
 * explicitly rejects an automatic FDM-vs-Resin comparison as "not meaningful
 * — each serves a different purpose"; this is a per-model hint, never a
 * verdict). Reasons are i18n keys with params, never hardcoded strings.
 */

import type { MeshAnalysis } from "./stlParser";

export type PrintTechnology = "fdm" | "resin";

export interface TechRecommendation {
  recommended: PrintTechnology;
  /** How strong the signal is — drives the UI tone, not the behavior. */
  confidence: "high" | "medium" | "low";
  /** i18n key → params for the reasons shown to the user. */
  reasons: Array<{ key: string; params?: Record<string, number | string> }>;
}

/** Largest printable dimension on a typical consumer resin printer (mm). */
const RESIN_MAX_DIMENSION = 145;
/** Comfortable resin build dimension — fits with margin (mm). */
const RESIN_COMFORT_DIMENSION = 100;
/** Triangle density thresholds (triangles per mm³ of mesh volume). */
const DETAIL_DENSITY_HIGH = 0.5;
const DETAIL_DENSITY_MEDIUM = 0.08;
/** Above this many triangles the mesh is detailed regardless of size. */
const TRIANGLE_DETAIL_FLOOR = 250_000;

function triangleDensity(a: MeshAnalysis): number {
  if (a.volume <= 0) return 0;
  return a.triangleCount / a.volume;
}

/**
 * Score-based recommendation. Every rule is documented so the tests can
 * pin each one; the scores favor FDM on ties (cheaper, safer default).
 */
export function recommendTechnology(
  analysis: MeshAnalysis,
): TechRecommendation {
  const { dimensions } = analysis;
  const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
  const density = triangleDensity(analysis);
  const detailed =
    analysis.triangleCount >= TRIANGLE_DETAIL_FLOOR ||
    density >= DETAIL_DENSITY_HIGH;

  let resin = 0;
  let fdm = 0;
  const reasons: TechRecommendation["reasons"] = [];

  // ── Size / build volume ──────────────────────────────────────────────
  // Resin build volume is a LIMITATION (big parts cannot be resin-printed);
  // a small part is NOT a resin advantage by itself — FDM prints small parts
  // cheaply too. Size only scores against resin when it exceeds the limit.
  if (maxDim > RESIN_MAX_DIMENSION) {
    fdm += 3;
    reasons.push({ key: "stl.tech.fdmTooLargeForResin" });
  } else if (maxDim <= RESIN_COMFORT_DIMENSION) {
    // Informational note (no score): fits comfortably in a resin printer.
    reasons.push({
      key: "stl.tech.resinFitsBuildVolume",
      params: { dim: Math.round(maxDim) },
    });
  } else {
    reasons.push({
      key: "stl.tech.resinFitsWithMargin",
      params: { dim: Math.round(maxDim) },
    });
  }
  if (maxDim >= 250) {
    fdm += 2;
    reasons.push({
      key: "stl.tech.fdmLargePart",
      params: { dim: Math.round(maxDim) },
    });
  }

  // ── Detail (triangle density / count) ────────────────────────────────
  if (detailed) {
    resin += 2;
    reasons.push({
      key: "stl.tech.resinDetail",
      params: { tris: analysis.triangleCount.toLocaleString("pt-BR") },
    });
  } else if (density >= DETAIL_DENSITY_MEDIUM) {
    resin += 1;
    reasons.push({ key: "stl.tech.resinSomeDetail" });
  } else {
    fdm += 1;
    reasons.push({ key: "stl.tech.fdmLowDetail" });
  }

  // ── Miniature profile: small bounding box AND high detail ────────────
  if (maxDim <= 80 && detailed) {
    resin += 2;
    reasons.push({ key: "stl.tech.resinMiniature" });
  }

  const recommended: PrintTechnology = resin > fdm ? "resin" : "fdm";
  const gap = Math.abs(resin - fdm);
  const confidence: TechRecommendation["confidence"] =
    gap >= 3 ? "high" : gap >= 2 ? "medium" : "low";

  return { recommended, confidence, reasons };
}
