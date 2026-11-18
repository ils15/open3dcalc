import type {
  FDMHardware,
  FdmSlicerProfile,
  LaborCosts,
  MaterialStateFDM,
  PrintParameters,
  SalesParameters,
} from "@/shared/types";

export type CalculatorPresetId =
  "pla_standard" | "petg_functional" | "fast_prototype" | "marketplace_premium";

export interface CalculatorPresetSpec {
  id: CalculatorPresetId;
  labelKey: string;
  hintKey: string;
  ptLabel: string;
  enLabel: string;
  ptHint: string;
  enHint: string;
  badgeText: string;
  activeTab: "fdm";
  infillPercent: number;
  marketplaceId: string;
  fdmMaterial: Partial<MaterialStateFDM>;
  fdmPrintParams: Partial<PrintParameters>;
  fdmSlicerProfile: Partial<FdmSlicerProfile>;
  fdmHardware: Partial<FDMHardware>;
  fdmLabor: Partial<LaborCosts>;
  fdmSales: Partial<SalesParameters>;
}

export const CALCULATOR_PRESETS: readonly CalculatorPresetSpec[] = [
  {
    id: "pla_standard",
    labelKey: "studio.presetPlaStandard",
    hintKey: "studio.presetPlaStandardHint",
    ptLabel: "PLA Padrão",
    enLabel: "Standard PLA",
    ptHint: "PLA · 0.20mm · 20% infill · 50% markup (Venda Direta)",
    enHint: "PLA · 0.20mm · 20% infill · 50% markup (Direct Sale)",
    badgeText: "0.20mm · 50%",
    activeTab: "fdm",
    infillPercent: 20,
    marketplaceId: "direct",
    fdmMaterial: {
      type: "PLA",
      costPerKg: 110,
      density: 1.24,
      spoolEfficiency: 98,
    },
    fdmPrintParams: {
      failureMode: "percent",
      failureValue: 8,
    },
    fdmSlicerProfile: {
      layerHeightMm: 0.2,
      wallCount: 2,
      topLayers: 4,
      bottomLayers: 4,
      printSpeedMmPerS: 60,
    },
    fdmHardware: {
      enabled: true,
      nozzleEnabled: true,
      bedEnabled: true,
    },
    fdmLabor: {
      enabled: true,
      setupTimeMinutes: 10,
      postProcessingTimeMinutes: 10,
    },
    fdmSales: {
      packagingCost: 2,
      profitMarginPercent: 50,
    },
  },
  {
    id: "petg_functional",
    labelKey: "studio.presetPetgFunctional",
    hintKey: "studio.presetPetgFunctionalHint",
    ptLabel: "PETG Funcional",
    enLabel: "Functional PETG",
    ptHint: "PETG · 4 paredes · 35% infill · 65% markup (Peça Técnica)",
    enHint: "PETG · 4 walls · 35% infill · 65% markup (Technical Part)",
    badgeText: "Resistente · 65%",
    activeTab: "fdm",
    infillPercent: 35,
    marketplaceId: "direct",
    fdmMaterial: {
      type: "PETG",
      costPerKg: 135,
      density: 1.27,
      spoolEfficiency: 97,
    },
    fdmPrintParams: {
      failureMode: "percent",
      failureValue: 12,
    },
    fdmSlicerProfile: {
      layerHeightMm: 0.2,
      wallCount: 4,
      topLayers: 5,
      bottomLayers: 5,
      printSpeedMmPerS: 50,
    },
    fdmHardware: {
      enabled: true,
      nozzleEnabled: true,
      bedEnabled: true,
    },
    fdmLabor: {
      enabled: true,
      setupTimeMinutes: 15,
      postProcessingTimeMinutes: 15,
    },
    fdmSales: {
      packagingCost: 3,
      profitMarginPercent: 65,
    },
  },
  {
    id: "fast_prototype",
    labelKey: "studio.presetFastPrototype",
    hintKey: "studio.presetFastPrototypeHint",
    ptLabel: "Protótipo Rápido",
    enLabel: "Fast Prototype",
    ptHint: "PLA Draft · 0.28mm · 12% infill · 35% markup (Validação Rápida)",
    enHint: "Draft PLA · 0.28mm · 12% infill · 35% markup (Fast Validation)",
    badgeText: "0.28mm · 35%",
    activeTab: "fdm",
    infillPercent: 12,
    marketplaceId: "direct",
    fdmMaterial: {
      type: "PLA",
      costPerKg: 95,
      density: 1.24,
      spoolEfficiency: 98,
    },
    fdmPrintParams: {
      failureMode: "percent",
      failureValue: 5,
    },
    fdmSlicerProfile: {
      layerHeightMm: 0.28,
      wallCount: 2,
      topLayers: 3,
      bottomLayers: 3,
      printSpeedMmPerS: 80,
    },
    fdmHardware: {
      enabled: true,
      nozzleEnabled: true,
      bedEnabled: true,
    },
    fdmLabor: {
      enabled: false,
      setupTimeMinutes: 5,
      postProcessingTimeMinutes: 5,
    },
    fdmSales: {
      packagingCost: 0,
      profitMarginPercent: 35,
    },
  },
  {
    id: "marketplace_premium",
    labelKey: "studio.presetMarketplace",
    hintKey: "studio.presetMarketplaceHint",
    ptLabel: "Marketplace Premium",
    enLabel: "Marketplace Premium",
    ptHint: "PLA+ · Embalagem reforçada · Taxa Shopee/ML · 80% markup",
    enHint: "PLA+ · Reinforced packaging · Marketplace fee · 80% markup",
    badgeText: "Shopee/ML · 80%",
    activeTab: "fdm",
    infillPercent: 20,
    marketplaceId: "shopee_ate79",
    fdmMaterial: {
      type: "PLA+",
      costPerKg: 125,
      density: 1.24,
      spoolEfficiency: 98,
    },
    fdmPrintParams: {
      failureMode: "percent",
      failureValue: 10,
    },
    fdmSlicerProfile: {
      layerHeightMm: 0.2,
      wallCount: 3,
      topLayers: 4,
      bottomLayers: 4,
      printSpeedMmPerS: 60,
    },
    fdmHardware: {
      enabled: true,
      nozzleEnabled: true,
      bedEnabled: true,
    },
    fdmLabor: {
      enabled: true,
      setupTimeMinutes: 15,
      postProcessingTimeMinutes: 20,
    },
    fdmSales: {
      packagingCost: 5,
      profitMarginPercent: 80,
    },
  },
];

export function getCalculatorPreset(
  id: CalculatorPresetId,
): CalculatorPresetSpec | undefined {
  return CALCULATOR_PRESETS.find((preset) => preset.id === id);
}
