import { isPersistableCalculationState } from "@/shared/lib/calculationState";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { resolveFdmFilament } from "@/shared/stores/calculatorStore.helpers";
import { computeValidatedStoreResults } from "@/shared/stores/calculatorStore.validation";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import type { FilamentSpool } from "@/shared/stores/filamentInventory";
import type { PrinterProfile, Marketplace } from "@/shared/types";
import { guardedStorage } from "@/shared/lib/manifestStorage";

export function selectSpool(spool: FilamentSpool) {
  const state = useCalculatorStore.getState();
  useCalculatorStore.getState().setFdmMaterial({
    ...state.fdmMaterial,
    type: spool.material,
    costPerKg: spool.costPerKg,
  });
}

export function restoreAutoSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = guardedStorage.getItem("open3dcalc_settings_v2");
    if (!raw) return false;
    const data = JSON.parse(raw);
    const calc = useCalculatorStore.getState();
    const catalogPrinters = useCatalogStore.getState().printers;
    const catalogMarketplaces = useCatalogStore.getState().marketplaces;
    const printer = catalogPrinters.find(
      (p: { id: string }) => p.id === data.selectedPrinterId,
    );
    const marketplace = catalogMarketplaces.find(
      (m: { id: string }) => m.id === data.selectedMarketplaceId,
    );

    const restored = {
      ...calc,
      activeTab: data.activeTab ?? calc.activeTab,
      fdmMaterial: data.fdmMaterial ?? calc.fdmMaterial,
      fdmPrintParams: data.fdmPrintParams ?? calc.fdmPrintParams,
      fdmSlicerProfile: data.fdmSlicerProfile ?? calc.fdmSlicerProfile,
      // Recover legacy filament fields before the persistence gate validates
      // the normalized calculation state.
      fdmFilament: resolveFdmFilament(data.fdmFilament ?? calc.fdmFilament),
      fdmAmsEnabled: false,
      fdmAmsSlots: data.fdmAmsSlots ?? calc.fdmAmsSlots,
      fdmMachine: data.fdmMachine ?? calc.fdmMachine,
      fdmHardware: data.fdmHardware ?? calc.fdmHardware,
      fdmFinishing: data.fdmFinishing ?? calc.fdmFinishing,
      fdmLabor: data.fdmLabor ?? calc.fdmLabor,
      fdmExtras: data.fdmExtras ?? calc.fdmExtras,
      fdmSales: data.fdmSales ?? calc.fdmSales,
      fdmOps: data.fdmOps ?? calc.fdmOps,
      fdmSoft: data.fdmSoft ?? calc.fdmSoft,
      resinMaterial: data.resinMaterial ?? calc.resinMaterial,
      resinPrintParams: data.resinPrintParams ?? calc.resinPrintParams,
      resinPostProcess: data.resinPostProcess ?? calc.resinPostProcess,
      resinMachine: data.resinMachine ?? calc.resinMachine,
      resinHardware: data.resinHardware ?? calc.resinHardware,
      resinLabor: data.resinLabor ?? calc.resinLabor,
      resinExtras: data.resinExtras ?? calc.resinExtras,
      resinSales: data.resinSales ?? calc.resinSales,
      resinOps: data.resinOps ?? calc.resinOps,
      resinSoft: data.resinSoft ?? calc.resinSoft,
      fixedCosts: data.fixedCosts ?? calc.fixedCosts,
      productName: data.productName ?? calc.productName,
      quantity: data.quantity ?? calc.quantity,
      infillPercent: data.infillPercent ?? calc.infillPercent,
      targetMarginMode: data.targetMarginMode ?? calc.targetMarginMode,
      enabledSections: data.enabledSections ?? calc.enabledSections,
      selectedPrinter: (printer ?? calc.selectedPrinter) as unknown as PrinterProfile,
      selectedMarketplace: (marketplace ??
        calc.selectedMarketplace) as unknown as Marketplace,
    };
    const validated = computeValidatedStoreResults(restored);
    if (
      !isPersistableCalculationState({
        calculationIssues: validated.calculationIssues,
        quantity: validated.input.quantity,
      })
    ) {
      return false;
    }
    useCalculatorStore.setState({
      ...restored,
      ...validated.input,
      results: validated.results,
      calculationIssues: validated.calculationIssues,
    });
    return true;
  } catch {
    return false;
  }
}
