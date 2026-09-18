import { describe, it, expect } from "vitest";
import {
  estimatePrintTime,
  estimatePrintTimeFromFilamentMm,
} from "@/shared/lib/printTimeEstimator";

const DIMS = { x: 200, y: 200, z: 20 };

describe("estimatePrintTime — geometria inválida com âncora (advanced)", () => {
  it("a âncora gcodeMinutes vence mesmo com geometria inválida", () => {
    const result = estimatePrintTime({
      volumeCm3: 0,
      dimensions: DIMS,
      mode: "advanced",
      gcodeMinutes: 42,
    });
    // 42 min + fixed 0 = 42; camadas ainda são reportadas para debug.
    expect(result.estimatedMinutes).toBe(42);
    expect(result.estimatedHours).toBe(0.7);
    expect(result.layers).toBe(100);
    expect(result.confidence).toBe("high");
    expect(result.kind).toBe("rough_estimate");
    // Sem a âncora o caminho seria zeros explícitos.
    expect(
      estimatePrintTime({
        volumeCm3: 0,
        dimensions: DIMS,
        mode: "advanced",
      }).estimatedMinutes,
    ).toBe(0);
  });

  it("fixedMinutes é somado em cima da âncora", () => {
    const result = estimatePrintTime({
      volumeCm3: 0,
      dimensions: DIMS,
      mode: "advanced",
      gcodeMinutes: 42,
      fixedMinutes: 10,
    });
    expect(result.estimatedMinutes).toBe(52);
  });

  it("simple mode ignora a âncora (legacy byte-identical)", () => {
    const result = estimatePrintTime({
      volumeCm3: 0,
      dimensions: DIMS,
      mode: "simple",
      gcodeMinutes: 42,
    });
    expect(result.estimatedMinutes).toBe(0);
    expect(result.confidence).toBe("low");
  });
});

describe("estimatePrintTimeFromFilamentMm", () => {
  it("estima minutos a partir do comprimento de filamento", () => {
    const minutes = estimatePrintTimeFromFilamentMm(1000);
    expect(minutes).toBeGreaterThan(0);
    // 1000 mm de filamento 1,75 → ~2,4 cm³; o fallback não conta troca de
    // camada, então é mais rápido que o estimator com geometria.
    expect(minutes).toBeLessThan(10);
  });

  it("retorna undefined para comprimento inválido", () => {
    expect(estimatePrintTimeFromFilamentMm(0)).toBeUndefined();
    expect(estimatePrintTimeFromFilamentMm(-5)).toBeUndefined();
    expect(estimatePrintTimeFromFilamentMm(NaN)).toBeUndefined();
    expect(estimatePrintTimeFromFilamentMm(Infinity)).toBeUndefined();
  });

  it("retorna undefined para opções de velocidade/geometria inválidas", () => {
    expect(
      estimatePrintTimeFromFilamentMm(1000, { filamentDiameterMm: 0 }),
    ).toBeUndefined();
    expect(
      estimatePrintTimeFromFilamentMm(1000, { layerHeightMm: 0 }),
    ).toBeUndefined();
    expect(
      estimatePrintTimeFromFilamentMm(1000, { lineWidthMm: 0 }),
    ).toBeUndefined();
    expect(
      estimatePrintTimeFromFilamentMm(1000, { printSpeedMmPerS: 0 }),
    ).toBeUndefined();
    expect(
      estimatePrintTimeFromFilamentMm(1000, { travelSpeedMmPerS: 0 }),
    ).toBeUndefined();
  });

  it("clampa a velocidade no MVS do material (sem prometer o impossível)", () => {
    const fantasy = estimatePrintTimeFromFilamentMm(1000, {
      printSpeedMmPerS: 500,
      material: "pla",
    });
    // Fita 0,2 × 0,42 = 0,084 mm²; 500 mm/s exigiria 42 mm³/s (teto PLA 15).
    const cappedSpeed = 15 / (0.2 * 0.42);
    const capped = estimatePrintTimeFromFilamentMm(1000, {
      printSpeedMmPerS: cappedSpeed,
      material: "pla",
    });
    expect(fantasy).toBe(capped);
    const normal = estimatePrintTimeFromFilamentMm(1000, {
      printSpeedMmPerS: 60,
      material: "pla",
    });
    expect(fantasy).toBeLessThan(normal!);
  });

  it("travelRatio NaN cai no default 0,25 (nunca NaN)", () => {
    const nan = estimatePrintTimeFromFilamentMm(1000, { travelRatio: NaN });
    const def = estimatePrintTimeFromFilamentMm(1000);
    expect(nan).toBe(def);
  });

  it("overflow numérico (volume → Infinity) retorna undefined", () => {
    // 1e308 mm × π × r² estoura o double: o guard anti-!isFinite pega.
    expect(estimatePrintTimeFromFilamentMm(1e308)).toBeUndefined();
  });
});
