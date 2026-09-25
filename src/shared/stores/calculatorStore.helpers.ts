import type { CalcLevel, CalculatorState } from "./calculatorStore.types";
import type {
  FdmSlicerProfile,
  FdmFilamentParams,
  MaterialStateFDM,
  MaterialStateResin,
  PrintParameters,
  LaborCosts,
} from "@/shared/types";
import {
  DEFAULT_FDM_SLICER_PROFILE,
  DEFAULT_FDM_FILAMENT,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_RESIN_MATERIAL,
} from "./calculatorStore.defaults";
import { isPersistableCalculationState } from "@/shared/lib/calculationState";
import { guardedStorage } from "@/shared/lib/manifestStorage";

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedAutoSave(getState: () => CalculatorState) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const s = getState();
    if (!isPersistableCalculationState(s)) {
      console.warn(
        "[calculatorStore] Skipped autosave: INVALID_CALCULATION_STATE",
      );
      return;
    }
    const data = {
      activeTab: s.activeTab,
      fdmMaterial: s.fdmMaterial,
      fdmPrintParams: s.fdmPrintParams,
      fdmSlicerProfile: s.fdmSlicerProfile,
      fdmFilament: s.fdmFilament,
      fdmMachine: s.fdmMachine,
      fdmHardware: s.fdmHardware,
      fdmFinishing: s.fdmFinishing,
      fdmLabor: s.fdmLabor,
      fdmExtras: s.fdmExtras,
      fdmSales: s.fdmSales,
      fdmOps: s.fdmOps,
      fdmSoft: s.fdmSoft,
      resinMaterial: s.resinMaterial,
      resinPrintParams: s.resinPrintParams,
      resinPostProcess: s.resinPostProcess,
      resinMachine: s.resinMachine,
      resinHardware: s.resinHardware,
      resinLabor: s.resinLabor,
      resinExtras: s.resinExtras,
      resinSales: s.resinSales,
      resinOps: s.resinOps,
      resinSoft: s.resinSoft,
      selectedPrinterId: s.selectedPrinter.id,
      selectedMarketplaceId: s.selectedMarketplace.id,
      fdmAmsEnabled: false,
      fdmAmsSlots: s.fdmAmsSlots,
      fixedCosts: s.fixedCosts,
      productName: s.productName,
      quantity: s.quantity,
      infillPercent: s.infillPercent,
      targetMarginMode: s.targetMarginMode,
      enabledSections: s.enabledSections,
      calcLevel: s.calcLevel,
      hiddenFields: s.hiddenFields,
    };
    guardedStorage.setItem("open3dcalc_settings_v2", JSON.stringify(data));
  }, 800);
}

export const loadStr = <T>(key: string, def: T): T => {
  if (typeof window === "undefined") return def;
  try {
    const saved = guardedStorage.getItem("open3dcalc_settings_v2");
    if (!saved) return def;
    const parsed = JSON.parse(saved);
    return parsed[key] !== undefined ? parsed[key] : def;
  } catch {
    return def;
  }
};

export function migrateQuickMode(quickMode: boolean | undefined): CalcLevel {
  if (quickMode === true) return "basic";
  if (quickMode === false) return "advanced";
  return "basic";
}

/**
 * Campos estritamente positivos no estimador (divisão por eles → zero/NaN
 * fora do domínio). Contagens (paredes/camadas) aceitam 0 (vase mode,
 * sem topo/base).
 */
const POSITIVE_PROFILE_FIELDS: ReadonlyArray<keyof FdmSlicerProfile> = [
  "lineWidthMm",
  "layerHeightMm",
  "printSpeedMmPerS",
];
const INTEGER_PROFILE_FIELDS: ReadonlyArray<keyof FdmSlicerProfile> = [
  "wallCount",
  "topLayers",
  "bottomLayers",
];

/**
 * Filtra campos inválidos de um perfil parcial (D-EA1, GA-1).
 *
 * Regra: ausente, não-numérico, NaN/Infinity ou fora do domínio → DESCARTADO
 * (cai no default na resolução). Isso garante que uma store persistida
 * corrompida, um `NaN` de input ou um JSON antigo nunca propaguem valor
 * inválido para o estimador — o caminho crítico de preço.
 */
export function sanitizeFdmSlicerProfile(
  input: Partial<FdmSlicerProfile> | undefined | null,
): Partial<FdmSlicerProfile> {
  if (!input || typeof input !== "object") return {};

  const valid: Partial<FdmSlicerProfile> = {};
  for (const key of Object.keys(input) as (keyof FdmSlicerProfile)[]) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const isPositiveField = POSITIVE_PROFILE_FIELDS.includes(key);
    const isIntegerField = INTEGER_PROFILE_FIELDS.includes(key);
    if (
      (isPositiveField ? value > 0 : value >= 0) &&
      (!isIntegerField || Number.isInteger(value))
    ) {
      valid[key] = value;
    }
  }
  return valid;
}

/**
 * Campos estritamente positivos no estimador (divisão por r² → zero/NaN
 * fora do domínio). `purgePercent` aceita 0 (sem purge). D-EA4:
 * `maxVolumetricSpeedMm3PerS` é teto de vazão — 0/negativo geraria divisão
 * por zero no clamp (`effectiveSpeed = MVS / seção`), então é > 0.
 */
const POSITIVE_FILAMENT_FIELDS: ReadonlyArray<keyof FdmFilamentParams> = [
  "filamentDiameterMm",
  "maxVolumetricSpeedMm3PerS",
];

/**
 * Filtra campos inválidos dos params de filamento (D-EA2, GA-2; D-EA4 adiciona
 * o override de MVS).
 *
 * Regra: ausente, não-numérico, NaN/Infinity ou fora do domínio → DESCARTADO
 * (cai no default na resolução). Garante que uma store persistida corrompida,
 * um `NaN` de input ou um JSON antigo nunca propaguem um valor inválido para
 * o estimador — o caminho crítico de preço. Espelha `sanitizeFdmSlicerProfile`.
 */
export function sanitizeFdmFilament(
  input: Partial<FdmFilamentParams> | undefined | null,
): Partial<FdmFilamentParams> {
  if (!input || typeof input !== "object") return {};

  const valid: Partial<FdmFilamentParams> = {};
  for (const key of Object.keys(input) as (keyof FdmFilamentParams)[]) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const isPositiveField = POSITIVE_FILAMENT_FIELDS.includes(key);
    if (isPositiveField ? value > 0 : value >= 0) {
      valid[key] = value;
    }
  }
  return valid;
}

/**
 * Resolve o perfil final: defaults + campos válidos passados.
 * Migration-safe por construção — blob antigo sem o campo, parcial ou
 * corrompido sempre termina num perfil completo e válido.
 */
export function resolveFdmSlicerProfile(
  input: Partial<FdmSlicerProfile> | undefined | null,
): FdmSlicerProfile {
  return { ...DEFAULT_FDM_SLICER_PROFILE, ...sanitizeFdmSlicerProfile(input) };
}

/**
 * Resolve os params finais: defaults + campos válidos passados.
 * Migration-safe por construção — blob antigo sem o campo, parcial ou
 * corrompido sempre termina num objeto completo e válido.
 */
export function resolveFdmFilament(
  input: Partial<FdmFilamentParams> | null | undefined,
): FdmFilamentParams {
  const sanitized = sanitizeFdmFilament(input);
  return { ...DEFAULT_FDM_FILAMENT, ...sanitized };
}

const PRINT_PARAMETER_NUMERIC_FIELDS = [
  "printTimeHours",
  "printerPowerWatts",
  "energyCostPerKwh",
  "failureValue",
  "riskMultiplier",
  "heatUpTimeMinutes",
  "heatUpPowerPercent",
] as const;

const PRINT_FAILURE_MODES: readonly PrintParameters["failureMode"][] = [
  "none",
  "percent",
  "fixed",
];

const isNonNegative = (value: number): boolean => value >= 0;
const isPositive = (value: number): boolean => value > 0;

/**
 * Complete a print-parameter slice before it reaches the calculator.
 *
 * Persisted settings and shared snapshots can predate a field.  A shallow
 * object spread would carry an explicit `undefined` over the default and turn
 * the derived result into NaN, which the UI renders as zero/dashes.
 */
export function resolvePrintParameters(
  input: Partial<PrintParameters> | null | undefined,
  defaults: PrintParameters,
): PrintParameters {
  if (!input || typeof input !== "object") return { ...defaults };

  const sanitized: Partial<PrintParameters> = {};
  for (const key of PRINT_PARAMETER_NUMERIC_FIELDS) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value) && isNonNegative(value)) {
      Object.assign(sanitized, { [key]: value });
    }
  }
  if (
    input.failureMode !== undefined &&
    PRINT_FAILURE_MODES.includes(input.failureMode)
  ) {
    sanitized.failureMode = input.failureMode;
  }
  return { ...defaults, ...sanitized };
}

const LABOR_NUMERIC_FIELDS = [
  "setupTimeMinutes",
  "postProcessingTimeMinutes",
  "hourlyRate",
] as const;

/** Complete a labor slice using the same migration-safe policy as print params. */
export function resolveLaborCosts(
  input: Partial<LaborCosts> | null | undefined,
  defaults: LaborCosts,
): LaborCosts {
  if (!input || typeof input !== "object") return { ...defaults };

  const sanitized: Partial<LaborCosts> = {};
  if (typeof input.enabled === "boolean") sanitized.enabled = input.enabled;
  for (const key of LABOR_NUMERIC_FIELDS) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value) && isNonNegative(value)) {
      Object.assign(sanitized, { [key]: value });
    }
  }
  return { ...defaults, ...sanitized };
}

const FDM_MATERIAL_NUMERIC_FIELDS = [
  "weightUsed",
  "purgeWeight",
  "costPerKg",
  "density",
  "spoolEfficiency",
] as const;

/** Complete a persisted FDM material before it reaches material cost derivation. */
export function resolveFdmMaterial(
  input: Partial<MaterialStateFDM> | null | undefined,
  defaults: MaterialStateFDM = DEFAULT_FDM_MATERIAL,
): MaterialStateFDM {
  if (!input || typeof input !== "object") return { ...defaults };

  const sanitized: Partial<MaterialStateFDM> = {};
  if (typeof input.type === "string" && input.type.trim().length > 0) {
    sanitized.type = input.type;
  }
  for (const key of FDM_MATERIAL_NUMERIC_FIELDS) {
    const value = input[key];
    const isPositiveField = key === "density" || key === "spoolEfficiency";
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (isPositiveField ? isPositive(value) : isNonNegative(value))
    ) {
      Object.assign(sanitized, { [key]: value });
    }
  }
  return { ...defaults, ...sanitized };
}

const RESIN_MATERIAL_NUMERIC_FIELDS = [
  "volumeUsedMl",
  "costPerLiter",
  "density",
  "wasteMarginPercent",
] as const;

/** Complete a persisted resin material before it reaches material cost derivation. */
export function resolveResinMaterial(
  input: Partial<MaterialStateResin> | null | undefined,
  defaults: MaterialStateResin = DEFAULT_RESIN_MATERIAL,
): MaterialStateResin {
  if (!input || typeof input !== "object") return { ...defaults };

  const sanitized: Partial<MaterialStateResin> = {};
  if (typeof input.type === "string" && input.type.trim().length > 0) {
    sanitized.type = input.type;
  }
  for (const key of RESIN_MATERIAL_NUMERIC_FIELDS) {
    const value = input[key];
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (key === "density" ? isPositive(value) : isNonNegative(value))
    ) {
      Object.assign(sanitized, { [key]: value });
    }
  }
  if (
    typeof input.weightUsed === "number" &&
    Number.isFinite(input.weightUsed) &&
    isNonNegative(input.weightUsed)
  ) {
    sanitized.weightUsed = input.weightUsed;
  }
  return { ...defaults, ...sanitized };
}
