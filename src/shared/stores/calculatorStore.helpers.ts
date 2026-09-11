import type { CalcLevel, CalculatorState } from "./calculatorStore.types";
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
