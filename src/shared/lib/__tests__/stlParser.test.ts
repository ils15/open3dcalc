import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimateMaterialVolumeCm3,
  estimateSupportVolume,
  estimateWeight,
} from "../stlParser";
import { estimatePrintTime } from "../printTimeEstimator";
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

describe("estimateMaterialVolumeCm3 — casca por área", () => {
  it("peça fina sai praticamente maciça, mesmo com infill baixo", () => {
    // Caso real medido: projeto de litofania do BambuStudio, 4 objetos.
    // Modelo 92,52 cm³ / 1134 cm² de área → espessura média 1,63 mm, menor
    // que as duas paredes de 0,42 mm de cada lado. O fatiador gastou 72,8 cm³
    // (79% do volume); a fórmula antiga previa 32%.
    // NOTA: re-medição pendente do merge do #72 (volume corrigido) — ver
    // docs/estimators-model.md. Este teste ancora o COMPORTAMENTO (saturação
    // no volume), não a medição exata, para sobreviver à re-medição.
    const v = estimateMaterialVolumeCm3(92.52, {
      infillPercent: 15,
      surfaceAreaMm2: 1134 * 100,
    });
    expect(v).toBeCloseTo(92.52, 2); // satura no volume da peça
  });

  it("peça grande e maciça fica perto do infill nominal", () => {
    // Cubo de 100 mm: 1000 cm³, 600 cm² de área. A casca é fração pequena,
    // então o resultado tem que se aproximar dos 15% de infill — a fórmula
    // antiga cravava 32% para qualquer geometria.
    // Conta nova: casca = 600 × 1,64/10 = 98,4; total = 98,4 + 901,6×0,15
    // = 233,64 (23,4% — dentro da faixa, com viés de superestimação
    // documentado como margem de preço).
    const v = estimateMaterialVolumeCm3(1000, {
      infillPercent: 15,
      surfaceAreaMm2: 600 * 100,
    });
    expect(v / 1000).toBeGreaterThan(0.15);
    expect(v / 1000).toBeLessThan(0.25);
  });

  it("sem área informada, mantém o modelo antigo", () => {
    expect(estimateMaterialVolumeCm3(100, { infillPercent: 20 })).toBeCloseTo(
      100 * 0.36,
      6,
    );
  });

  it("infillPercent NaN cai no default 20 (nunca NaN)", () => {
    // Math.max(0, NaN) = NaN — sem o guard, o volume vazava NaN.
    const nan = estimateMaterialVolumeCm3(100, { infillPercent: NaN });
    const def = estimateMaterialVolumeCm3(100, {});
    expect(nan).toBeCloseTo(def, 6);
    expect(nan).toBeCloseTo(100 * 0.36, 6);
    expect(Number.isFinite(nan)).toBe(true);
  });

  it("infill 100% nunca passa do volume da peça", () => {
    expect(
      estimateMaterialVolumeCm3(50, {
        infillPercent: 100,
        surfaceAreaMm2: 400 * 100,
      }),
    ).toBeCloseTo(50, 6);
  });

  it("deriva a casca de wallCount × lineWidthMm (sem 0,84 fixo)", () => {
    // Cubo de 100 mm, infill 0: só casca. Padrão (2×0,42 + topo/base
    // 8×0,2/2 = 1,64 mm) → 600×1,64/10 = 98,4 cm³.
    const def = estimateMaterialVolumeCm3(1000, {
      infillPercent: 0,
      surfaceAreaMm2: 600 * 100,
    });
    expect(def).toBeCloseTo(98.4, 1);
    // 5 paredes: (5×0,42 + 0,8) = 2,9 mm → 600×2,9/10 = 174 cm³.
    const thick = estimateMaterialVolumeCm3(1000, {
      infillPercent: 0,
      surfaceAreaMm2: 600 * 100,
      wallCount: 5,
    });
    expect(thick).toBeCloseTo(174, 1);
    expect(thick).toBeGreaterThan(def);
  });

  it("topo/base zerados afinam a casca", () => {
    const def = estimateMaterialVolumeCm3(1000, {
      infillPercent: 0,
      surfaceAreaMm2: 600 * 100,
    });
    const noTop = estimateMaterialVolumeCm3(1000, {
      infillPercent: 0,
      surfaceAreaMm2: 600 * 100,
      topLayers: 0,
      bottomLayers: 0,
    });
    // Só as paredes: 600×0,84/10 = 50,4 cm³.
    expect(noTop).toBeCloseTo(50.4, 1);
    expect(noTop).toBeLessThan(def);
  });

  it("shellThicknessMm explícito vence a derivação", () => {
    const v = estimateMaterialVolumeCm3(1000, {
      infillPercent: 0,
      surfaceAreaMm2: 600 * 100,
      shellThicknessMm: 2,
    });
    expect(v).toBeCloseTo(120, 6);
  });

  it("soma o suporte por cima (casca + núcleo × infill + suporte)", () => {
    const v = estimateMaterialVolumeCm3(100, {
      infillPercent: 0,
      supportVolumeCm3: 5,
    });
    expect(v).toBeCloseTo(100 * 0.2 + 5, 6);
  });

  it("guards: volume ≤ 0 ou NaN retorna 0", () => {
    expect(estimateMaterialVolumeCm3(0, { infillPercent: 20 })).toBe(0);
    expect(estimateMaterialVolumeCm3(-5, { infillPercent: 20 })).toBe(0);
    expect(estimateMaterialVolumeCm3(NaN, { infillPercent: 20 })).toBe(0);
  });
});

describe("estimateWeight — material + purga", () => {
  it("usa a densidade da tabela por família (PETG 1,27)", () => {
    // Legado sem área: 100 cm³ a 0% → 20 cm³ × 1,27 = 25,4 g.
    const w = estimateWeight(100, {
      infillPercent: 0,
      material: "petg",
    });
    expect(w).toBeCloseTo(25.4, 6);
  });

  it("densityGcm3 explícito vence a tabela", () => {
    const w = estimateWeight(100, {
      infillPercent: 0,
      material: "petg",
      densityGcm3: 2,
    });
    expect(w).toBeCloseTo(40, 6);
  });

  it("aplica a purga sobre o volume efetivo", () => {
    const w = estimateWeight(100, {
      infillPercent: 100,
      purgePercent: 10,
      densityGcm3: 1,
    });
    expect(w).toBeCloseTo(110, 6);
  });

  it("purgePercent NaN cai no default 0 (nunca NaN)", () => {
    const nan = estimateWeight(100, {
      infillPercent: 100,
      purgePercent: NaN,
      densityGcm3: 1,
    });
    const def = estimateWeight(100, {
      infillPercent: 100,
      densityGcm3: 1,
    });
    expect(nan).toBeCloseTo(def, 6);
    expect(nan).toBeCloseTo(100, 6);
    expect(Number.isFinite(nan)).toBe(true);
  });

  it("guards: volume ≤ 0 ou NaN retorna 0", () => {
    expect(estimateWeight(0, { densityGcm3: 1.24 })).toBe(0);
    expect(estimateWeight(NaN, { densityGcm3: 1.24 })).toBe(0);
  });
});

describe("estimatePrintTime — física da extrusão", () => {
  it("usa o caminho do BICO, não o comprimento de filamento", () => {
    // 72,78 cm³ de plástico, altura 90,2 mm, camada 0,2 mm, linha 0,42 mm,
    // 60 mm/s. Caminho = 72780 / (0,2 × 0,42) = 866.429 mm.
    // A impressão real levou 4h23m; o modelo antigo dava 0,5 h.
    const t = estimatePrintTime({
      volumeCm3: 92.52,
      materialVolumeCm3: 72.78,
      dimensions: { x: 405.7, y: 391.6, z: 90.2 },
      layerHeightMm: 0.2,
      printSpeedMmPerS: 60,
    });
    expect(t.estimatedHours).toBeGreaterThan(4);
    expect(t.estimatedHours).toBeLessThan(6);
  });
});
