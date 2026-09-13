import { describe, it, expect } from "vitest";
import { recommendTechnology } from "@/shared/lib/techRecommendation";
import type { MeshAnalysis } from "@/shared/lib/stlParser";

// ---------------------------------------------------------------------------
// Fase 2 — FDM vs Resin per-model suggestion (heuristics pinned by tests).
// Synthetic meshes only.
// ---------------------------------------------------------------------------

function mesh(overrides: Partial<MeshAnalysis> = {}): MeshAnalysis {
  return {
    triangleCount: 5_000,
    vertexCount: 2_500,
    dimensions: { x: 60, y: 60, z: 60 },
    volume: 100_000, // 100 cm³-equivalent in mm³ for density purposes
    surfaceArea: 20_000,
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 60, y: 60, z: 60 },
    },
    integrity: { valid: true, issues: [] },
    ...overrides,
  };
}

describe("recommendTechnology", () => {
  it("miniature profile (small + dense mesh) ⇒ resin with high confidence", () => {
    const rec = recommendTechnology(
      mesh({
        triangleCount: 600_000,
        dimensions: { x: 50, y: 40, z: 70 },
        volume: 40_000,
      }),
    );
    expect(rec.recommended).toBe("resin");
    expect(rec.confidence).toBe("high");
    expect(rec.reasons.some((r) => r.key === "stl.tech.resinMiniature")).toBe(
      true,
    );
  });

  it("large part beyond resin build volume ⇒ fdm", () => {
    const rec = recommendTechnology(
      mesh({
        triangleCount: 8_000,
        dimensions: { x: 250, y: 180, z: 120 },
        volume: 2_500_000,
      }),
    );
    expect(rec.recommended).toBe("fdm");
    expect(rec.confidence).toBe("high");
    expect(
      rec.reasons.some((r) => r.key === "stl.tech.fdmTooLargeForResin"),
    ).toBe(true);
  });

  it("small but low-detail part ⇒ fdm (cheaper, no resin need)", () => {
    const rec = recommendTechnology(
      mesh({
        triangleCount: 1_200,
        dimensions: { x: 40, y: 40, z: 20 },
        volume: 30_000,
      }),
    );
    expect(rec.recommended).toBe("fdm");
    expect(rec.reasons.some((r) => r.key === "stl.tech.fdmLowDetail")).toBe(
      true,
    );
  });

  it("medium part with mid density ⇒ a low/medium-confidence suggestion", () => {
    const rec = recommendTechnology(
      mesh({
        triangleCount: 90_000,
        dimensions: { x: 90, y: 90, z: 90 },
        volume: 500_000,
      }),
    );
    expect(["low", "medium"]).toContain(rec.confidence);
    // Reasons always carry i18n keys (never user-visible hardcoded text).
    for (const reason of rec.reasons) {
      expect(reason.key).toMatch(/^stl\.tech\./);
    }
  });

  it("reason params round dimensions for display", () => {
    const rec = recommendTechnology(
      mesh({ dimensions: { x: 63.4, y: 63.4, z: 63.4 } }),
    );
    const fits = rec.reasons.find(
      (r) => r.key === "stl.tech.resinFitsBuildVolume",
    );
    expect(fits?.params?.dim).toBe(63);
  });

  it("degenerate meshes never crash and default to fdm", () => {
    const rec = recommendTechnology(
      mesh({ volume: 0, triangleCount: 0, dimensions: { x: 0, y: 0, z: 0 } }),
    );
    expect(rec.recommended).toBe("fdm");
    expect(rec.confidence).toBeTruthy();
  });
});
