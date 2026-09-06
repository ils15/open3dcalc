import { describe, it, expect } from "vitest";

// TDD RED for gcode dedup cleanup (W1/C1/T1-T2/E1/H1/T3):
// - single-source time conversion + first-header-wins (T1/T2)
// - single-source filament defaults + weight helper (W1)
// - single-place anchor validation (E1)
// - 1-decimal hours unification (H1)
// - single-source upload cap (C1)

describe("gcode dedup — shared time helpers (T1/T2)", () => {
  it("timeSecondsToMinutes converts with estimator rounding", async () => {
    const { timeSecondsToMinutes } = await import("../gcodeTotals");
    expect(timeSecondsToMinutes(7200)).toBe(120);
    expect(timeSecondsToMinutes(5400)).toBe(90);
    expect(timeSecondsToMinutes(5025)).toBe(84);
  });

  it("firstHeaderMinutes keeps the first header (first-header-wins)", async () => {
    const { firstHeaderMinutes } = await import("../gcodeTotals");
    expect(firstHeaderMinutes(undefined, 7200)).toBe(120);
    expect(firstHeaderMinutes(120, 3600)).toBe(120);
    expect(firstHeaderMinutes(undefined, undefined)).toBeUndefined();
  });

  it("both parsers agree on header conversion", async () => {
    const { parseGcode } = await import("../gcodeParser");
    const { parseGcodeTotals } = await import("../gcodeTotals");
    const text = ";TIME:7200\nG1 X0 Y0 E1";
    expect(parseGcode(text).printTimeMinutes).toBe(120);
    expect(parseGcodeTotals(text).timeMinutes).toBe(120);
  });
});

describe("gcode dedup — filament profile params (W1)", () => {
  it("exports single-source filament defaults", async () => {
    const { DEFAULT_FILAMENT_DIAMETER_MM, DEFAULT_FILAMENT_DENSITY_GCM3 } =
      await import("../gcodeTotals");
    expect(DEFAULT_FILAMENT_DIAMETER_MM).toBe(1.75);
    expect(DEFAULT_FILAMENT_DENSITY_GCM3).toBe(1.24);
  });

  it("parseGcode uses default PLA profile (no magic numbers at call site)", async () => {
    const { parseGcode } = await import("../gcodeParser");
    const r = parseGcode("G1 X0 Y0 E10");
    // 10mm of 1.75mm PLA ≈ 0.0298g
    expect(r.filamentUsedGrams).toBeCloseTo(0.0298, 3);
  });

  it("parseGcode accepts a parameterized filament profile", async () => {
    const { parseGcode } = await import("../gcodeParser");
    const base = parseGcode("G1 X0 Y0 E10");
    const dense = parseGcode("G1 X0 Y0 E10", { densityGcm3: 1.27 });
    expect(dense.filamentUsedGrams).toBeGreaterThan(base.filamentUsedGrams);
    const thick = parseGcode("G1 X0 Y0 E10", { filamentDiameterMm: 2.85 });
    expect(thick.filamentUsedGrams).toBeGreaterThan(base.filamentUsedGrams);
  });
});

describe("gcode dedup — anchor validation single place (E1)", () => {
  it("resolveAnchorGrams/resolveAnchorMinutes validate in one place", async () => {
    const { resolveAnchorGrams, resolveAnchorMinutes } = await import(
      "@/shared/types/estimation"
    );
    expect(resolveAnchorGrams({ fileName: "a.gcode", grams: 5 })).toBe(5);
    expect(resolveAnchorGrams({ fileName: "a.gcode", grams: 0 })).toBeUndefined();
    expect(resolveAnchorGrams(null)).toBeUndefined();
    expect(
      resolveAnchorMinutes({ fileName: "a.gcode", grams: 5, minutes: 42 }),
    ).toBe(42);
    expect(
      resolveAnchorMinutes({ fileName: "a.gcode", grams: 5, minutes: 0 }),
    ).toBeUndefined();
    expect(resolveAnchorMinutes(null)).toBeUndefined();
  });

  it("display consumes anchor validators (no inline duplication)", async () => {
    const { resolveDisplayEstimate } = await import(
      "@/shared/components/StlPreview/estimationDisplay"
    );
    const d = resolveDisplayEstimate({
      weight: 10,
      minutes: 60,
      hours: 1,
      mode: "advanced",
      calibrationK: 1,
      anchor: { fileName: "a.gcode", grams: 0, minutes: 0 },
      fixedMinutes: 0,
    });
    expect(d.weightFromGcode).toBe(false);
    expect(d.timeFromGcode).toBe(false);
  });
});

describe("gcode dedup — hours rounding 1 decimal (H1)", () => {
  it("display scaled hours use 1 decimal like the estimator", async () => {
    const { resolveDisplayEstimate } = await import(
      "@/shared/components/StlPreview/estimationDisplay"
    );
    const d = resolveDisplayEstimate({
      weight: 10,
      minutes: 60,
      hours: 1,
      mode: "advanced",
      calibrationK: 1,
      anchor: null,
      fixedMinutes: 15,
    });
    // 75 min -> 1.25h -> 1 decimal = 1.3h
    expect(d.hours).toBeCloseTo(1.3, 5);
  });
});

describe("gcode dedup — single-source upload cap (C1)", () => {
  it("exports DEFAULT_MAX_CHARS = 50MB", async () => {
    const { DEFAULT_MAX_CHARS } = await import("../gcodeTotals");
    expect(DEFAULT_MAX_CHARS).toBe(50 * 1024 * 1024);
  });
});
