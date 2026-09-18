import { describe, it, expect } from "vitest";

import {
  estimatePrintTime,
  estimatePrintTimeFromFilamentMm,
} from "../printTimeEstimator";
import { filamentWeightGrams, parseGcodeTotals } from "../gcodeTotals";
import { DEFAULT_FILAMENT_DIAMETER_MM } from "../filamentDefaults";

/**
 * D-EA2 (GA-2): o diâmetro do filamento deixa de ser um literal inline
 * (`1.75 / 2`) e passa a ser um parâmetro do estimador alimentado pela store.
 *
 * Modelo (docs/estimators-model.md):
 * - Peso (âncora E→g): g = π (d/2)² L ρ → g ∝ d².
 * - `filamentLengthMm` (report. de tempo): L = V / (π (d/2)²) → L ∝ 1/d².
 * - O TEMPO em si não depende do diâmetro (depende do volume depositado e da
 *   seção da fita layerH×lineW); o diâmetro só afeta o comprimento reportado.
 */

// G-code absoluto (M82 default): E0 → E500 → E1000 ⇒ soma de deltas = 1000 mm.
const GCODE_ABS = [
  ";FLAVOR:Marlin",
  "G1 X0 Y0 E0",
  "G1 X100 Y0 E500",
  "G1 X100 Y100 E1000",
].join("\n");

const TIME_PARAMS = {
  volumeCm3: 20,
  dimensions: { x: 20, y: 20, z: 20 },
  materialVolumeCm3: 8,
  layerHeightMm: 0.2,
  lineWidthMm: 0.42,
  printSpeedMmPerS: 60,
} as const;

describe("printTimeEstimator — filamentDiameterMm (D-EA2)", () => {
  // ── Backward-compat: default = literal 1.75 pré-D-EA2 ───────────

  it("default do diâmetro é a constante single-source (1.75)", () => {
    expect(DEFAULT_FILAMENT_DIAMETER_MM).toBe(1.75);
  });

  it("com default, filamentLengthMm é byte-identical à fórmula inline 1.75/2", () => {
    const est = estimatePrintTime({ ...TIME_PARAMS });
    // Fórmula pré-D-EA2 (printTimeEstimator.ts:165): radius = 1.75 / 2.
    const volumeMm3 = TIME_PARAMS.materialVolumeCm3 * 1000;
    const legacyRadiusMm = 1.75 / 2;
    const legacyLengthMm = Math.round(
      volumeMm3 / (Math.PI * legacyRadiusMm * legacyRadiusMm),
    );

    expect(est.filamentLengthMm).toBe(legacyLengthMm);
    expect(Number.isFinite(est.filamentLengthMm)).toBe(true);
  });

  it("sem filamentDiameterMm explícito = mesma saída que com o default", () => {
    const implicit = estimatePrintTime({ ...TIME_PARAMS });
    const explicit = estimatePrintTime({
      ...TIME_PARAMS,
      filamentDiameterMm: DEFAULT_FILAMENT_DIAMETER_MM,
    });

    expect(explicit).toEqual(implicit);
  });

  // ── Sensibilidade: (d1/d2)² ─────────────────────────────────────

  it("1.75 → 1.70 muda filamentLengthMm na razão (1.75/1.70)² (aumenta)", () => {
    const base = estimatePrintTime({ ...TIME_PARAMS });
    const thinner = estimatePrintTime({
      ...TIME_PARAMS,
      filamentDiameterMm: 1.7,
    });

    // Volume fixo: comprimento ∝ 1/d². Diâmetro menor ⇒ mais comprimento.
    expect(thinner.filamentLengthMm).toBeGreaterThan(base.filamentLengthMm);

    const ratio = thinner.filamentLengthMm / base.filamentLengthMm;
    const expected = (1.75 / 1.7) ** 2;
    // Ambos os lados são arredondados (Math.round); tolerância relativa frouxa.
    expect(ratio).toBeCloseTo(expected, 2);
  });

  it("diâmetro NÃO afeta o tempo estimado (só o comprimento reportado)", () => {
    const base = estimatePrintTime({ ...TIME_PARAMS });
    const thinner = estimatePrintTime({
      ...TIME_PARAMS,
      filamentDiameterMm: 1.7,
    });

    // O tempo depende do volume depositado e da seção da fita — não do
    // diâmetro do filamento. Mudar o diâmetro não promete um tempo diferente.
    expect(thinner.estimatedMinutes).toBe(base.estimatedMinutes);
    expect(thinner.estimatedHours).toBe(base.estimatedHours);
  });

  it("estimatePrintTimeFromFilamentMm respeita o diâmetro (volume ∝ d²)", () => {
    const base = estimatePrintTimeFromFilamentMm(1000);
    const thinner = estimatePrintTimeFromFilamentMm(1000, {
      filamentDiameterMm: 1.7,
    });

    expect(base).toBeDefined();
    expect(thinner).toBeDefined();
    // Mesmo comprimento (1000 mm): filamento mais fino carrega menos volume
    // (V = π r² L) ⇒ menos plástico depositado ⇒ menos tempo.
    expect(thinner as number).toBeLessThan(base as number);
  });

  it("estimatePrintTimeFromFilamentMm com default = fórmula 1.75", () => {
    const minutes = estimatePrintTimeFromFilamentMm(1000);
    expect(minutes).toBeDefined();
    // Volume esperado com o diâmetro default (constante single-source).
    const radiusMm = DEFAULT_FILAMENT_DIAMETER_MM / 2;
    const volumeMm3 = Math.PI * radiusMm * radiusMm * 1000;
    const crossSection = 0.2 * 0.42;
    const speed = 60;
    const dist = volumeMm3 / crossSection;
    const totalSeconds = dist / speed + (dist * 0.25) / 150; // print + travel (25% @ 150 mm/s)
    expect(minutes).toBe(Math.round(totalSeconds / 60));
  });

  // ── Guards: diâmetro inválido nunca vira NaN ─────────────────────

  it.each([0, -1.75, NaN, Infinity])(
    "diâmetro inválido (%s) → zeros explícitos, nunca NaN",
    (bad) => {
      const est = estimatePrintTime({
        ...TIME_PARAMS,
        filamentDiameterMm: bad,
      });
      expect(Number.isFinite(est.filamentLengthMm)).toBe(true);
      expect(est.filamentLengthMm).toBe(0);
      expect(Number.isFinite(est.estimatedMinutes)).toBe(true);
    },
  );

  it("estimatePrintTimeFromFilamentMm com diâmetro inválido → undefined", () => {
    expect(
      estimatePrintTimeFromFilamentMm(1000, { filamentDiameterMm: 0 }),
    ).toBeUndefined();
    expect(
      estimatePrintTimeFromFilamentMm(1000, { filamentDiameterMm: NaN }),
    ).toBeUndefined();
  });
});

describe("gcodeTotals — âncora E→gramas com diâmetro (D-EA2)", () => {
  it("peso default é byte-identical a filamentWeightGrams(L, 1.75)", () => {
    const totals = parseGcodeTotals(GCODE_ABS);
    expect(totals.extrudedMm).toBeGreaterThan(0);

    // A âncora usa exatamente a fórmula single-source com o diâmetro default.
    expect(totals.extrudedGrams).toBe(
      filamentWeightGrams(totals.extrudedMm, 1.75, 1.24),
    );
  });

  it("1.75 → 1.70 muda o peso na razão (1.70/1.75)² (diminui)", () => {
    const base = parseGcodeTotals(GCODE_ABS);
    const thinner = parseGcodeTotals(GCODE_ABS, { filamentDiameterMm: 1.7 });

    expect(thinner.extrudedMm).toBe(base.extrudedMm);
    expect(thinner.extrudedGrams).toBeLessThan(base.extrudedGrams);

    const ratio = thinner.extrudedGrams / base.extrudedGrams;
    const expected = (1.7 / 1.75) ** 2;
    expect(ratio).toBeCloseTo(expected, 2);
  });

  it("filamentWeightGrams: razão (d1/d2)² exata, sem depender do comprimento", () => {
    const d1 = 1.75;
    const d2 = 1.7;
    const g1 = filamentWeightGrams(1234.5, d1);
    const g2 = filamentWeightGrams(1234.5, d2);
    expect(g2 / g1).toBeCloseTo((d2 / d1) ** 2, 6);
  });
});
