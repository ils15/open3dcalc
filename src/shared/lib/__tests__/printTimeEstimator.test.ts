import { describe, it, expect } from "vitest";
import {
  estimatePrintTime,
  estimatePrintTimeFromDimensions,
} from "@/shared/lib/printTimeEstimator";

const DIMS = { x: 200, y: 200, z: 20 };

describe("estimatePrintTime", () => {
  it("uses default settings when no real settings are provided", () => {
    const result = estimatePrintTime({ volumeCm3: 100, dimensions: DIMS });

    // 20mm height / 0.2mm layer height = 100 layers
    expect(result.layers).toBe(100);
    // 100 cm³ de plástico numa fita de 0,2 × 0,42 mm = 1.190.476 mm de trilha;
    // a 60 mm/s dá 19.841 s, mais travel (1.984 s) e trocas de camada (200 s)
    // = 22.025 s = 367 min. Equivale a 5,04 mm³/s de vazão, que é realista.
    //
    // Este teste esperava 16 min até 2026-09-04, quando o estimador dividia o
    // comprimento de FILAMENTO pela velocidade do BICO. Aqueles 16 min exigiam
    // 104 mm³/s — cerca de 7× o que uma máquina FDM rápida entrega.
    //
    // O número NÃO mudou na migração para EstimateOptions (2026-09-05): o
    // modelo físico é o mesmo (Q nominal 5,04 < MVS PLA 15, sem clamp; travel
    // 0,25 a 150 mm/s). Só os nomes dos params mudaram.
    expect(result.estimatedMinutes).toBe(367);
    expect(result.estimatedHours).toBe(6.1);
    expect(result.confidence).toBe("medium");
    expect(result.kind).toBe("rough_estimate");
  });

  it("falls back to volumeCm3 when materialVolumeCm3 is absent", () => {
    // Caminho do fallback COM teste dedicado: sem volume extrudado, o
    // filamento e o tempo derivam do volume maciço (superestima peça oca).
    const fallback = estimatePrintTime({ volumeCm3: 100, dimensions: DIMS });
    const explicit = estimatePrintTime({
      volumeCm3: 100,
      materialVolumeCm3: 100,
      dimensions: DIMS,
    });
    expect(fallback.filamentLengthMm).toBe(explicit.filamentLengthMm);
    expect(fallback.estimatedMinutes).toBe(explicit.estimatedMinutes);
    expect(fallback.filamentLengthMm).toBeGreaterThan(0);

    // Metade do plástico → metade do filamento (módulo arredondamento).
    const half = estimatePrintTime({
      volumeCm3: 100,
      materialVolumeCm3: 50,
      dimensions: DIMS,
    });
    expect(half.filamentLengthMm).toBe(
      Math.round(fallback.filamentLengthMm / 2),
    );
  });

  it("clamps extrusion speed to the material MVS", () => {
    // Fita 0,2 × 0,42 = 0,084 mm². Pedir 500 mm/s em PLA exigiria
    // Q ≈ 42 mm³/s — quase 3× o teto de 15. O clamp limita a
    // 15/0,084 ≈ 178,57 mm/s, então os dois têm que coincidir…
    const cappedSpeed = 15 / (0.2 * 0.42);
    const fantasy = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 500,
      material: "pla",
    });
    const capped = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: cappedSpeed,
      material: "pla",
    });
    expect(fantasy.estimatedMinutes).toBe(capped.estimatedMinutes);
    // …e continuar mais rápido que 60 mm/s (o clamp não congela, só teta).
    const normal = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 60,
      material: "pla",
    });
    expect(fantasy.estimatedMinutes).toBeLessThan(normal.estimatedMinutes);
  });

  it("PETG (MVS 12) is slower than PLA (MVS 15) at absurd speeds", () => {
    const pla = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 500,
      material: "pla",
    });
    const petg = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 500,
      material: "petg",
    });
    expect(petg.estimatedMinutes).toBeGreaterThan(pla.estimatedMinutes);
  });

  it("travelRatio moves travel distance and total time", () => {
    const none = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      travelRatio: 0,
    });
    expect(none.travelDistanceMm).toBe(0);

    const def = estimatePrintTime({ volumeCm3: 100, dimensions: DIMS });
    // Trilha 1.190.476 mm × 0,25 = 297.619 mm de travel.
    expect(def.travelDistanceMm).toBe(297619);

    const double = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      travelRatio: 0.5,
    });
    expect(double.travelDistanceMm).toBe(def.travelDistanceMm * 2);
    expect(double.estimatedMinutes).toBeGreaterThan(def.estimatedMinutes);
    expect(def.estimatedMinutes).toBeGreaterThan(none.estimatedMinutes);
  });

  it("travelRatio NaN cai no default 0,25 (nunca NaN)", () => {
    // Math.max(0, NaN) = NaN — sem o guard, travelDistanceMm vazava NaN.
    const nan = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      travelRatio: NaN,
    });
    const def = estimatePrintTime({ volumeCm3: 100, dimensions: DIMS });
    expect(nan.travelDistanceMm).toBe(def.travelDistanceMm);
    expect(nan.estimatedMinutes).toBe(def.estimatedMinutes);
    expect(Number.isFinite(nan.travelDistanceMm)).toBe(true);
  });

  it("returns zeros (never NaN) for invalid geometry", () => {
    for (const bad of [
      { volumeCm3: 0, dimensions: DIMS },
      { volumeCm3: -10, dimensions: DIMS },
      { volumeCm3: NaN, dimensions: DIMS },
      { volumeCm3: 100, dimensions: { x: 200, y: 200, z: 0 } },
    ]) {
      const result = estimatePrintTime(bad);
      expect(result.estimatedMinutes).toBe(0);
      expect(result.estimatedHours).toBe(0);
      expect(result.travelDistanceMm).toBe(0);
      expect(result.filamentLengthMm).toBe(0);
      expect(result.confidence).toBe("low");
      expect(result.kind).toBe("rough_estimate");
    }
    // Geometria vazia não cobra nem o overhead de troca de camada: antes
    // retornava 3 min fantasmas (100 camadas × 2 s) sobre volume zero.
  });

  it("returns high confidence when real printer settings are provided", () => {
    const result = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      layerHeightMm: 0.2,
      printSpeedMmPerS: 60,
      lineWidthMm: 0.42,
      material: "pla",
    });

    expect(result.confidence).toBe("high");
  });

  it("returns high confidence when only some real settings are provided", () => {
    const result = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      material: "petg",
    });

    expect(result.confidence).toBe("high");
  });

  it("returns low confidence when geometry is invalid", () => {
    const result = estimatePrintTime({ volumeCm3: 0, dimensions: DIMS });

    expect(result.confidence).toBe("low");
  });

  it("increases estimated time when print speed is slower", () => {
    const fast = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 60,
    });
    const slow = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 30,
    });

    expect(slow.estimatedMinutes).toBeGreaterThan(fast.estimatedMinutes);
  });

  it("increases layer count and time when layer height is smaller", () => {
    const coarse = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      layerHeightMm: 0.2,
    });
    const fine = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      layerHeightMm: 0.1,
    });

    expect(fine.layers).toBe(coarse.layers * 2);
    expect(fine.estimatedMinutes).toBeGreaterThan(coarse.estimatedMinutes);
  });

  it("keeps defaults for unspecified settings", () => {
    const result = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printSpeedMmPerS: 120,
    });

    // Same as default-case estimate but with double speed → fewer minutes
    expect(result.confidence).toBe("high");
    expect(result.layers).toBe(100);
  });
});

describe("estimatePrintTimeFromDimensions", () => {
  it("estimates volume from bounding box and forwards settings", () => {
    const result = estimatePrintTimeFromDimensions(100, 100, 10, {
      printSpeedMmPerS: 30,
    });

    // 100*100*10*0.4/1000 = 40 cm³ → valid geometry
    expect(result.confidence).toBe("high");
    expect(result.estimatedMinutes).toBeGreaterThan(0);
  });

  it("returns medium confidence without real settings", () => {
    const result = estimatePrintTimeFromDimensions(100, 100, 10);

    expect(result.confidence).toBe("medium");
  });
});
