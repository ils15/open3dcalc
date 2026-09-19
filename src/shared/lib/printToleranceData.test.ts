import { describe, it, expect } from "vitest";
import {
  MATERIAL_COMPENSATION,
  DIAMETER_COMPENSATION,
  INSERT_HOLES,
  CLEARANCE_HOLES,
  BEARING_CATALOG,
  FIT_OFFSETS,
  PRINT_TOLERANCE_SOURCE_NOTE,
  type MaterialCompensationEntry,
  type DiameterCompensationEntry,
  type InsertHoleEntry,
  type ClearanceHoleEntry,
  type BearingEntry,
  type FitOffsetEntry,
} from "@/shared/lib/printToleranceData";

describe("PRINT_TOLERANCE_SOURCE_NOTE", () => {
  it("documents the benchmark provenance and warns about a test print", () => {
    expect(typeof PRINT_TOLERANCE_SOURCE_NOTE).toBe("string");
    expect(PRINT_TOLERANCE_SOURCE_NOTE.trim().length).toBeGreaterThan(20);
    expect(PRINT_TOLERANCE_SOURCE_NOTE.toLowerCase()).toContain("teste");
    expect(PRINT_TOLERANCE_SOURCE_NOTE).toMatch(/set|2026/i);
  });
});

describe("MATERIAL_COMPENSATION", () => {
  it("covers PLA, PETG and ABS with a low/high band", () => {
    const byName = new Map(
      MATERIAL_COMPENSATION.map((e) => [e.material, e] satisfies [string, MaterialCompensationEntry]),
    );
    const pla = byName.get("pla");
    const petg = byName.get("petg");
    const abs = byName.get("abs");
    expect(pla).toEqual({ material: "pla", low: 0.1, high: 0.3 });
    expect(petg).toEqual({ material: "petg", low: 0.15, high: 0.3 });
    expect(abs).toEqual({ material: "abs", low: 0.2, high: 0.35 });
  });

  it("is a static leaf: every band is finite, positive and well-ordered", () => {
    expect(MATERIAL_COMPENSATION.length).toBeGreaterThan(0);
    for (const entry of MATERIAL_COMPENSATION) {
      expect(Number.isFinite(entry.low)).toBe(true);
      expect(Number.isFinite(entry.high)).toBe(true);
      expect(entry.low).toBeGreaterThan(0);
      expect(entry.high).toBeGreaterThan(entry.low);
    }
  });
});

describe("DIAMETER_COMPENSATION", () => {
  it("maps the three reference diameters from the benchmark", () => {
    const byDiameter = new Map(
      DIAMETER_COMPENSATION.map((e) => [e.diameter, e.compensation] satisfies [number, number]),
    );
    expect(byDiameter.get(3)).toBeCloseTo(0.27, 6);
    expect(byDiameter.get(5)).toBeCloseTo(0.24, 6);
    expect(byDiameter.get(10)).toBeCloseTo(0.18, 6);
  });

  it("is sorted ascending by diameter so interpolation is well-defined", () => {
    expect(DIAMETER_COMPENSATION.length).toBeGreaterThan(1);
    for (let i = 1; i < DIAMETER_COMPENSATION.length; i++) {
      expect(DIAMETER_COMPENSATION[i].diameter).toBeGreaterThan(
        DIAMETER_COMPENSATION[i - 1].diameter,
      );
      // smaller diameters take an absolutely larger compensation
      expect(DIAMETER_COMPENSATION[i - 1].compensation).toBeGreaterThan(
        DIAMETER_COMPENSATION[i].compensation,
      );
    }
  });

  it("holds only finite positive values", () => {
    for (const entry of DIAMETER_COMPENSATION satisfies readonly DiameterCompensationEntry[]) {
      expect(Number.isFinite(entry.diameter)).toBe(true);
      expect(entry.diameter).toBeGreaterThan(0);
      expect(Number.isFinite(entry.compensation)).toBe(true);
      expect(entry.compensation).toBeGreaterThan(0);
    }
  });
});

describe("INSERT_HOLES", () => {
  it("recommends a hole for every threaded insert size", () => {
    const bySize = new Map(
      INSERT_HOLES.map((e) => [e.size, e.hole] satisfies [string, number]),
    );
    expect(bySize.get("M2")).toBeCloseTo(3.0, 6);
    expect(bySize.get("M3")).toBeCloseTo(4.2, 6);
    expect(bySize.get("M4")).toBeCloseTo(5.2, 6);
    expect(bySize.get("M5")).toBeCloseTo(6.3, 6);
    expect(bySize.get("M6")).toBeCloseTo(7.3, 6);
    expect(bySize.get("M8")).toBeCloseTo(9.3, 6);
  });

  it("is a static leaf with finite positive holes", () => {
    expect(INSERT_HOLES.length).toBeGreaterThan(0);
    for (const entry of INSERT_HOLES satisfies readonly InsertHoleEntry[]) {
      expect(Number.isFinite(entry.hole)).toBe(true);
      expect(entry.hole).toBeGreaterThan(0);
    }
  });
});

describe("CLEARANCE_HOLES", () => {
  it("follows ISO 273 fine/medium/coarse for M3-M6", () => {
    const bySize = new Map(
      CLEARANCE_HOLES.map((e) => [e.size, e] satisfies [string, ClearanceHoleEntry]),
    );
    expect(bySize.get("M3")).toEqual({ size: "M3", fine: 3.2, medium: 3.4, coarse: 3.6 });
    expect(bySize.get("M4")).toEqual({ size: "M4", fine: 4.3, medium: 4.5, coarse: 4.8 });
    expect(bySize.get("M5")).toEqual({ size: "M5", fine: 5.3, medium: 5.5, coarse: 5.8 });
    expect(bySize.get("M6")).toEqual({ size: "M6", fine: 6.4, medium: 6.6, coarse: 7.0 });
  });

  it("keeps fine < medium < coarse for every size", () => {
    for (const entry of CLEARANCE_HOLES) {
      expect(entry.fine).toBeLessThan(entry.medium);
      expect(entry.medium).toBeLessThan(entry.coarse);
    }
  });
});

describe("BEARING_CATALOG", () => {
  it("maps the 608 reference bearing to a press-fit hole", () => {
    const byCode = new Map(
      BEARING_CATALOG.map((e) => [e.code, e] satisfies [string, BearingEntry]),
    );
    expect(byCode.get("608")).toEqual({ code: "608", od: 22, hole: 21.9 });
  });

  it("covers the benchmark bearing set", () => {
    const codes = new Set(BEARING_CATALOG.map((e) => e.code));
    for (const code of ["604", "605", "606", "608", "6201"]) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("is a static leaf with finite positive dimensions", () => {
    expect(BEARING_CATALOG.length).toBeGreaterThan(0);
    for (const entry of BEARING_CATALOG satisfies readonly BearingEntry[]) {
      expect(Number.isFinite(entry.od)).toBe(true);
      expect(entry.od).toBeGreaterThan(0);
      expect(Number.isFinite(entry.hole)).toBe(true);
      expect(entry.hole).toBeGreaterThan(0);
      // press-fit hole is always slightly under the outer diameter
      expect(entry.hole).toBeLessThan(entry.od);
    }
  });
});

describe("FIT_OFFSETS", () => {
  it("offsets every fit class from the benchmark", () => {
    const byFit = new Map(
      FIT_OFFSETS.map((e) => [e.fit, e.offset] satisfies [string, number]),
    );
    expect(byFit.get("press")).toBeCloseTo(-0.1, 6);
    expect(byFit.get("snug")).toBeCloseTo(0.05, 6);
    expect(byFit.get("sliding")).toBeCloseTo(0.15, 6);
    expect(byFit.get("never-bind")).toBeCloseTo(0.35, 6);
  });

  it("is a static leaf with finite offsets", () => {
    expect(FIT_OFFSETS.length).toBeGreaterThan(0);
    for (const entry of FIT_OFFSETS satisfies readonly FitOffsetEntry[]) {
      expect(Number.isFinite(entry.offset)).toBe(true);
    }
  });

  it("is ordered from the tightest to the loosest fit", () => {
    for (let i = 1; i < FIT_OFFSETS.length; i++) {
      expect(FIT_OFFSETS[i].offset).toBeGreaterThan(FIT_OFFSETS[i - 1].offset);
    }
  });
});
