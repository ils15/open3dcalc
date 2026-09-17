import { describe, it, expect } from "vitest";
import {
  estimatePrintTime,
  geometryTimeFactor,
  GEOMETRY_FACTOR,
  type PrintTimeParams,
} from "@/shared/lib/printTimeEstimator";

// D-EA3 — fator empírico de geometria (SA/V) no tempo.
//
// O estimador assume velocidade constante (sem accel/jerk). Peças pequenas/
// detalhadas têm muita mudança de direção e travel proporcionalmente maior →
// subestimação sistemática. O fator bornceado e clampado derivado da razão
// superfície/volume é o proxy de detalhe. Ver §7 de docs/estimators-model.md.

const cube = (sideMm: number, area: number): PrintTimeParams => ({
  volumeCm3: (sideMm * sideMm * sideMm) / 1000,
  dimensions: { x: sideMm, y: sideMm, z: sideMm },
  surfaceAreaMm2: area,
});

// Cubo de 10 mm: SA = 6 × 100 = 600 mm²; V = 1.000 mm³ = 1 cm³ → SA/V = 0,6.
const CUBE_10 = cube(10, 600);
// Cubo de 100 mm: SA = 60.000 mm²; V = 10⁶ mm³ = 1.000 cm³ → SA/V = 0,06.
const CUBE_100 = cube(100, 60_000);

describe("geometryTimeFactor — curva bornceada e clampada", () => {
  it("peças grandes/simples (SA/V baixo) são neutras (fator 1.0)", () => {
    // 100 mm: SA/V = 0,06 — bem abaixo do limiar inferior 0,2.
    expect(geometryTimeFactor(60_000, 1000)).toBe(1);
    // Exatamente no limiar inferior ainda é neutro (<= low).
    expect(geometryTimeFactor(200, 1)).toBe(1);
  });

  it("fator cresce linearmente entre os limiares (cubo 10 mm → 1,15)", () => {
    // SA/V = 0,6 → 1 + 0,3 × (0,6 − 0,2) / (1,0 − 0,2) = 1,15.
    expect(geometryTimeFactor(600, 1)).toBeCloseTo(1.15, 6);
  });

  it("satura no clamp para peças minúsculas/muito detalhadas", () => {
    // Cubo de 3 mm: SA/V = 54/27 = 2,0 — acima do limiar superior.
    expect(geometryTimeFactor(54, 0.027)).toBe(GEOMETRY_FACTOR.max);
    // Limiar superior exato já satura.
    expect(geometryTimeFactor(1000, 1)).toBe(GEOMETRY_FACTOR.max);
  });

  it("é monótono não-decrescente em SA/V", () => {
    const ratios = [0.05, 0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 5];
    const factors = ratios.map((r) => geometryTimeFactor(r, 1));
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThanOrEqual(factors[i - 1]);
    }
  });

  it("entrada ausente/NaN/zero/negativa → fator neutro 1.0, sem crash", () => {
    expect(geometryTimeFactor(undefined, 1)).toBe(1);
    expect(geometryTimeFactor(NaN, 1)).toBe(1);
    expect(geometryTimeFactor(0, 1)).toBe(1);
    expect(geometryTimeFactor(-600, 1)).toBe(1);
    expect(geometryTimeFactor(600, 0)).toBe(1);
    expect(geometryTimeFactor(600, NaN)).toBe(1);
    expect(geometryTimeFactor(600, -1)).toBe(1);
    // Volume quase zero com área grande → SA/V explodiria; clamp impede Infinity.
    expect(geometryTimeFactor(600, 0.0001)).toBe(GEOMETRY_FACTOR.max);
  });
});

describe("estimatePrintTime — fator de geometria aplicado ao movimento", () => {
  it("cubo 10 mm (SA/V alto): tempo cresce, respeitando o clamp", () => {
    // Sem fator: 5 min (318 s = 198 s extrusão + 20 s travel + 100 s camadas).
    const baseline = estimatePrintTime({
      ...CUBE_10,
      surfaceAreaMm2: undefined,
    });
    expect(baseline.estimatedMinutes).toBe(5);
    // Com fator 1,15 no termo movimento: (198 + 20) × 1,15 + 100 = 351 s → 6 min.
    const detailed = estimatePrintTime(CUBE_10);
    expect(detailed.estimatedMinutes).toBe(6);
    expect(detailed.estimatedMinutes).toBeGreaterThan(
      baseline.estimatedMinutes,
    );
    // Clamp no total: 6 <= 5 × 1,3 = 6,5 (envelope ±30%).
    expect(detailed.estimatedMinutes).toBeLessThanOrEqual(
      baseline.estimatedMinutes * GEOMETRY_FACTOR.max,
    );
  });

  it("bloco 100 mm (SA/V baixo): variação < 2% (byte-identical por design)", () => {
    const baseline = estimatePrintTime({
      ...CUBE_100,
      surfaceAreaMm2: undefined,
    });
    const simple = estimatePrintTime(CUBE_100);
    // Fator 1.0 exato → mesmo número de segundos → mesmo minuto arredondado.
    expect(simple.estimatedMinutes).toBe(baseline.estimatedMinutes);
    expect(simple.filamentLengthMm).toBe(baseline.filamentLengthMm);
    // Documenta o limite: geometria grande NÃO é afetada pelo fator (variação 0%).
    const variation =
      Math.abs(simple.estimatedMinutes - baseline.estimatedMinutes) /
      baseline.estimatedMinutes;
    expect(variation).toBeLessThan(0.02);
  });

  it("cilindro Ø20×20 (SA/V médio 0,3): dentro do envelope ±30%", () => {
    // SA = π·d·(h + d/2) = 1.884,96 mm²; V = π·d²·h/4 = 6.283,19 mm³.
    const params: PrintTimeParams = {
      volumeCm3: (Math.PI * 20 * 20 * 20) / 4 / 1000,
      dimensions: { x: 20, y: 20, z: 20 },
      surfaceAreaMm2: Math.PI * 20 * (20 + 10),
    };
    const baseline = estimatePrintTime({
      ...params,
      surfaceAreaMm2: undefined,
    });
    const factored = estimatePrintTime(params);
    // Fator 1,0375 no movimento: 26 → 27 min.
    expect(baseline.estimatedMinutes).toBe(26);
    expect(factored.estimatedMinutes).toBe(27);
    const ratio = factored.estimatedMinutes / baseline.estimatedMinutes;
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(GEOMETRY_FACTOR.max);
  });

  it("área NaN/zero → fator neutro, resultado idêntico ao sem-área", () => {
    const noArea = estimatePrintTime({ ...CUBE_10, surfaceAreaMm2: undefined });
    const nanArea = estimatePrintTime({ ...CUBE_10, surfaceAreaMm2: NaN });
    const zeroArea = estimatePrintTime({ ...CUBE_10, surfaceAreaMm2: 0 });
    expect(nanArea.estimatedMinutes).toBe(noArea.estimatedMinutes);
    expect(zeroArea.estimatedMinutes).toBe(noArea.estimatedMinutes);
    // Sem NaN em NENHUM campo de saída.
    for (const est of [nanArea, zeroArea]) {
      expect(Number.isFinite(est.estimatedMinutes)).toBe(true);
      expect(Number.isFinite(est.filamentLengthMm)).toBe(true);
      expect(Number.isFinite(est.travelDistanceMm)).toBe(true);
    }
  });

  it("volume zero com área: zeros explícitos, sem crash", () => {
    const est = estimatePrintTime({
      volumeCm3: 0,
      dimensions: { x: 10, y: 10, z: 10 },
      surfaceAreaMm2: 600,
    });
    expect(est.estimatedMinutes).toBe(0);
    expect(Number.isFinite(est.estimatedMinutes)).toBe(true);
  });

  it("âncora G-code (modo advanced) NÃO é escalada pelo fator de geometria", () => {
    // SA/V alto exigiria 6 min estimados, mas a âncora real (120 min) vence
    // intacta — o fator é da estimativa STL, não do dado de verdade do slicer.
    const anchored = estimatePrintTime({
      ...CUBE_10,
      mode: "advanced",
      gcodeMinutes: 120,
    });
    expect(anchored.estimatedMinutes).toBe(120);
    expect(anchored.confidence).toBe("high");
    // Sem área o resultado da âncora é o mesmo (fator não toca a âncora).
    const anchoredNoArea = estimatePrintTime({
      ...CUBE_10,
      surfaceAreaMm2: undefined,
      mode: "advanced",
      gcodeMinutes: 120,
    });
    expect(anchoredNoArea.estimatedMinutes).toBe(anchored.estimatedMinutes);
  });
});
