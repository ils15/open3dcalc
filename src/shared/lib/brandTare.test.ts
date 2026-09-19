import { describe, it, expect } from "vitest";
import {
  BRAND_TARE_GRAMS,
  BRAND_TARE_SOURCE_NOTE,
  lookupBrandTare,
} from "@/shared/lib/brandTare";

describe("BRAND_TARE_GRAMS", () => {
  it("covers the four reference brands from the benchmark", () => {
    const byName = new Map(BRAND_TARE_GRAMS.map((e) => [e.brand, e.tareGrams]));
    expect(byName.get("Bambu Lab")).toBe(210);
    expect(byName.get("Prusament")).toBe(194);
    expect(byName.get("Polymaker")).toBe(140);
    expect(byName.get("Anycubic")).toBe(127);
  });

  it("is a static leaf: every entry has a positive finite tare", () => {
    expect(BRAND_TARE_GRAMS.length).toBeGreaterThan(0);
    for (const entry of BRAND_TARE_GRAMS) {
      expect(Number.isFinite(entry.tareGrams)).toBe(true);
      expect(entry.tareGrams).toBeGreaterThan(0);
      expect(entry.brand.trim()).toBe(entry.brand);
    }
  });
});

describe("BRAND_TARE_SOURCE_NOTE", () => {
  it("documents where the tare values came from", () => {
    expect(typeof BRAND_TARE_SOURCE_NOTE).toBe("string");
    expect(BRAND_TARE_SOURCE_NOTE.trim().length).toBeGreaterThan(20);
  });
});

describe("lookupBrandTare", () => {
  it.each([
    ["Bambu Lab", 210],
    ["Prusament", 194],
    ["Polymaker", 140],
    ["Anycubic", 127],
  ])("resolves an exact brand name: %s", (brand, expected) => {
    expect(lookupBrandTare(brand)).toBe(expected);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(lookupBrandTare("  bambu lab  ")).toBe(210);
    expect(lookupBrandTare("PRUSAMENT")).toBe(194);
    expect(lookupBrandTare("\tpolymaker\n")).toBe(140);
  });

  it("collapses internal whitespace before matching", () => {
    expect(lookupBrandTare("Bambu     Lab")).toBe(210);
  });

  it("matches partially when the spool name carries extra info", () => {
    expect(lookupBrandTare("Bambu Lab X1C 3kg spool")).toBe(210);
    expect(lookupBrandTare("Prusament PLA Galaxy Silver")).toBe(194);
  });

  it("matches a shortened brand name defensively", () => {
    expect(lookupBrandTare("Bambu")).toBe(210);
    expect(lookupBrandTare("anycubic")).toBe(127);
  });

  it("returns 0 for unknown brands", () => {
    expect(lookupBrandTare("Creality")).toBe(0);
    expect(lookupBrandTare("Generic PLA")).toBe(0);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("returns 0 for absent brand (%s)", (_label, brand) => {
    expect(lookupBrandTare(brand as string | undefined)).toBe(0);
  });
});
