import {
  DEFAULT_FILAMENT_FAMILY,
  maxVolumetricSpeedFor,
  type FilamentFamily,
} from "./filamentProfiles";
import { DEFAULT_FILAMENT_DIAMETER_MM } from "./filamentDefaults";
import {
  getModeBehavior,
  resolveCalibrationK,
  resolveFixedMinutes,
  resolveTimeAnchor,
  type EstimateOptions,
} from "@/shared/types/estimation";

export interface PrintTimeEstimate {
  estimatedMinutes: number;
  estimatedHours: number;
  layers: number;
  travelDistanceMm: number;
  filamentLengthMm: number;
  confidence: "low" | "medium" | "high";
  /**
   * Sempre `"rough_estimate"`: aproximação pré-slice (±30%, ver
   * `docs/estimators-model.md`). Só um fatiador de verdade crava o tempo.
   */
  kind: "rough_estimate";
}

/** Dimensões da bounding box em mm. */
export interface DimensionsMm {
  x: number;
  y: number;
  z: number;
}

/**
 * Parâmetros do estimador de tempo.
 *
 * Todo campo afeta o cálculo — params-fantasma (`wallCount`, `infillPercent`,
 * `printerPowerWatts`, `nozzleDiameterMm`, `topBottomLayers`, que só
 * alimentavam o rótulo de confiança) foram removidos em favor das entradas
 * que movem o número: volume extrudado, geometria da fita, velocidades e
 * material (MVS). Unidades canônicas vão no nome. Defaults em
 * `docs/estimators-model.md`.
 */
export interface PrintTimeParams extends EstimateOptions {
  /** Volume MACIÇO do modelo em cm³ (fallback quando sem `materialVolumeCm3`). */
  volumeCm3: number;
  /** Bounding box do modelo em mm (só `z` é usada, p/ contagem de camadas). */
  dimensions: DimensionsMm;
  /**
   * Área de superfície da malha em mm² (unidade canônica do `MeshAnalysis`;
   * conversão para cm² acontece aqui, como em `estimateWeight`).
   * Base do fator empírico de geometria (D-EA3, §7): peças pequenas/detalhadas
   * (SA/V alto) perdem mais tempo com accel/decel do que o modelo de velocidade
   * constante assume. Ausente/≤ 0/NaN → fator neutro, estimativa inalterada.
   */
  surfaceAreaMm2?: number;
  /**
   * Plástico REALMENTE extrudado em cm³ (casca + infill + suporte).
   * Quando ausente, usa `volumeCm3` — superestima peça oca como se sólida.
   */
  materialVolumeCm3?: number;
  /** Altura de camada em mm. Padrão 0,2. */
  layerHeightMm?: number;
  /** Largura da linha extrudada em mm. Padrão 0,42 (bico de 0,4). */
  lineWidthMm?: number;
  /** Velocidade de impressão em mm/s. Padrão 60 (sujeita ao clamp MVS). */
  printSpeedMmPerS?: number;
  /** Velocidade de travel em mm/s. Padrão 150. */
  travelSpeedMmPerS?: number;
  /**
   * Fração da distância de extrusão percorrida em travel (0–1).
   * Padrão 0,25 — aproximação pré-slice documentada, não medição.
   */
  travelRatio?: number;
  /**
   * Família do filamento (default PLA). Define o teto MVS:
   * `Q = layerH × lineW × speed` é clamped no MVS do material, então pedir
   * 300 mm/s não gera tempo impossível — gera o tempo do teto físico.
   */
  material?: FilamentFamily | string;
  /**
   * Diâmetro do filamento em mm (default 1.75, single-sourced de
   * `filamentDefaults`). Só afeta o `filamentLengthMm` reportado — o tempo
   * depende do volume depositado, não da espessura do filamento. D-EA2 (GA-2).
   */
  filamentDiameterMm?: number;
}

export const DEFAULT_SETTINGS = {
  layerHeightMm: 0.2,
  // Largura da linha extrudada. Bico de 0,4 mm deposita ~0,42 mm nos perfis
  // padrão de Bambu Studio, OrcaSlicer e PrusaSlicer.
  lineWidthMm: 0.42,
  printSpeedMmPerS: 60,
  travelSpeedMmPerS: 150,
  travelRatio: 0.25,
} as const;

/** Segundos de overhead por troca de camada (home da aproximação). */
const LAYER_CHANGE_SECONDS = 2;

/**
 * Constantes do fator empírico de geometria (D-EA3 — §7 de
 * `docs/estimators-model.md`).
 *
 * O estimador assume velocidade constante: não modela accel/jerk. Peças
 * pequenas/detalhadas têm muitas mudanças de direção e travel proporcionalmente
 * maior, então são subestimadas de forma sistemática. Em vez da física
 * completa (YAGNI explícito do deepwork `estimation-accuracy`: a aceleração
 * real depende da firmware/junction-deviation, e o fator captura o viés
 * residual dominante), aplica-se um fator bornceado e clampado derivado da
 * razão superfície/volume — proxy de detalhe que cresce com a complexidade:
 * cubo de 100 mm → SA/V 0,06 mm⁻¹; de 10 mm → 0,6; de 3 mm → 2,0.
 */
export const GEOMETRY_FACTOR = {
  /** SA/V (mm⁻¹) abaixo da qual a peça é "grande/simples": fator neutro (1,0). */
  lowRatio: 0.2,
  /** SA/V (mm⁻¹) em que o fator satura no clamp. */
  highRatio: 1.0,
  /** Teto do fator: peças minúsculas nunca custam > 30% a mais (envelope ±30%). */
  max: 1.3,
} as const;

/**
 * Fator multiplicativo do tempo de MOVIMENTO, derivado da geometria.
 *
 * Rampa linear bornceada entre `lowRatio` e `highRatio`, clampada em `max`.
 * Entrada ausente/não-finita, ou volume ≤ 0/NaN → fator neutro 1,0
 * (estimativa inalterada; a regra "zeros explícitos, nunca NaN" se mantém).
 * `surfaceAreaMm2` e `volumeCm3` vêm do `MeshAnalysis` já calculado — sem
 * reprocessar a malha e sem novos parâmetros de store (fator é puro da forma).
 */
export function geometryTimeFactor(
  surfaceAreaMm2?: number,
  volumeCm3?: number,
): number {
  if (!Number.isFinite(surfaceAreaMm2) || (surfaceAreaMm2 as number) <= 0) {
    return 1;
  }
  if (!Number.isFinite(volumeCm3) || (volumeCm3 as number) <= 0) return 1;
  // Ambas as entradas são finitas e > 0 → a razão é finita e positiva por
  // construção (denominador = volume × 1000 ≥ 1.000); sem guardas de NaN aqui.
  const ratio = (surfaceAreaMm2 as number) / ((volumeCm3 as number) * 1000);
  if (ratio <= GEOMETRY_FACTOR.lowRatio) return 1;
  if (ratio >= GEOMETRY_FACTOR.highRatio) return GEOMETRY_FACTOR.max;
  return (
    1 +
    (GEOMETRY_FACTOR.max - 1) *
      ((ratio - GEOMETRY_FACTOR.lowRatio) /
        (GEOMETRY_FACTOR.highRatio - GEOMETRY_FACTOR.lowRatio))
  );
}

function emptyEstimate(layers: number): PrintTimeEstimate {
  return {
    estimatedMinutes: 0,
    estimatedHours: 0,
    layers,
    travelDistanceMm: 0,
    filamentLengthMm: 0,
    confidence: "low",
    kind: "rough_estimate",
  };
}

/**
 * Pricing estimate (rough ±30%, biased upward) — the only ground truth is
 * the slicer (G-code).
 *
 * Modes (`EstimateOptions`): `simple`/missing returns the byte-identical
 * legacy result (ignores `calibrationK`/`gcodeMinutes`/`fixedMinutes`);
 * `advanced` lets the `gcodeMinutes` anchor win, scales the rest by
 * `calibrationK` (default 1.0), and adds `fixedMinutes` setup time on top
 * (`t_real = t_fixed + k * t`, default 0 = current behavior).
 */
export function estimatePrintTime(params: PrintTimeParams): PrintTimeEstimate {
  const {
    volumeCm3,
    dimensions,
    surfaceAreaMm2,
    materialVolumeCm3,
    layerHeightMm = DEFAULT_SETTINGS.layerHeightMm,
    lineWidthMm = DEFAULT_SETTINGS.lineWidthMm,
    printSpeedMmPerS = DEFAULT_SETTINGS.printSpeedMmPerS,
    travelSpeedMmPerS = DEFAULT_SETTINGS.travelSpeedMmPerS,
    travelRatio = DEFAULT_SETTINGS.travelRatio,
    material = DEFAULT_FILAMENT_FAMILY,
    filamentDiameterMm = DEFAULT_FILAMENT_DIAMETER_MM,
  } = params;

  // Geometria inválida → zeros explícitos, nunca NaN. (Camadas ainda são
  // reportadas quando a altura é válida, para debug.)
  const heightMm = dimensions?.z;
  const layers =
    Number.isFinite(heightMm) && heightMm > 0 && layerHeightMm > 0
      ? Math.ceil(heightMm / layerHeightMm)
      : 0;
  const effectiveVolumeCm3 = materialVolumeCm3 ?? volumeCm3;
  if (
    !Number.isFinite(effectiveVolumeCm3) ||
    effectiveVolumeCm3 <= 0 ||
    !Number.isFinite(heightMm) ||
    heightMm <= 0 ||
    !(layerHeightMm > 0) ||
    !(lineWidthMm > 0) ||
    !(printSpeedMmPerS > 0) ||
    !(travelSpeedMmPerS > 0) ||
    !(filamentDiameterMm > 0)
  ) {
    // The slicer anchor wins even on invalid geometry (advanced):
    // without anchor, explicit zeros as before — never NaN.
    const anchorMinutes = resolveTimeAnchor(params);
    if (anchorMinutes !== undefined) {
      const fixed = getModeBehavior(params).applyCalibration
        ? resolveFixedMinutes(params)
        : 0;
      const anchoredMinutes = Math.round(anchorMinutes + fixed);
      return {
        estimatedMinutes: anchoredMinutes,
        estimatedHours: Math.round((anchoredMinutes / 60) * 10) / 10,
        layers,
        travelDistanceMm: 0,
        filamentLengthMm: 0,
        confidence: "high",
        kind: "rough_estimate",
      };
    }
    return emptyEstimate(layers);
  }

  // Comprimento de filamento CONSUMIDO (só para relatório).
  // Volume = π * r² * comprimento — o diâmetro vem da store (D-EA2), não é
  // mais um literal 1.75 inline.
  const filamentRadiusMm = filamentDiameterMm / 2;
  const volumeMm3 = effectiveVolumeCm3 * 1000;
  const filamentLengthMm =
    volumeMm3 / (Math.PI * filamentRadiusMm * filamentRadiusMm);

  // Distância que o BICO percorre. Não é o comprimento de filamento: o bico
  // deposita uma fita de (altura de camada × largura de linha), muito mais fina
  // que os 1,75 mm do filamento.
  const extrusionCrossSectionMm2 = layerHeightMm * lineWidthMm;

  // Clamp MVS: Q = seção × velocidade não passa do teto do material.
  // Sem isso, 300 mm/s em PLA (Q ≈ 25 mm³/s, teto 15) promete um tempo que o
  // hotend nunca entrega. O clamp troca a velocidade pedida pela máxima física.
  const maxVolumetricSpeed = maxVolumetricSpeedFor(material);
  const nominalFlowMm3PerS = extrusionCrossSectionMm2 * printSpeedMmPerS;
  const effectiveSpeedMmPerS =
    nominalFlowMm3PerS > maxVolumetricSpeed
      ? maxVolumetricSpeed / extrusionCrossSectionMm2
      : printSpeedMmPerS;

  const printDistanceMm = volumeMm3 / extrusionCrossSectionMm2;
  // Travel é fração fixa da extrusão: aproximação pré-slice (o slicer real
  // mede saltos/retrações; nós assumimos 25% → overhead efetivo de ~10-15%
  // sobre o tempo de extrusão, dentro da margem ±30% do rough_estimate).
  // NaN (ex: store corrompida, parse falho) vaza por Math.min/max
  // (Math.max(0, NaN) = NaN) — fallback para o default antes do clamp.
  const safeTravelRatio = Number.isFinite(travelRatio)
    ? travelRatio
    : DEFAULT_SETTINGS.travelRatio;
  const clampedTravelRatio = Math.min(1, Math.max(0, safeTravelRatio));
  const travelDistanceMm = printDistanceMm * clampedTravelRatio;

  const printTimeSeconds = printDistanceMm / effectiveSpeedMmPerS;
  const travelTimeSeconds = travelDistanceMm / travelSpeedMmPerS;

  // D-EA3: fator de geometria (SA/V) bornceado e clampado no termo de
  // movimento (extrusão + travel) — corrige a subestimação sistemática de
  // peças pequenas/detalhadas sem modelar accel/jerk (§7). O overhead de
  // troca de camada é somado DEPOIS: ele já é um proxy flat do mesmo efeito.
  // A âncora G-code (modo avançado) não é tocada — ela sobrescreve o resultado.
  const geometryFactor = geometryTimeFactor(surfaceAreaMm2, volumeCm3);
  const motionSeconds = (printTimeSeconds + travelTimeSeconds) * geometryFactor;

  // Add layer change overhead (~2 seconds per layer)
  const layerChangeSeconds = layers * LAYER_CHANGE_SECONDS;

  const totalSeconds = motionSeconds + layerChangeSeconds;
  const estimatedMinutes = Math.round(totalSeconds / 60);
  const estimatedHours = Math.round((estimatedMinutes / 60) * 10) / 10;

  // Confiança alta quando settings reais (que MOVEM o número) foram
  // informados; média só com defaults; baixa sem geometria válida.
  const hasRealSettings =
    params.materialVolumeCm3 !== undefined ||
    params.layerHeightMm !== undefined ||
    params.lineWidthMm !== undefined ||
    params.printSpeedMmPerS !== undefined ||
    params.travelSpeedMmPerS !== undefined ||
    params.travelRatio !== undefined ||
    params.material !== undefined;

  const confidence: PrintTimeEstimate["confidence"] = hasRealSettings
    ? "high"
    : "medium";
  const base: PrintTimeEstimate = {
    estimatedMinutes,
    estimatedHours,
    layers,
    travelDistanceMm: Math.round(travelDistanceMm),
    filamentLengthMm: Math.round(filamentLengthMm),
    confidence,
    kind: "rough_estimate",
  };

  // Default mode (simple/missing): byte-identical legacy — ignores k, anchors and fixed setup.
  // Fixed setup time only applies in advanced mode (`t_real = t_fixed + k * t`).
  const fixed = getModeBehavior(params).applyCalibration
    ? resolveFixedMinutes(params)
    : 0;
  const anchorMinutes = resolveTimeAnchor(params);
  if (anchorMinutes !== undefined) {
    const anchoredMinutes = Math.round(anchorMinutes + fixed);
    return {
      ...base,
      estimatedMinutes: anchoredMinutes,
      estimatedHours: Math.round((anchoredMinutes / 60) * 10) / 10,
      confidence: "high",
    };
  }
  const k = resolveCalibrationK(params);
  if (k !== 1 || fixed !== 0) {
    const scaledMinutes = Math.round(estimatedMinutes * k + fixed);
    return {
      ...base,
      estimatedMinutes: scaledMinutes,
      estimatedHours: Math.round((scaledMinutes / 60) * 10) / 10,
    };
  }
  return base;
}

/**
 * Billable hours with centi-hour precision for the profit/hr rate (Fase 2 #70).
 * Unlike `estimatedHours` (1 decimal, display-oriented), this keeps 2 decimals
 * so the `totalHours = (print + post + setup) / 60` denominator stays accurate.
 * Returns 0 for non-finite or non-positive inputs (never NaN).
 */
export function estimatedHoursPrecise(estimatedMinutes: number): number {
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0) return 0;
  return Math.round((estimatedMinutes / 60) * 100) / 100;
}

/** Speed/geometry overrides for the filament-based fallback (all optional). */
export interface FilamentTimeOptions {
  /** Filament diameter in mm (default 1.75). */
  filamentDiameterMm?: number;
  /** Layer height in mm (default 0.2). */
  layerHeightMm?: number;
  /** Extruded line width in mm (default 0.42 for a 0.4 nozzle). */
  lineWidthMm?: number;
  /** Print speed in mm/s (default 60, subject to the MVS clamp). */
  printSpeedMmPerS?: number;
  /** Travel speed in mm/s (default 150). */
  travelSpeedMmPerS?: number;
  /** Travel distance as a fraction of extrusion distance (default 0.25). */
  travelRatio?: number;
  /** Filament family for the MVS ceiling (default PLA). */
  material?: FilamentFamily | string;
}

/**
 * Move-based time fallback from extruded filament length.
 *
 * APPROXIMATE — same nominal speeds as `estimatePrintTime` but with no
 * model geometry: layer-change overhead is skipped and travel is a fixed
 * fraction of the extrusion distance. Used only when the G-code carries no
 * slicer time header; prefer any header value when present.
 *
 * Returns whole minutes, or undefined for non-positive/invalid input.
 */
export function estimatePrintTimeFromFilamentMm(
  filamentLengthMm: number,
  options: FilamentTimeOptions = {},
): number | undefined {
  if (!Number.isFinite(filamentLengthMm) || filamentLengthMm <= 0) {
    return undefined;
  }
  const {
    filamentDiameterMm = DEFAULT_FILAMENT_DIAMETER_MM,
    layerHeightMm = DEFAULT_SETTINGS.layerHeightMm,
    lineWidthMm = DEFAULT_SETTINGS.lineWidthMm,
    printSpeedMmPerS = DEFAULT_SETTINGS.printSpeedMmPerS,
    travelSpeedMmPerS = DEFAULT_SETTINGS.travelSpeedMmPerS,
    travelRatio = DEFAULT_SETTINGS.travelRatio,
    material = DEFAULT_FILAMENT_FAMILY,
  } = options;
  if (
    !(filamentDiameterMm > 0) ||
    !(layerHeightMm > 0) ||
    !(lineWidthMm > 0) ||
    !(printSpeedMmPerS > 0) ||
    !(travelSpeedMmPerS > 0)
  ) {
    return undefined;
  }
  const radiusMm = filamentDiameterMm / 2;
  const volumeMm3 = Math.PI * radiusMm * radiusMm * filamentLengthMm;
  const crossSectionMm2 = layerHeightMm * lineWidthMm;
  // Same MVS clamp as estimatePrintTime: nominal flow never exceeds the
  // material ceiling, so the fallback cannot promise an impossible time.
  const maxVolumetricSpeed = maxVolumetricSpeedFor(material);
  const nominalFlowMm3PerS = crossSectionMm2 * printSpeedMmPerS;
  const effectiveSpeedMmPerS =
    nominalFlowMm3PerS > maxVolumetricSpeed
      ? maxVolumetricSpeed / crossSectionMm2
      : printSpeedMmPerS;
  const printDistanceMm = volumeMm3 / crossSectionMm2;
  const safeTravelRatio = Number.isFinite(travelRatio)
    ? travelRatio
    : DEFAULT_SETTINGS.travelRatio;
  const clampedTravelRatio = Math.min(1, Math.max(0, safeTravelRatio));
  const travelDistanceMm = printDistanceMm * clampedTravelRatio;
  const totalSeconds =
    printDistanceMm / effectiveSpeedMmPerS +
    travelDistanceMm / travelSpeedMmPerS;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return undefined;
  return Math.round(totalSeconds / 60);
}

export function estimatePrintTimeFromDimensions(
  widthMm: number,
  depthMm: number,
  heightMm: number,
  settings: Omit<PrintTimeParams, "volumeCm3" | "dimensions"> = {},
): PrintTimeEstimate {
  // Heurística de volume aparente: bounding box × 0,4 — fração sólida típica
  // de peça FDM média (casca + 20% infill); mesma ordem do legado
  // `volume × (0,2 + 0,8 × infill)` com infill 20% (= 0,36 ≈ 0,4).
  // Só para estimativa sem malha; com malha, usa materialVolumeCm3.
  const boundingBoxVolume = widthMm * depthMm * heightMm;
  const estimatedVolumeCm3 = (boundingBoxVolume * 0.4) / 1000;

  return estimatePrintTime({
    volumeCm3: estimatedVolumeCm3,
    dimensions: { x: widthMm, y: depthMm, z: heightMm },
    ...settings,
  });
}
