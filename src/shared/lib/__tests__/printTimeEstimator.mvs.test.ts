import { describe, it, expect } from "vitest";

import {
  estimatePrintTime,
  estimatePrintTimeFromFilamentMm,
} from "../printTimeEstimator";
import { FILAMENT_PROFILES } from "../filamentProfiles";

/**
 * D-EA4: vazão volumétrica máxima (MVS) deixa de ser só a tabela conservadora
 * do material e passa a aceitar override manual (high-flow volcano/CHT dobra o
 * MVS real). O campo vive no slice `fdmFilament` e chega aqui como
 * `maxVolumetricSpeedMm3PerS`; ausente/inválido = tabela (byte-identical).
 *
 * Modelo (docs/estimators-model.md §7):
 * - fluxo nominal Q = seção da fita × velocidade = (layerH × lineW) × speed.
 * - Se Q > MVS, a velocidade é clamped para MVS/seção (o hotend não entrega mais).
 * - Logo: override só muda o tempo quando Q tabela-mvs < Q nominal — i.e.,
 *   quando o override é MENOR que o fluxo nominal (ou a tabela já engajava).
 */

// Seção da fita = 0.2 × 0.42 = 0.084 mm².
const CROSS_SECTION_MM2 = 0.2 * 0.42;
// Velocidade alta o suficiente para o fluxo nominal (12.6 mm³/s) ultrapassar o
// MVS de PETG (12) mas não o de PLA (15) — região onde o clamp é sensível ao
// material e ao override.
const FAST_PARAMS = {
  volumeCm3: 20,
  dimensions: { x: 20, y: 20, z: 20 },
  materialVolumeCm3: 8,
  layerHeightMm: 0.2,
  lineWidthMm: 0.42,
  printSpeedMmPerS: 150,
} as const;

const PLA_MVS = FILAMENT_PROFILES.pla.maxVolumetricSpeedMm3PerS; // 15

describe("printTimeEstimator — MVS override no clamp (D-EA4)", () => {
  // ── Backward-compat: sem override = tabela, byte-identical ─────────────

  it("sem override, PLA (15) não engaja o clamp @12.6 mm³/s", () => {
    const est = estimatePrintTime({ ...FAST_PARAMS, material: "pla" });
    expect(est.estimatedMinutes).toBeGreaterThan(0);
    // Sem clamp: a velocidade efetiva é a pedida (150), não a do teto.
    expect(PLA_MVS).toBeGreaterThan(CROSS_SECTION_MM2 * 150);
  });

  it("override igual ao MVS da tabela = byte-identical a sem override", () => {
    const noOverride = estimatePrintTime({ ...FAST_PARAMS, material: "pla" });
    const sameAsTable = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: PLA_MVS,
    });
    expect(sameAsTable).toEqual(noOverride);
  });

  it("override ACIMA do fluxo nominal (sem clamp) = byte-identical", () => {
    const noOverride = estimatePrintTime({ ...FAST_PARAMS, material: "pla" });
    const highFlow = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 100,
    });
    // High-flow não promete tempo menor que a física permite: a velocidade
    // pedida (150) já está abaixo do novo teto → sem clamp → inalterado.
    expect(highFlow).toEqual(noOverride);
  });

  it.each([NaN, Infinity, 0, -3])(
    "override inválido (%s) → fallback byte-identical à tabela",
    (bad) => {
      const base = estimatePrintTime({ ...FAST_PARAMS, material: "pla" });
      const invalid = estimatePrintTime({
        ...FAST_PARAMS,
        material: "pla",
        maxVolumetricSpeedMm3PerS: bad,
      });
      expect(invalid).toEqual(base);
    },
  );

  // ── Override vence a tabela ────────────────────────────────────────────

  it("override ABAIXO do fluxo nominal engaja o clamp e AUMENTA o tempo", () => {
    const base = estimatePrintTime({ ...FAST_PARAMS, material: "pla" });
    const clamped = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 11, // 11 < 12.6 nominal → clamp; a tabela (15) não engajaria
    });

    expect(clamped.estimatedMinutes).toBeGreaterThan(base.estimatedMinutes);

    // Magnitude: a velocidade de extrusão cai de 150 para 11/0.084 ≈ 130.95;
    // o termo de extrusão cresce na razão 150/130.95 ≈ 1.145 (travel e
    // overhead de camada diluem o efeito no total, então só checamos > 1).
    const ratio = clamped.estimatedMinutes / base.estimatedMinutes;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(150 / (11 / CROSS_SECTION_MM2));
  });

  it("override menor ⇒ tempo maior (monotônico no clamp)", () => {
    const higherMvs = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 12,
    });
    const lowerMvs = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 8,
    });
    expect(lowerMvs.estimatedMinutes).toBeGreaterThan(
      higherMvs.estimatedMinutes,
    );
  });

  it("override vence a tabela mesmo quando a tabela não engajaria", () => {
    // PETG tabela (12) engaja @12.6; PLA tabela (15) não. Override 11 engaja
    // ambos — provando que o override (não a tabela) determinou o clamp.
    const plaOverride = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 11,
    });
    const petgOverride = estimatePrintTime({
      ...FAST_PARAMS,
      material: "petg",
      maxVolumetricSpeedMm3PerS: 11,
    });
    expect(plaOverride.estimatedMinutes).toEqual(petgOverride.estimatedMinutes);
  });

  it("material em mixed-case não altera o tempo vs lowercase", () => {
    const lower = estimatePrintTime({ ...FAST_PARAMS, material: "petg" });
    const upper = estimatePrintTime({ ...FAST_PARAMS, material: "PETG" });
    // PETG engaja o clamp @12.6 > 12 — se o lookup fosse case-sensitive,
    // "PETG" cairia no teto seguro (10) e o tempo seria diferente.
    expect(upper).toEqual(lower);
  });

  // ── estimatePrintTimeFromFilamentMm (fallback move-based) ──────────────

  it("estimatePrintTimeFromFilamentMm honra o override no clamp", () => {
    // 10 m de filamento: a diferença de velocidade precisa cruzar a fronteira
    // de minuto inteiro (a função arredonda o total em minutos).
    const base = estimatePrintTimeFromFilamentMm(10_000, {
      printSpeedMmPerS: 150,
      material: "pla",
    });
    const clamped = estimatePrintTimeFromFilamentMm(10_000, {
      printSpeedMmPerS: 150,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 11,
    });
    expect(base).toBeDefined();
    expect(clamped).toBeDefined();
    expect(clamped as number).toBeGreaterThan(base as number);
  });

  it("estimatePrintTimeFromFilamentMm sem override = byte-identical", () => {
    const implicit = estimatePrintTimeFromFilamentMm(1000, {
      printSpeedMmPerS: 150,
      material: "pla",
    });
    const tableMvs = estimatePrintTimeFromFilamentMm(1000, {
      printSpeedMmPerS: 150,
      material: "pla",
      maxVolumetricSpeedMm3PerS: PLA_MVS,
    });
    expect(tableMvs).toBe(implicit);
  });
});

describe("printTimeEstimator — MVS não afeta o peso (D-EA4)", () => {
  it("override muda o tempo, NÃO o comprimento de filamento reportado", () => {
    const base = estimatePrintTime({ ...FAST_PARAMS, material: "pla" });
    const clamped = estimatePrintTime({
      ...FAST_PARAMS,
      material: "pla",
      maxVolumetricSpeedMm3PerS: 11,
    });
    expect(clamped.filamentLengthMm).toBe(base.filamentLengthMm);
    expect(clamped.estimatedMinutes).not.toBe(base.estimatedMinutes);
  });
});
