export interface PrintTimeEstimate {
  estimatedMinutes: number;
  estimatedHours: number;
  layers: number;
  travelDistanceMm: number;
  filamentLengthMm: number;
  confidence: "low" | "medium" | "high";
}

export interface PrintTimeParams {
  /** Model volume in cm³. */
  volumeCm3: number;
  /** Model bounding box in mm (used for layer count). */
  dimensions: { x: number; y: number; z: number };
  /** Layer height in mm. Default 0.2. */
  layerHeight?: number;
  /** Print speed in mm/s. Default 60. */
  speed?: number;
  /** Infill percentage. Default 20. */
  infillPercent?: number;
  /** Number of perimeter walls. Default 3. */
  wallCount?: number;
  /** Printer power draw in watts (from store fdmPrintParams / selectedPrinter). */
  printerPowerWatts?: number;
  /** Nozzle diameter in mm. Default 0.4. */
  nozzleDiameterMm?: number;
  /** Travel (non-print) speed in mm/s. Default 150. */
  travelSpeedMmPerS?: number;
  /** Solid top/bottom layers. Default 4. */
  topBottomLayers?: number;
}

const DEFAULT_SETTINGS = {
  layerHeightMm: 0.2,
  nozzleDiameterMm: 0.4,
  printSpeedMmPerS: 60,
  travelSpeedMmPerS: 150,
  infillPercent: 20,
  wallCount: 3,
  topBottomLayers: 4,
};

export function estimatePrintTime(params: PrintTimeParams): PrintTimeEstimate {
  const {
    volumeCm3,
    dimensions,
    layerHeight = DEFAULT_SETTINGS.layerHeightMm,
    speed = DEFAULT_SETTINGS.printSpeedMmPerS,
    travelSpeedMmPerS = DEFAULT_SETTINGS.travelSpeedMmPerS,
  } = params;

  const heightMm = dimensions.z;
  const layers = Math.ceil(heightMm / layerHeight);

  // Estimate filament length from volume
  // Volume = π * r² * length
  const filamentRadiusMm = 1.75 / 2;
  const volumeMm3 = volumeCm3 * 1000;
  const filamentLengthMm =
    volumeMm3 / (Math.PI * filamentRadiusMm * filamentRadiusMm);

  // Estimate print time
  // Print time = (filament length / print speed) + (travel distance / travel speed)
  // Travel distance is roughly 25% of print distance
  const printDistanceMm = filamentLengthMm;
  const travelDistanceMm = printDistanceMm * 0.25;

  const printTimeSeconds = printDistanceMm / speed;
  const travelTimeSeconds = travelDistanceMm / travelSpeedMmPerS;

  // Add layer change overhead (~2 seconds per layer)
  const layerChangeSeconds = layers * 2;

  const totalSeconds =
    printTimeSeconds + travelTimeSeconds + layerChangeSeconds;
  const estimatedMinutes = Math.round(totalSeconds / 60);
  const estimatedHours = Math.round((estimatedMinutes / 60) * 10) / 10;

  // Confidence: high when real printer settings were provided,
  // medium when only defaults are used, low without valid geometry
  const hasRealSettings =
    params.layerHeight !== undefined ||
    params.speed !== undefined ||
    params.infillPercent !== undefined ||
    params.wallCount !== undefined ||
    params.printerPowerWatts !== undefined ||
    params.nozzleDiameterMm !== undefined ||
    params.travelSpeedMmPerS !== undefined ||
    params.topBottomLayers !== undefined;

  const confidence: PrintTimeEstimate["confidence"] =
    volumeCm3 <= 0 || dimensions.z <= 0
      ? "low"
      : hasRealSettings
        ? "high"
        : "medium";

  return {
    estimatedMinutes,
    estimatedHours,
    layers,
    travelDistanceMm: Math.round(travelDistanceMm),
    filamentLengthMm: Math.round(filamentLengthMm),
    confidence,
  };
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
  // Estimate volume from bounding box (assuming ~40% fill for typical prints)
  const boundingBoxVolume = widthMm * depthMm * heightMm;
  const estimatedVolumeCm3 = (boundingBoxVolume * 0.4) / 1000;

  return estimatePrintTime({
    volumeCm3: estimatedVolumeCm3,
    dimensions: { x: widthMm, y: depthMm, z: heightMm },
    ...settings,
  });
}
