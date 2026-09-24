import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import {
  resolveFdmSlicerProfile,
  resolveFdmFilament,
  resolvePrintParameters,
  resolveLaborCosts,
  resolveFdmMaterial,
  resolveResinMaterial,
} from "@/shared/stores/calculatorStore.helpers";
import {
  DEFAULT_FDM_PARAMS,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_LABOR,
  DEFAULT_RESIN_PARAMS,
  DEFAULT_RESIN_MATERIAL,
  DEFAULT_RESIN_LABOR,
} from "@/shared/stores/calculatorStore.defaults";
import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import type { ComputeStoreInput } from "@/shared/stores/calculatorStore.types";
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
      activeTab: data.activeTab || "fdm",
      fdmMaterial: resolveFdmMaterial(
        data.fdmMaterial || calc.fdmMaterial,
        DEFAULT_FDM_MATERIAL,
      ),
      fdmPrintParams: resolvePrintParameters(
        data.fdmPrintParams,
        DEFAULT_FDM_PARAMS,
      ),
      fdmSlicerProfile:
        data.fdmSlicerProfile !== undefined
          ? resolveFdmSlicerProfile(data.fdmSlicerProfile)
          : calc.fdmSlicerProfile,
      // D-EA2: blob antigo sem o campo → mantém os params atuais.
      fdmFilament:
        data.fdmFilament !== undefined
          ? resolveFdmFilament(data.fdmFilament)
          : calc.fdmFilament,
      fdmAmsEnabled: data.fdmAmsEnabled ?? false,
      fdmAmsSlots: data.fdmAmsSlots || calc.fdmAmsSlots,
      fdmMachine: data.fdmMachine || calc.fdmMachine,
      fdmHardware: data.fdmHardware || calc.fdmHardware,
      fdmFinishing: data.fdmFinishing || calc.fdmFinishing,
      fdmLabor: resolveLaborCosts(data.fdmLabor, DEFAULT_LABOR),
      fdmExtras: data.fdmExtras || calc.fdmExtras,
      fdmSales: data.fdmSales || calc.fdmSales,
      fdmOps: data.fdmOps || calc.fdmOps,
      fdmSoft: data.fdmSoft || calc.fdmSoft,
      resinMaterial: resolveResinMaterial(
        data.resinMaterial || calc.resinMaterial,
        DEFAULT_RESIN_MATERIAL,
      ),
      resinPrintParams: resolvePrintParameters(
        data.resinPrintParams,
        DEFAULT_RESIN_PARAMS,
      ),
      resinPostProcess: data.resinPostProcess || calc.resinPostProcess,
      resinMachine: data.resinMachine || calc.resinMachine,
      resinHardware: data.resinHardware || calc.resinHardware,
      resinLabor: resolveLaborCosts(data.resinLabor, DEFAULT_RESIN_LABOR),
      resinExtras: data.resinExtras || calc.resinExtras,
      resinSales: data.resinSales || calc.resinSales,
      resinOps: data.resinOps || calc.resinOps,
      resinSoft: data.resinSoft || calc.resinSoft,
      productName: data.productName || calc.productName,
      quantity: data.quantity ?? calc.quantity,
      infillPercent: data.infillPercent ?? calc.infillPercent,
      targetMarginMode: data.targetMarginMode ?? calc.targetMarginMode,
      enabledSections: data.enabledSections || calc.enabledSections,
      selectedPrinter: (printer ||
        catalogPrinters[0]) as unknown as PrinterProfile,
      selectedMarketplace: (marketplace ||
        catalogMarketplaces[0]) as unknown as Marketplace,
    };
    const results = computeStoreResults(restored as ComputeStoreInput);
    useCalculatorStore.setState({ ...restored, results });
    return true;
  } catch {
    return false;
  }
}
