import type { CalculatorState } from "@/shared/stores/calculatorStore.types";
import type {
  CalculationSnapshot,
  MachineCosts,
  MaterialStateFDM,
  MaterialStateResin,
  PrintParameters,
  SalesParameters,
} from "@/shared/types";

export type ProjectPresetId =
  | "spiral-vase"
  | "reinforced-gopro-handlebar"
  | "rpg-dragon-statue";

export type ProjectTechnology = "fdm" | "resin";

type PresetPrintParameters = Pick<
  PrintParameters,
  "printerPowerWatts" | "printTimeHours" | "failureMode" | "failureValue"
>;

type PresetSales = Pick<SalesParameters, "profitMarginPercent"> & {
  profitMarginRange?: { min: number; max: number };
};

type ProjectPresetBase = {
  id: ProjectPresetId;
  printerId: string;
  catalogMaterialId: string;
  printParameters: PresetPrintParameters;
  demoSellPriceBRL: number;
};

export type ProjectPreset =
  | (ProjectPresetBase & {
      technology: "fdm";
      material: Pick<MaterialStateFDM, "type" | "weightUsed">;
      sales?: PresetSales;
    })
  | (ProjectPresetBase & {
      technology: "resin";
      material: Pick<
        MaterialStateResin,
        "type" | "weightUsed" | "volumeUsedMl"
      >;
      sales?: never;
    });

export interface CatalogMaterial {
  id: string;
  name: string;
  density: number;
  avgPrice: number;
  type: ProjectTechnology;
}

export interface CatalogPrinter {
  id: string;
  power: number;
  value: number;
  usefulLife: number;
  maintenancePerHour: number;
  technology?: ProjectTechnology;
}

export interface ProjectPresetCatalogOptions {
  catalogMaterials: readonly CatalogMaterial[];
  catalogPrinters: readonly CatalogPrinter[];
}

export const RESIN_DENSITY_G_PER_ML = 1.1;

const roundToTwoDecimals = (value: number): number =>
  Math.round(value * 100) / 100;

export function resinWeightToVolume(
  weightGrams: number,
  densityGramsPerMl = RESIN_DENSITY_G_PER_ML,
): number {
  return roundToTwoDecimals(weightGrams / densityGramsPerMl);
}

export const projectPresets: readonly ProjectPreset[] = [
  {
    id: "spiral-vase",
    technology: "fdm",
    printerId: "bambu_p1s",
    catalogMaterialId: "pla_silk",
    material: { type: "PLA Silk", weightUsed: 140 },
    printParameters: {
      printerPowerWatts: 350,
      printTimeHours: 6.8,
      failureMode: "percent",
      failureValue: 10,
    },
    sales: { profitMarginPercent: 110 },
    demoSellPriceBRL: 68.5,
  },
  {
    id: "reinforced-gopro-handlebar",
    technology: "fdm",
    printerId: "bambu_p1s",
    catalogMaterialId: "petg",
    material: { type: "PETG", weightUsed: 48 },
    printParameters: {
      printerPowerWatts: 350,
      printTimeHours: 2.3,
      failureMode: "percent",
      failureValue: 5,
    },
    sales: {
      profitMarginPercent: 140,
      profitMarginRange: { min: 140, max: 180 },
    },
    demoSellPriceBRL: 49,
  },
  {
    id: "rpg-dragon-statue",
    technology: "resin",
    printerId: "anycubic_photon_m3s",
    catalogMaterialId: "standard",
    material: {
      type: "Resina Standard",
      weightUsed: 85,
      volumeUsedMl: resinWeightToVolume(85),
    },
    printParameters: {
      printerPowerWatts: 150,
      printTimeHours: 4.5,
      failureMode: "percent",
      failureValue: 15,
    },
    demoSellPriceBRL: 115,
  },
];

function deriveMachine(
  machine: MachineCosts,
  printer: CatalogPrinter,
): MachineCosts {
  const hoursPerMonth = machine.hoursPerMonth || 1;
  return {
    ...machine,
    machineCost: printer.value,
    depreciationMonths: Math.max(
      1,
      Math.round(printer.usefulLife / hoursPerMonth),
    ),
    maintenanceEnabled: true,
    maintenanceCost: Math.round(printer.maintenancePerHour * hoursPerMonth),
  };
}

export function hasCalculationInProgress(
  state: Pick<CalculatorState, "productName">,
): boolean {
  return state.productName.trim().length > 0;
}

export function buildProjectPresetSnapshot(
  state: CalculatorState,
  preset: ProjectPreset,
  options: ProjectPresetCatalogOptions & { productName: string },
): CalculationSnapshot {
  const printer = options.catalogPrinters.find(
    (candidate) => candidate.id === preset.printerId,
  );
  const material = options.catalogMaterials.find(
    (candidate) => candidate.id === preset.catalogMaterialId,
  );

  if (!printer) {
    throw new Error(`Unknown project preset printer: ${preset.printerId}`);
  }
  if (!material || material.type !== preset.technology) {
    throw new Error(
      `Unknown project preset material: ${preset.catalogMaterialId}`,
    );
  }
  if (printer.technology !== preset.technology) {
    throw new Error(`Project preset technology mismatch: ${preset.id}`);
  }

  const machine = deriveMachine(
    preset.technology === "fdm" ? state.fdmMachine : state.resinMachine,
    printer,
  );
  const printParameters: PrintParameters = {
    ...(preset.technology === "fdm"
      ? state.fdmPrintParams
      : state.resinPrintParams),
    ...preset.printParameters,
    printerPowerWatts: printer.power,
  };

  // The printer and its derived costs are applied first. The material is
  // assigned last so a preset always wins conflicts with the active selection.
  const fdmMaterial: MaterialStateFDM =
    preset.technology === "fdm"
      ? {
          ...state.fdmMaterial,
          type: material.name,
          weightUsed: preset.material.weightUsed,
          costPerKg: material.avgPrice,
          density: material.density,
        }
      : state.fdmMaterial;
  const resinMaterial: MaterialStateResin =
    preset.technology === "resin"
      ? {
          ...state.resinMaterial,
          type: material.name,
          weightUsed: preset.material.weightUsed,
          volumeUsedMl: preset.material.volumeUsedMl,
          costPerLiter: material.avgPrice,
          density: material.density,
        }
      : state.resinMaterial;

  return {
    id: `project-preset-${preset.id}`,
    timestamp: Date.now(),
    type: preset.technology,
    summary: options.productName,
    fdmAmsEnabled: preset.technology === "fdm" ? false : state.fdmAmsEnabled,
    fdmAmsSlots: state.fdmAmsSlots,
    fixedCosts: state.fixedCosts,
    fdmMaterial,
    fdmPrintParams:
      preset.technology === "fdm" ? printParameters : state.fdmPrintParams,
    fdmSlicerProfile: state.fdmSlicerProfile,
    fdmFilament: state.fdmFilament,
    fdmMachine: preset.technology === "fdm" ? machine : state.fdmMachine,
    fdmHardware: state.fdmHardware,
    fdmFinishing: state.fdmFinishing,
    fdmLabor: state.fdmLabor,
    fdmExtras: state.fdmExtras,
    fdmSales: preset.sales
      ? { ...state.fdmSales, profitMarginPercent: preset.sales.profitMarginPercent }
      : state.fdmSales,
    fdmOps: state.fdmOps,
    fdmSoft: state.fdmSoft,
    resinMaterial,
    resinPrintParams:
      preset.technology === "resin" ? printParameters : state.resinPrintParams,
    resinPostProcess:
      preset.technology === "resin"
        ? { ...state.resinPostProcess, washType: "alcohol" }
        : state.resinPostProcess,
    resinMachine: preset.technology === "resin" ? machine : state.resinMachine,
    resinHardware: state.resinHardware,
    resinLabor: state.resinLabor,
    resinExtras: state.resinExtras,
    resinSales: state.resinSales,
    resinOps: state.resinOps,
    resinSoft: state.resinSoft,
    selectedPrinterId: printer.id,
    selectedMarketplaceId: state.selectedMarketplace.id,
    productName: options.productName,
    quantity: state.quantity,
    infillPercent: state.infillPercent,
    targetMarginMode: state.targetMarginMode,
    enabledSections: state.enabledSections,
    results: state.results,
  };
}
