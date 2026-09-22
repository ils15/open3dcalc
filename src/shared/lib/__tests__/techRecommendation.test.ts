import { describe, it, expect } from "vitest";
import { recommendTechnology } from "@/shared/lib/techRecommendation";
import type { MeshAnalysis } from "@/shared/lib/stlParser";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";

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
    // Regression ({{dim}} never interpolated): the reason must carry the param.
    const tooLarge = rec.reasons.find(
      (r) => r.key === "stl.tech.fdmTooLargeForResin",
    );
    expect(tooLarge).toBeDefined();
    expect(tooLarge?.params?.dim).toBe(250);
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
    const fits = recommendTechnology(
      mesh({ dimensions: { x: 63.4, y: 63.4, z: 63.4 } }),
    ).reasons.find((r) => r.key === "stl.tech.resinFitsBuildVolume");
    expect(fits?.params?.dim).toBe(63);

    const withMargin = recommendTechnology(
      mesh({ dimensions: { x: 120.6, y: 100, z: 80 } }),
    ).reasons.find((r) => r.key === "stl.tech.resinFitsWithMargin");
    expect(withMargin?.params?.dim).toBe(121);

    const largePart = recommendTechnology(
      mesh({
        triangleCount: 8_000,
        dimensions: { x: 250, y: 180, z: 120 },
        volume: 2_500_000,
      }),
    );
    expect(
      largePart.reasons.find((r) => r.key === "stl.tech.fdmLargePart")?.params
        ?.dim,
    ).toBe(250);
    expect(
      largePart.reasons.find((r) => r.key === "stl.tech.fdmTooLargeForResin")
        ?.params?.dim,
    ).toBe(250);
  });

  it("degenerate meshes never crash and default to fdm", () => {
    const rec = recommendTechnology(
      mesh({ volume: 0, triangleCount: 0, dimensions: { x: 0, y: 0, z: 0 } }),
    );
    expect(rec.recommended).toBe("fdm");
    expect(rec.confidence).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Class-of-bug guard: a locale value with {{placeholder}} whose producer
  // omits `params` renders the literal "{{placeholder}}" in the UI.
  // -------------------------------------------------------------------------
  describe("locale placeholders are supplied by reason params", () => {
    /** Branch-covering scenarios — one per reason key the heuristics can emit. */
    const SCENARIOS: Array<Partial<MeshAnalysis>> = [
      {
        triangleCount: 8_000,
        dimensions: { x: 250, y: 180, z: 120 },
        volume: 2_500_000,
      }, // fdmTooLargeForResin + fdmLargePart
      { dimensions: { x: 60, y: 60, z: 60 }, volume: 100_000 }, // resinFitsBuildVolume
      { dimensions: { x: 120.6, y: 100, z: 80 }, volume: 100_000 }, // resinFitsWithMargin
      {
        triangleCount: 600_000,
        dimensions: { x: 50, y: 40, z: 70 },
        volume: 40_000,
      }, // resinDetail + resinMiniature
      {
        triangleCount: 90_000,
        dimensions: { x: 90, y: 90, z: 90 },
        volume: 500_000,
      }, // resinSomeDetail
    ];

    /**
     * `stl.tech.*` keys whose `{{placeholders}}` are intentionally NOT supplied
     * by `reasons` — they are rendered with explicit params elsewhere
     * (`title` at StlPreview.tsx with `{ tech: ... }`).
     */
    const NON_REASON_KEYS = new Set(["stl.tech.title"]);

    function techLeafValues(dict: unknown): Map<string, string> {
      const leaves = new Map<string, string>();
      const stl = (dict as Record<string, unknown>).stl;
      const tech = (stl as Record<string, unknown>).tech;
      const walk = (node: Record<string, unknown>, prefix: string): void => {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "string") leaves.set(`${prefix}${k}`, v);
          else if (v && typeof v === "object")
            walk(v as Record<string, unknown>, `${prefix}${k}.`);
        }
      };
      walk(tech as Record<string, unknown>, "stl.tech.");
      return leaves;
    }

    /** Params the producer supplies, keyed by reason key, across all scenarios. */
    const produced = new Map<string, Record<string, number | string>>();
    for (const overrides of SCENARIOS) {
      for (const reason of recommendTechnology(mesh(overrides)).reasons) {
        produced.set(reason.key, reason.params ?? {});
      }
    }

    it.each([
      ["pt-BR", ptBR],
      ["en-US", enUS],
    ])(
      "every {{placeholder}} in %s stl.tech.* has a producer param",
      (_locale, dict) => {
        for (const [key, value] of techLeafValues(dict)) {
          const placeholders = [...value.matchAll(/\{\{(\w+)\}\}/g)].map(
            (m) => m[1],
          );
          if (placeholders.length === 0 || NON_REASON_KEYS.has(key)) continue;

          expect(
            produced.has(key),
            `no test scenario produces ${key} — add a branch-covering scenario so its params are guarded`,
          ).toBe(true);
          const params = produced.get(key)!;
          for (const name of placeholders) {
            expect(
              params[name],
              `${key}: producer must supply param "${name}" for {{${name}}}`,
            ).toBeDefined();
          }
        }
      },
    );
  });
});
