import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateSupportVolume } from "../stlParser";
import type { Triangle } from "../stlParser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("stlParser dynamic imports", () => {
  it("should NOT have static imports of STLLoader or OBJLoader", () => {
    const sourcePath = resolve(__dirname, "../stlParser.ts");
    const source = readFileSync(sourcePath, "utf-8");

    // Should NOT have top-level static import statements for three/addons loaders
    const staticImportPattern =
      /^import\s+.*from\s+['"]three\/addons\/loaders\//;
    const lines = source.split("\n");
    const staticImports = lines.filter((line: string) =>
      staticImportPattern.test(line.trim()),
    );

    expect(staticImports).toHaveLength(0);
  });

  it("should use dynamic import() for STLLoader", () => {
    const sourcePath = resolve(__dirname, "../stlParser.ts");
    const source = readFileSync(sourcePath, "utf-8");

    // Should contain dynamic import for STLLoader
    expect(source).toMatch(
      /await\s+import\s*\(\s*['"]three\/addons\/loaders\/STLLoader/,
    );
  });

  it("should use dynamic import() for OBJLoader", () => {
    const sourcePath = resolve(__dirname, "../stlParser.ts");
    const source = readFileSync(sourcePath, "utf-8");

    // Should contain dynamic import for OBJLoader
    expect(source).toMatch(
      /await\s+import\s*\(\s*['"]three\/addons\/loaders\/OBJLoader/,
    );
  });
});

describe("estimateSupportVolume", () => {
  // Downward-facing triangle in the XZ plane (y=0): normal (0,-1,0), area 50 mm²
  const downwardTriangle: Triangle = {
    a: [0, 0, 0],
    b: [10, 0, 0],
    c: [0, 0, 10],
  };

  // Upward-facing triangle in the XY plane (z=0): normal (0,0,1), not an overhang
  const upwardTriangle: Triangle = {
    a: [0, 0, 0],
    b: [10, 0, 0],
    c: [0, 10, 0],
  };

  it("counts downward-facing triangles (normal Y < -0.7) as overhangs", () => {
    const volume = estimateSupportVolume([downwardTriangle]);
    // 50 mm² * 0.2 mm layerHeight * 0.15 density = 1.5 mm³ = 0.0015 cm³
    expect(volume).toBeCloseTo(0.0015, 6);
  });

  it("ignores triangles that are not overhangs", () => {
    expect(estimateSupportVolume([upwardTriangle])).toBe(0);
  });

  it("returns 0 for an empty triangle list", () => {
    expect(estimateSupportVolume([])).toBe(0);
  });

  it("uses default layerHeight (0.2mm) and supportDensity (0.15)", () => {
    const volume = estimateSupportVolume([downwardTriangle]);
    const expected = (50 * 0.2 * 0.15) / 1000;
    expect(volume).toBeCloseTo(expected, 8);
  });

  it("respects custom layerHeight and supportDensity options", () => {
    const volume = estimateSupportVolume([downwardTriangle], {
      layerHeight: 0.05,
      supportDensity: 0.3,
    });
    // 50 mm² * 0.05 mm * 0.3 = 0.75 mm³ = 0.00075 cm³
    expect(volume).toBeCloseTo(0.00075, 8);
  });

  it("treats a 45° downward slope (normal Y ≈ -0.7071) as an overhang", () => {
    // Triangle tilted 45°: normal (0, -0.7071, 0.7071)
    const tilted: Triangle = {
      a: [0, 0, 0],
      b: [10, 0, 0],
      c: [0, 10, 10],
    };
    const volume = estimateSupportVolume([tilted]);
    expect(volume).toBeGreaterThan(0);
  });

  it("returns volume in cm³ (mm³ / 1000)", () => {
    const volume = estimateSupportVolume([downwardTriangle]);
    // 1.5 mm³ → 0.0015 cm³
    expect(volume).toBeLessThan(1);
    expect(volume).toBeCloseTo(0.0015, 6);
  });
});
