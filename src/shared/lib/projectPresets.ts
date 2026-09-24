export {
  addExampleLabel,
  buildProjectPresetDraft,
  createProjectPresetApplicationPatch,
  hasCalculationInProgress,
  previewProjectPreset,
  PROJECT_PRESET_BASELINE,
  PresetDraftError,
  resinWeightToVolume,
  RESIN_DENSITY_G_PER_ML,
  validatePresetDraft,
} from "./projectPresetDraft";
export type {
  BuildProjectPresetDraftOptions,
  PresetCatalogMaterial,
  PresetCatalogOrigin,
  PresetCatalogPrinter,
  PresetDraftBaseline,
  PresetDraftErrorCode,
  PresetDraftV1,
  PresetMaterialProvenance,
  PresetPreservedFields,
  PresetPrinterProvenance,
  PresetPrintParameters,
  PresetProvenance,
  PresetResetFields,
  ProjectPreset,
  ProjectPresetCatalog,
  ProjectPresetId,
  ProjectPresetPreview,
  ProjectTechnology,
} from "./projectPresetDraft";

import { resinWeightToVolume } from "./projectPresetDraft";
import type { ProjectPreset } from "./projectPresetDraft";

/** Built-in project examples. The catalog remains the source of canonical values. */
export const projectPresets: readonly ProjectPreset[] = [
  {
    schemaVersion: 1,
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
    demoSellPriceBRL: 68.5,
  },
  {
    schemaVersion: 1,
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
    demoSellPriceBRL: 49,
  },
  {
    schemaVersion: 1,
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
