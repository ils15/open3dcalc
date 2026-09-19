import { describe, it, expect } from "vitest";
import {
  effectiveTareGrams,
  remainingNetGrams,
  metersFromGrams,
  remainingMeters,
  coversPrint,
} from "@/shared/lib/filamentRemaining";
import type { FilamentSpoolLike } from "@/shared/lib/filamentRemaining";

function spool(over: Partial<FilamentSpoolLike> = {}): FilamentSpoolLike {
  return {
    brand: "Bambu Lab",
    material: "PLA",
    weightGrams: 1000,
    diameterMm: 1.75,
    ...over,
  };
}

describe("effectiveTareGrams", () => {
  it("uses the brand table when there is no override", () => {
    expect(effectiveTareGrams(spool())).toBe(210);
    expect(effectiveTareGrams(spool({ brand: "Prusament" }))).toBe(194);
  });

  it("lets a per-spool override beat the brand table", () => {
    expect(effectiveTareGrams(spool(), 250)).toBe(250);
    expect(effectiveTareGrams(spool({ brand: "Anycubic" }), 250)).toBe(250);
  });

  it("honours an explicit zero override", () => {
    expect(effectiveTareGrams(spool(), 0)).toBe(0);
  });

  it("falls back to the brand table for a non-finite override", () => {
    expect(effectiveTareGrams(spool(), Number.NaN)).toBe(210);
    expect(effectiveTareGrams(spool(), Number.POSITIVE_INFINITY)).toBe(210);
    expect(effectiveTareGrams(spool(), undefined)).toBe(210);
  });

  it("returns 0 for an unknown brand without override", () => {
    expect(effectiveTareGrams(spool({ brand: "Creality" }))).toBe(0);
    expect(effectiveTareGrams(spool({ brand: undefined }))).toBe(0);
  });
});

describe("remainingNetGrams", () => {
  it("subtracts the tare from the CURRENT weight", () => {
    expect(remainingNetGrams(spool())).toBe(790); // 1000 - 210 (Bambu)
    expect(remainingNetGrams(spool({ brand: "Prusament" }))).toBe(806);
  });

  it("uses the override when provided", () => {
    expect(remainingNetGrams(spool(), 300)).toBe(700);
  });

  it("is the full current weight when the brand is unknown", () => {
    expect(remainingNetGrams(spool({ brand: "Creality" }))).toBe(1000);
  });

  it("clamps to 0 when the tare exceeds the current weight", () => {
    expect(remainingNetGrams(spool({ weightGrams: 50 }))).toBe(0); // 50 - 210
    expect(remainingNetGrams(spool({ weightGrams: 210 }))).toBe(0);
    expect(remainingNetGrams(spool({ weightGrams: 211 }))).toBe(1);
  });

  it("treats a non-finite current weight as 0", () => {
    expect(remainingNetGrams(spool({ weightGrams: Number.NaN }))).toBe(0);
    expect(
      remainingNetGrams(spool({ weightGrams: Number.POSITIVE_INFINITY })),
    ).toBe(0);
  });
});

describe("metersFromGrams", () => {
  // Referência: 1 kg de PLA 1.75 mm -> ~335.3 m. Área da seção:
  // pi * (1.75/20)^2 = pi * 0.0875^2 = 0.024053 cm^2. Valores calculados
  // independentemente (node) e hard-coded para detectar regressão na fórmula.
  it.each([
    [1000, 1.24, 1.75, 335.2836], // PLA 1 kg, 1.75 mm — referência
    [1000, 1.27, 1.75, 327.3635], // PETG 1 kg
    [1000, 1.04, 1.75, 399.7612], // ABS 1 kg
    [1000, 1.24, 2.85, 126.415], // PLA 1 kg, 2.85 mm
    [750, 1.24, 1.75, 251.4627], // PLA 750 g
  ])(
    "%i g a %g g/cm3 e %g mm -> %f m",
    (grams, density, diameter, expected) => {
      expect(metersFromGrams(grams, density, diameter)).toBeCloseTo(
        expected,
        3,
      );
    },
  );

  it("matches the 1 kg PLA 1.75 mm reference (~335 m)", () => {
    const meters = metersFromGrams(1000, 1.24, 1.75);
    expect(meters).toBeGreaterThan(335);
    expect(meters).toBeLessThan(336);
  });

  it("scales linearly with the mass", () => {
    const base = metersFromGrams(500, 1.24, 1.75);
    expect(metersFromGrams(1000, 1.24, 1.75)).toBeCloseTo(base * 2, 3);
  });

  it.each([
    ["zero grams", 0, 1.24, 1.75],
    ["negative grams", -100, 1.24, 1.75],
    ["NaN grams", Number.NaN, 1.24, 1.75],
    ["zero density", 1000, 0, 1.75],
    ["negative density", 1000, -1.24, 1.75],
    ["NaN density", 1000, Number.NaN, 1.75],
    ["zero diameter", 1000, 1.24, 0],
    ["negative diameter", 1000, 1.24, -1.75],
    ["NaN diameter", 1000, 1.24, Number.NaN],
  ])("returns 0 for invalid input (%s)", (_label, grams, density, diameter) => {
    expect(metersFromGrams(grams, density, diameter)).toBe(0);
  });
});

describe("remainingMeters", () => {
  it("converts the net weight of a spool to meters", () => {
    // 1000 g Bambu -> 790 g líquidos de PLA 1.75 mm
    expect(remainingMeters(spool())).toBeCloseTo(264.8741, 3);
  });

  it("is the full spool when the brand has no known tare", () => {
    expect(remainingMeters(spool({ brand: "Creality" }))).toBeCloseTo(
      335.2836,
      3,
    );
  });

  it("respects a per-spool tare override", () => {
    expect(remainingMeters(spool(), 300)).toBeCloseTo(
      metersFromGrams(700, 1.24, 1.75),
      6,
    );
  });

  it("defaults the diameter to 1.75 mm when absent", () => {
    expect(remainingMeters(spool({ diameterMm: undefined }))).toBeCloseTo(
      264.8741,
      3,
    );
  });

  it("defaults the diameter to 1.75 mm when it is invalid", () => {
    expect(remainingMeters(spool({ diameterMm: 0 }))).toBeCloseTo(264.8741, 3);
    expect(remainingMeters(spool({ diameterMm: -1.75 }))).toBeCloseTo(
      264.8741,
      3,
    );
    expect(remainingMeters(spool({ diameterMm: Number.NaN }))).toBeCloseTo(
      264.8741,
      3,
    );
  });

  it("resolves the density from the spool material", () => {
    // 1000 g Bambu -> 790 g líquidos; só a densidade muda entre os casos
    expect(remainingMeters(spool({ material: "PETG" }))).toBeCloseTo(
      258.6172,
      3,
    );
    expect(remainingMeters(spool({ material: "ABS" }))).toBeCloseTo(
      315.8114,
      3,
    );
  });

  it("falls back to the PLA density for an unknown material", () => {
    expect(remainingMeters(spool({ material: "AlgumaCoisa" }))).toBeCloseTo(
      264.8741,
      3,
    );
  });

  it("is 0 for an empty spool", () => {
    expect(remainingMeters(spool({ weightGrams: 0 }))).toBe(0);
    expect(remainingMeters(spool({ weightGrams: 200 }))).toBe(0); // abaixo da tara
  });
});

describe("coversPrint", () => {
  it("covers exactly when the margin is zero", () => {
    const r = coversPrint(spool({ weightGrams: 310 }), 100); // 310-210=100
    expect(r.ok).toBe(true);
    expect(r.marginGrams).toBe(0);
    expect(r.remainingAfter).toBe(0);
  });

  it("covers with a positive margin", () => {
    const r = coversPrint(spool({ weightGrams: 330 }), 100); // líquido 120
    expect(r.ok).toBe(true);
    expect(r.marginGrams).toBe(20);
    expect(r.remainingAfter).toBe(20);
  });

  it("does not cover when the margin is negative", () => {
    const r = coversPrint(spool({ weightGrams: 290 }), 100); // líquido 80
    expect(r.ok).toBe(false);
    expect(r.marginGrams).toBe(-20);
    expect(r.remainingAfter).toBe(0);
  });

  it("covers a print that needs nothing", () => {
    const r = coversPrint(spool(), 0);
    expect(r.ok).toBe(true);
    expect(r.marginGrams).toBe(790);
    expect(r.remainingAfter).toBe(790);
  });

  it("treats a non-positive/invalid requirement as zero", () => {
    expect(coversPrint(spool(), -50).ok).toBe(true);
    expect(coversPrint(spool(), Number.NaN).ok).toBe(true);
  });

  it("accounts for a per-spool tare override", () => {
    const r = coversPrint(spool(), 800, 100); // 1000-100=900 líquidos
    expect(r.ok).toBe(true);
    expect(r.marginGrams).toBe(100);
  });
});
