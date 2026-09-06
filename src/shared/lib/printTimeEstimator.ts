import {
  DEFAULT_FILAMENT_FAMILY,
  maxVolumetricSpeedFor,
  type FilamentFamily,
} from "./filamentProfiles";
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
}

const DEFAULT_SETTINGS = {
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
    materialVolumeCm3,
    layerHeightMm = DEFAULT_SETTINGS.layerHeightMm,
    lineWidthMm = DEFAULT_SETTINGS.lineWidthMm,
    printSpeedMmPerS = DEFAULT_SETTINGS.printSpeedMmPerS,
    travelSpeedMmPerS = DEFAULT_SETTINGS.travelSpeedMmPerS,
    travelRatio = DEFAULT_SETTINGS.travelRatio,
    material = DEFAULT_FILAMENT_FAMILY,
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
    !(travelSpeedMmPerS > 0)
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
  // Volume = π * r² * comprimento
  const filamentRadiusMm = 1.75 / 2;
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

  // Add layer change overhead (~2 seconds per layer)
  const layerChangeSeconds = layers * LAYER_CHANGE_SECONDS;

  const totalSeconds =
    printTimeSeconds + travelTimeSeconds + layerChangeSeconds;
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
