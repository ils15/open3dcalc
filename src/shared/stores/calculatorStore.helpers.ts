import type { CalcLevel, CalculatorState } from "./calculatorStore.types";
import type { FdmSlicerProfile } from "@/shared/types";
import { DEFAULT_FDM_SLICER_PROFILE } from "./calculatorStore.defaults";
import { guardedStorage } from "@/shared/lib/manifestStorage";

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedAutoSave(getState: () => CalculatorState) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const s = getState();
    const data = {
      activeTab: s.activeTab,
      fdmMaterial: s.fdmMaterial,
      fdmPrintParams: s.fdmPrintParams,
      fdmSlicerProfile: s.fdmSlicerProfile,
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
      fdmAmsEnabled: s.fdmAmsEnabled,
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
