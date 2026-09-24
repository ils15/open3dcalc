import type { CurrencySetting } from "@/shared/lib/currency";
import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import {
  DEFAULT_AMS_SLOTS,
  DEFAULT_FDM_FILAMENT,
  DEFAULT_FDM_FINISHING,
  DEFAULT_FDM_HARDWARE,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_FDM_SLICER_PROFILE,
  DEFAULT_RESIN_HARDWARE,
  DEFAULT_RESIN_MATERIAL,
  DEFAULT_RESIN_PP,
} from "@/shared/stores/calculatorStore.defaults";
import type {
  CalculatorState,
  CalcLevel,
  ComputeStoreInput,
} from "@/shared/stores/calculatorStore.types";
import type {
  AMSSlot,
  CalculationResult,
  FDMFinishing,
  FDMHardware,
  FdmFilamentParams,
  FdmSlicerProfile,
  MachineCosts,
  Material,
  MaterialStateFDM,
  MaterialStateResin,
  PostProcessingResin,
  PrinterProfile,
  PrintParameters,
  ResinHardware,
  SalesParameters,
  AdditionalCosts,
  LaborCosts,
  OperationalCosts,
  SoftwareCosts,
  FixedCosts,
  Marketplace,
} from "@/shared/types";

export type ProjectPresetId =
  | "spiral-vase"
  | "reinforced-gopro-handlebar"
  | "rpg-dragon-statue";

export type ProjectTechnology = "fdm" | "resin";

export type PresetCatalogOrigin = "builtin" | "custom";

export type PresetCatalogPrinter = PrinterProfile & {
  custom?: boolean;
  revision?: string | number;
  fingerprint?: string;
};

export type PresetCatalogMaterial = Material & {
  custom?: boolean;
  revision?: string | number;
  fingerprint?: string;
};

export interface ProjectPresetCatalog {
  printers: readonly PresetCatalogPrinter[];
  materials: readonly PresetCatalogMaterial[];
}

export interface PresetPrintParameters {
  printerPowerWatts: number;
  printTimeHours: number;
  failureMode: PrintParameters["failureMode"];
  failureValue: number;
  riskMultiplier?: number;
  heatUpTimeMinutes?: number;
  heatUpPowerPercent?: number;
}

interface ProjectPresetBase {
  schemaVersion: 1;
  id: ProjectPresetId;
  printerId: string;
  catalogMaterialId: string;
  printParameters: PresetPrintParameters;
  /** Preview-only example price. It is never copied to calculator state. */
  demoSellPriceBRL: number;
}

export type ProjectPreset =
  | (ProjectPresetBase & {
      technology: "fdm";
      material: Pick<MaterialStateFDM, "type" | "weightUsed">;
    })
  | (ProjectPresetBase & {
      technology: "resin";
      material: Pick<
        MaterialStateResin,
        "type" | "weightUsed" | "volumeUsedMl"
      >;
    });

export type PresetProvenance<TCanonical> = {
  id: string;
  technology: ProjectTechnology;
  origin: PresetCatalogOrigin;
  customized: boolean;
  fingerprint: string;
  revision: string;
  canonical: TCanonical;
};

export type PresetPrinterProvenance = PresetProvenance<PresetCatalogPrinter>;
export type PresetMaterialProvenance = PresetProvenance<PresetCatalogMaterial>;

export type PresetDraftBaseline = {
  riskMultiplier: 1;
  heatUpTimeMinutes: 5;
  heatUpPowerPercent: 150;
  purgeWeight: 0;
  spoolEfficiency: 98;
  wasteMarginPercent: 5;
  infillPercent: 20;
};

export type PresetResetFields = {
  activeTab: ProjectTechnology;
  selectedPrinter: PresetCatalogPrinter;
  selectedPrinterId: string;
  fdmMaterial: MaterialStateFDM;
  resinMaterial: MaterialStateResin;
  fdmPrintParams: PrintParameters;
  resinPrintParams: PrintParameters;
  fdmMachine: MachineCosts;
  resinMachine: MachineCosts;
  fdmSlicerProfile: FdmSlicerProfile;
  fdmFilament: FdmFilamentParams;
  fdmHardware: FDMHardware;
  fdmFinishing: FDMFinishing;
  resinHardware: ResinHardware;
  resinPostProcess: PostProcessingResin;
  fdmAmsEnabled: false;
  fdmAmsSlots: AMSSlot[];
  selectedSpoolId: null;
  infillPercent: number;
  productName: string;
};

type PresetEnvironment = {
  fdmLabor: LaborCosts;
  resinLabor: LaborCosts;
  fdmExtras: AdditionalCosts;
  resinExtras: AdditionalCosts;
  fdmOps: OperationalCosts;
  resinOps: OperationalCosts;
  fdmSoft: SoftwareCosts;
  resinSoft: SoftwareCosts;
  fdmSales: SalesParameters;
  resinSales: SalesParameters;
};

type PresetInactiveFdm = {
  material: MaterialStateFDM;
  printParams: PrintParameters;
  slicerProfile: FdmSlicerProfile;
  filament: FdmFilamentParams;
  machine: MachineCosts;
  hardware: FDMHardware;
  finishing: FDMFinishing;
  labor: LaborCosts;
  extras: AdditionalCosts;
  ops: OperationalCosts;
  soft: SoftwareCosts;
  sales: SalesParameters;
};

type PresetInactiveResin = {
  material: MaterialStateResin;
  printParams: PrintParameters;
  postProcess: PostProcessingResin;
  machine: MachineCosts;
  hardware: ResinHardware;
  labor: LaborCosts;
  extras: AdditionalCosts;
  ops: OperationalCosts;
  soft: SoftwareCosts;
  sales: SalesParameters;
};

export type PresetPreservedFields = PresetEnvironment & {
  selectedMarketplace: CalculatorState["selectedMarketplace"];
  selectedMarketplaceId: string;
  quantity: number;
  currency: CurrencySetting;
  fixedCosts: FixedCosts;
  calcLevel: CalcLevel;
  hiddenFields: string[];
  enabledSections: Record<string, boolean>;
  targetMarginMode: boolean;
  inactiveTechnology: {
    fdm: PresetInactiveFdm | null;
    resin: PresetInactiveResin | null;
  };
};

export type PresetDraftV1 = {
  schemaVersion: 1;
  presetId: ProjectPresetId;
  technology: ProjectTechnology;
  printerRef: PresetPrinterProvenance;
  materialRef: PresetMaterialProvenance;
  baseline: PresetDraftBaseline;
  reset: PresetResetFields;
  preserved: PresetPreservedFields;
};

export type PresetDraftErrorCode =
  | "unknown-schema"
  | "incomplete-draft"
  | "missing-provenance"
  | "missing-printer"
  | "missing-material"
  | "technology-mismatch"
  | "provenance-mismatch"
  | "invalid-preset";

export class PresetDraftError extends Error {
  readonly code: PresetDraftErrorCode;

  constructor(code: PresetDraftErrorCode, message: string) {
    super(message);
    this.name = "PresetDraftError";
    this.code = code;
  }
}

export const PROJECT_PRESET_BASELINE: PresetDraftBaseline = {
  riskMultiplier: 1,
  heatUpTimeMinutes: 5,
  heatUpPowerPercent: 150,
  purgeWeight: 0,
  spoolEfficiency: 98,
  wasteMarginPercent: 5,
  infillPercent: 20,
};

export const RESIN_DENSITY_G_PER_ML = 1.1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) result[key] = clone(item);
    return result as T;
  }
  return value;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
};

/** Small deterministic content hash; no crypto/runtime dependency is needed. */
const fingerprint = (value: unknown): string => {
  const text = JSON.stringify(stableValue(value)) ?? "null";
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const canonicalEntry = <T extends { custom?: boolean; revision?: unknown }>(
  entry: T,
): T => {
  const result = { ...entry } as Record<string, unknown>;
  delete result.custom;
  delete result.revision;
  delete result.fingerprint;
  return result as T;
};

const catalogRevision = <T extends { custom?: boolean; revision?: unknown }>(
  entry: T,
): string => {
  if (entry.revision !== undefined && entry.revision !== null) {
    return String(entry.revision);
  }
  return entry.custom ? "custom-v1" : "builtin-v1";
};

const catalogOrigin = (entry: { custom?: boolean }): PresetCatalogOrigin =>
  entry.custom ? "custom" : "builtin";

const makePrinterProvenance = (
  entry: PresetCatalogPrinter,
  technology: ProjectTechnology,
): PresetPrinterProvenance => {
  const canonical = clone(canonicalEntry(entry));
  return {
    id: entry.id,
    technology,
    origin: catalogOrigin(entry),
    customized: Boolean(entry.custom),
    fingerprint: fingerprint(canonical),
    revision: catalogRevision(entry),
    canonical,
  };
};

const makeMaterialProvenance = (
  entry: PresetCatalogMaterial,
  technology: ProjectTechnology,
): PresetMaterialProvenance => {
  const canonical = clone(canonicalEntry(entry));
  return {
    id: entry.id,
    technology,
    origin: catalogOrigin(entry),
    customized: Boolean(entry.custom),
    fingerprint: fingerprint(canonical),
    revision: catalogRevision(entry),
    canonical,
  };
};

function fail(code: PresetDraftErrorCode, message: string): never {
  throw new PresetDraftError(code, message);
}

const requireKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
  code: PresetDraftErrorCode,
  label: string,
): void => {
  for (const key of keys) {
    if (!hasOwn(value, key)) fail(code, `${label} is missing ${key}`);
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function validatePrinterCanonical(
  value: unknown,
  technology: ProjectTechnology,
): PresetCatalogPrinter {
  if (!isRecord(value)) fail("missing-provenance", "Printer provenance is missing");
  if (value.id !== undefined && typeof value.id !== "string") {
    fail("missing-provenance", "Printer provenance id is invalid");
  }
  if (value.technology !== technology) {
    fail("technology-mismatch", "Printer provenance technology is incompatible");
  }
  for (const key of ["power", "value", "usefulLife", "maintenancePerHour"] as const) {
    if (!isFiniteNumber(value[key])) {
      fail("provenance-mismatch", `Printer provenance ${key} is invalid`);
    }
  }
  return value as unknown as PresetCatalogPrinter;
}

function validateMaterialCanonical(
  value: unknown,
  technology: ProjectTechnology,
): PresetCatalogMaterial {
  if (!isRecord(value)) fail("missing-provenance", "Material provenance is missing");
  if (value.id !== undefined && typeof value.id !== "string") {
    fail("missing-provenance", "Material provenance id is invalid");
  }
  if (value.type !== technology) {
    fail("technology-mismatch", "Material provenance technology is incompatible");
  }
  for (const key of ["density", "avgPrice"] as const) {
    if (!isFiniteNumber(value[key])) {
      fail("provenance-mismatch", `Material provenance ${key} is invalid`);
    }
  }
  return value as unknown as PresetCatalogMaterial;
}

const validateProvenanceShape = (
  value: unknown,
  kind: "printer" | "material",
  technology: ProjectTechnology,
): { id: string; fingerprint: string; revision: string; origin: PresetCatalogOrigin; customized: boolean } => {
  if (!isRecord(value)) fail("missing-provenance", `${kind} provenance is missing`);
  requireKeys(
    value,
    ["id", "technology", "origin", "customized", "fingerprint", "revision", "canonical"],
    "missing-provenance",
    `${kind} provenance`,
  );
  if (typeof value.id !== "string" || value.id.length === 0) {
    fail("missing-provenance", `${kind} provenance id is missing`);
  }
  if (value.technology !== technology) {
    fail("technology-mismatch", `${kind} provenance technology is incompatible`);
  }
  if (value.origin !== "builtin" && value.origin !== "custom") {
    fail("missing-provenance", `${kind} provenance origin is invalid`);
  }
  if (typeof value.customized !== "boolean") {
    fail("missing-provenance", `${kind} provenance customization is missing`);
  }
  if (typeof value.fingerprint !== "string" || value.fingerprint.length === 0) {
    fail("missing-provenance", `${kind} provenance fingerprint is missing`);
  }
  if (typeof value.revision !== "string" || value.revision.length === 0) {
    fail("missing-provenance", `${kind} provenance revision is missing`);
  }
  if (kind === "printer") validatePrinterCanonical(value.canonical, technology);
  else validateMaterialCanonical(value.canonical, technology);
  if (fingerprint(value.canonical) !== value.fingerprint) {
    fail("provenance-mismatch", `${kind} provenance fingerprint is invalid`);
  }
  return {
    id: value.id,
    fingerprint: value.fingerprint,
    revision: value.revision,
    origin: value.origin,
    customized: value.customized,
  };
};

const RESET_KEYS = [
  "activeTab",
  "selectedPrinter",
  "selectedPrinterId",
  "fdmMaterial",
  "resinMaterial",
  "fdmPrintParams",
  "resinPrintParams",
  "fdmMachine",
  "resinMachine",
  "fdmSlicerProfile",
  "fdmFilament",
  "fdmHardware",
  "fdmFinishing",
  "resinHardware",
  "resinPostProcess",
  "fdmAmsEnabled",
  "fdmAmsSlots",
  "selectedSpoolId",
  "infillPercent",
  "productName",
] as const;

const PRESERVED_KEYS = [
  "selectedMarketplace",
  "selectedMarketplaceId",
  "quantity",
  "currency",
  "fixedCosts",
  "fdmLabor",
  "resinLabor",
  "fdmExtras",
  "resinExtras",
  "fdmOps",
  "resinOps",
  "fdmSoft",
  "resinSoft",
  "fdmSales",
  "resinSales",
  "calcLevel",
  "hiddenFields",
  "enabledSections",
  "targetMarginMode",
  "inactiveTechnology",
] as const;

export function validatePresetDraft(
  value: unknown,
  catalog?: ProjectPresetCatalog,
): PresetDraftV1 {
  if (!isRecord(value)) fail("incomplete-draft", "Preset draft is not an object");
  if (value.schemaVersion !== 1) {
    fail("unknown-schema", `Unknown preset draft schemaVersion: ${String(value.schemaVersion)}`);
  }
  for (const forbidden of ["results", "history", "demoSellPriceBRL", "lastDeductedInfo"]) {
    if (hasOwn(value, forbidden)) {
      fail("incomplete-draft", `Preset draft must not contain ${forbidden}`);
    }
  }
  requireKeys(value, ["presetId", "technology", "printerRef", "materialRef", "baseline", "reset", "preserved"], "incomplete-draft", "Preset draft");
  if (value.technology !== "fdm" && value.technology !== "resin") {
    fail("technology-mismatch", "Preset draft technology is invalid");
  }
  const technology = value.technology;
  const printer = validateProvenanceShape(value.printerRef, "printer", technology);
  const material = validateProvenanceShape(value.materialRef, "material", technology);
  if (!isRecord(value.baseline)) fail("incomplete-draft", "Preset draft baseline is missing");
  for (const [key, expected] of Object.entries(PROJECT_PRESET_BASELINE)) {
    if (value.baseline[key] !== expected) {
      fail("incomplete-draft", `Preset draft baseline ${key} is invalid`);
    }
  }
  if (!isRecord(value.reset)) fail("incomplete-draft", "Preset draft reset fields are missing");
  requireKeys(value.reset, RESET_KEYS, "incomplete-draft", "Preset draft reset fields");
  if (value.reset.activeTab !== technology || value.reset.selectedSpoolId !== null) {
    fail("incomplete-draft", "Preset draft reset selectors are invalid");
  }
  if (value.reset.selectedPrinterId !== printer.id || typeof value.reset.productName !== "string" || value.reset.productName.trim().length === 0) {
    fail("incomplete-draft", "Preset draft selected printer or product name is invalid");
  }
  if (value.reset.fdmAmsEnabled !== false || !Array.isArray(value.reset.fdmAmsSlots)) {
    fail("incomplete-draft", "Preset draft AMS reset is invalid");
  }
  if (JSON.stringify(value.reset.fdmAmsSlots) !== JSON.stringify(DEFAULT_AMS_SLOTS)) {
    fail("incomplete-draft", "Preset draft AMS slots are not the canonical defaults");
  }
  if (value.reset.infillPercent !== PROJECT_PRESET_BASELINE.infillPercent) {
    fail("incomplete-draft", "Preset draft infill baseline is invalid");
  }
  if (!isRecord(value.preserved)) fail("incomplete-draft", "Preset draft preserved fields are missing");
  requireKeys(value.preserved, PRESERVED_KEYS, "incomplete-draft", "Preset draft preserved fields");

  if (catalog) {
    const currentPrinter = catalog.printers.find((item) => item.id === printer.id);
    if (!currentPrinter) fail("missing-printer", `Catalog printer ${printer.id} was removed`);
    if (currentPrinter.technology !== technology) {
      fail("technology-mismatch", `Catalog printer ${printer.id} is incompatible`);
    }
    const currentPrinterRef = makePrinterProvenance(currentPrinter, technology);
    if (
      currentPrinterRef.fingerprint !== printer.fingerprint ||
      currentPrinterRef.revision !== printer.revision ||
      currentPrinterRef.origin !== printer.origin ||
      currentPrinterRef.customized !== printer.customized
    ) {
      fail("provenance-mismatch", "Catalog printer provenance changed");
    }
    const currentMaterial = catalog.materials.find((item) => item.id === material.id);
    if (!currentMaterial) fail("missing-material", `Catalog material ${material.id} was removed`);
    if (currentMaterial.type !== technology) {
      fail("technology-mismatch", `Catalog material ${material.id} is incompatible`);
    }
    const currentMaterialRef = makeMaterialProvenance(currentMaterial, technology);
    if (
      currentMaterialRef.fingerprint !== material.fingerprint ||
      currentMaterialRef.revision !== material.revision ||
      currentMaterialRef.origin !== material.origin ||
      currentMaterialRef.customized !== material.customized
    ) {
      fail("provenance-mismatch", "Catalog material provenance changed");
    }
  }

  return value as PresetDraftV1;
}

const requirePresetNumbers = (preset: ProjectPreset): void => {
  if (preset.schemaVersion !== 1) fail("unknown-schema", "Project preset schemaVersion is unknown");
  const values = [
    preset.printParameters.printerPowerWatts,
    preset.printParameters.printTimeHours,
    preset.printParameters.failureValue,
    preset.material.weightUsed,
  ];
  if (!values.every(isFiniteNumber)) fail("invalid-preset", "Project preset contains invalid numeric values");
  if (preset.printParameters.failureMode !== "none" && preset.printParameters.failureMode !== "percent" && preset.printParameters.failureMode !== "fixed") {
    fail("invalid-preset", "Project preset failure mode is invalid");
  }
  if (preset.technology === "resin" && !isFiniteNumber(preset.material.volumeUsedMl)) {
    fail("invalid-preset", "Resin project preset is missing volumeUsedMl");
  }
};

export function resinWeightToVolume(
  weightGrams: number,
  densityGramsPerMl = RESIN_DENSITY_G_PER_ML,
): number {
  return Math.round((weightGrams / densityGramsPerMl) * 100) / 100;
}

export function hasCalculationInProgress(
  state: Pick<CalculatorState, "productName">,
): boolean {
  return state.productName.trim().length > 0;
}

const deriveMachine = (
  machine: MachineCosts,
  printer: PresetCatalogPrinter,
): MachineCosts => {
  const hoursPerMonth = machine.hoursPerMonth > 0 ? machine.hoursPerMonth : 1;
  return {
    ...clone(machine),
    machineCost: printer.value,
    depreciationMonths: Math.max(1, Math.round(printer.usefulLife / hoursPerMonth)),
    maintenanceEnabled: true,
    maintenanceCost: Math.round(printer.maintenancePerHour * hoursPerMonth),
  };
};

const buildPrintParameters = (
  current: PrintParameters,
  preset: PresetPrintParameters,
  printer: PresetCatalogPrinter,
): PrintParameters => ({
  ...clone(current),
  printerPowerWatts: printer.power,
  printTimeHours: preset.printTimeHours,
  failureMode: preset.failureMode,
  failureValue: preset.failureValue,
  riskMultiplier: preset.riskMultiplier ?? PROJECT_PRESET_BASELINE.riskMultiplier,
  heatUpTimeMinutes: preset.heatUpTimeMinutes ?? PROJECT_PRESET_BASELINE.heatUpTimeMinutes,
  heatUpPowerPercent: preset.heatUpPowerPercent ?? PROJECT_PRESET_BASELINE.heatUpPowerPercent,
});

const buildInactive = (
  state: CalculatorState,
  technology: ProjectTechnology,
): PresetPreservedFields["inactiveTechnology"] => {
  if (technology === "fdm") {
    return {
      fdm: null,
      resin: {
        material: clone(state.resinMaterial),
        printParams: clone(state.resinPrintParams),
        postProcess: clone(state.resinPostProcess),
        machine: clone(state.resinMachine),
        hardware: clone(state.resinHardware),
        labor: clone(state.resinLabor),
        extras: clone(state.resinExtras),
        ops: clone(state.resinOps),
        soft: clone(state.resinSoft),
        sales: clone(state.resinSales),
      },
    };
  }
  return {
    fdm: {
      material: clone(state.fdmMaterial),
      printParams: clone(state.fdmPrintParams),
      slicerProfile: clone(state.fdmSlicerProfile),
      filament: clone(state.fdmFilament),
      machine: clone(state.fdmMachine),
      hardware: clone(state.fdmHardware),
      finishing: clone(state.fdmFinishing),
      labor: clone(state.fdmLabor),
      extras: clone(state.fdmExtras),
      ops: clone(state.fdmOps),
      soft: clone(state.fdmSoft),
      sales: clone(state.fdmSales),
    },
    resin: null,
  };
};

export interface BuildProjectPresetDraftOptions {
  catalog: ProjectPresetCatalog;
  productName: string;
  exampleLabel?: string;
}

export function buildProjectPresetDraft(
  state: CalculatorState,
  preset: ProjectPreset,
  options: BuildProjectPresetDraftOptions,
): PresetDraftV1 {
  requirePresetNumbers(preset);
  const printer = options.catalog.printers.find((item) => item.id === preset.printerId);
  if (!printer) fail("missing-printer", `Catalog printer ${preset.printerId} was removed`);
  if (printer.technology !== preset.technology) {
    fail("technology-mismatch", `Project preset ${preset.id} has an incompatible printer`);
  }
  const material = options.catalog.materials.find((item) => item.id === preset.catalogMaterialId);
  if (!material) fail("missing-material", `Catalog material ${preset.catalogMaterialId} was removed`);
  if (material.type !== preset.technology) {
    fail("technology-mismatch", `Project preset ${preset.id} has an incompatible material`);
  }
  validatePrinterCanonical(printer, preset.technology);
  validateMaterialCanonical(material, preset.technology);

  const isFdm = preset.technology === "fdm";
  const activeMachine = isFdm ? state.fdmMachine : state.resinMachine;
  const activePrint = isFdm ? state.fdmPrintParams : state.resinPrintParams;
  const machine = deriveMachine(activeMachine, printer);
  const printParams = buildPrintParameters(activePrint, preset.printParameters, printer);
  const fdmMaterial: MaterialStateFDM = isFdm
    ? {
        ...clone(DEFAULT_FDM_MATERIAL),
        type: material.name,
        weightUsed: preset.material.weightUsed,
        purgeWeight: PROJECT_PRESET_BASELINE.purgeWeight,
        costPerKg: material.avgPrice,
        density: material.density,
        spoolEfficiency: PROJECT_PRESET_BASELINE.spoolEfficiency,
      }
    : clone(state.fdmMaterial);
  const resinMaterial: MaterialStateResin = isFdm
    ? clone(state.resinMaterial)
    : {
        ...clone(DEFAULT_RESIN_MATERIAL),
        type: material.name,
        weightUsed: preset.material.weightUsed,
        volumeUsedMl: preset.material.volumeUsedMl,
        costPerLiter: material.avgPrice,
        density: material.density,
        wasteMarginPercent: PROJECT_PRESET_BASELINE.wasteMarginPercent,
      };

  const reset: PresetResetFields = {
    activeTab: preset.technology,
    selectedPrinter: clone(printer),
    selectedPrinterId: printer.id,
    fdmMaterial,
    resinMaterial,
    fdmPrintParams: isFdm ? printParams : clone(state.fdmPrintParams),
    resinPrintParams: isFdm ? clone(state.resinPrintParams) : printParams,
    fdmMachine: isFdm ? machine : clone(state.fdmMachine),
    resinMachine: isFdm ? clone(state.resinMachine) : machine,
    fdmSlicerProfile: isFdm ? clone(DEFAULT_FDM_SLICER_PROFILE) : clone(state.fdmSlicerProfile),
    fdmFilament: isFdm ? clone(DEFAULT_FDM_FILAMENT) : clone(state.fdmFilament),
    fdmHardware: isFdm ? clone(DEFAULT_FDM_HARDWARE) : clone(state.fdmHardware),
    fdmFinishing: isFdm ? clone(DEFAULT_FDM_FINISHING) : clone(state.fdmFinishing),
    resinHardware: isFdm ? clone(state.resinHardware) : clone(DEFAULT_RESIN_HARDWARE),
    resinPostProcess: isFdm
      ? clone(state.resinPostProcess)
      : { ...clone(DEFAULT_RESIN_PP), washType: "alcohol" },
    fdmAmsEnabled: false,
    fdmAmsSlots: clone(DEFAULT_AMS_SLOTS),
    selectedSpoolId: null,
    infillPercent: PROJECT_PRESET_BASELINE.infillPercent,
    productName: addExampleLabel(options.productName, options.exampleLabel ?? "Example"),
  };

  const draft: PresetDraftV1 = {
    schemaVersion: 1,
    presetId: preset.id,
    technology: preset.technology,
    printerRef: makePrinterProvenance(printer, preset.technology),
    materialRef: makeMaterialProvenance(material, preset.technology),
    baseline: { ...PROJECT_PRESET_BASELINE },
    reset,
    preserved: {
      selectedMarketplace: clone(state.selectedMarketplace),
      selectedMarketplaceId: state.selectedMarketplace.id,
      quantity: state.quantity,
      currency: state.currency,
      fixedCosts: clone(state.fixedCosts),
      fdmLabor: clone(state.fdmLabor),
      resinLabor: clone(state.resinLabor),
      fdmExtras: clone(state.fdmExtras),
      resinExtras: clone(state.resinExtras),
      fdmOps: clone(state.fdmOps),
      resinOps: clone(state.resinOps),
      fdmSoft: clone(state.fdmSoft),
      resinSoft: clone(state.resinSoft),
      fdmSales: clone(state.fdmSales),
      resinSales: clone(state.resinSales),
      calcLevel: state.calcLevel,
      hiddenFields: [...state.hiddenFields],
      enabledSections: { ...state.enabledSections },
      targetMarginMode: state.targetMarginMode,
      inactiveTechnology: buildInactive(state, preset.technology),
    },
  };
  return validatePresetDraft(draft, options.catalog);
}

export function addExampleLabel(productName: string, exampleLabel: string): string {
  const name = productName.trim();
  const label = exampleLabel.trim();
  if (!label || name.toLocaleLowerCase().includes(label.toLocaleLowerCase())) return name;
  return `${name} (${label})`;
}

export function createProjectPresetApplicationPatch(
  draft: PresetDraftV1,
  catalog: ProjectPresetCatalog,
): Partial<CalculatorState> {
  const valid = validatePresetDraft(draft, catalog);
  const { reset, preserved } = valid;
  return {
    activeTab: reset.activeTab,
    selectedPrinter: reset.selectedPrinter as CalculatorState["selectedPrinter"],
    selectedMarketplace: preserved.selectedMarketplace,
    selectedSpoolId: null,
    fdmAmsEnabled: reset.fdmAmsEnabled,
    fdmAmsSlots: clone(reset.fdmAmsSlots),
    fixedCosts: clone(preserved.fixedCosts),
    fdmMaterial: clone(reset.fdmMaterial),
    fdmPrintParams: clone(reset.fdmPrintParams),
    fdmSlicerProfile: clone(reset.fdmSlicerProfile),
    fdmFilament: clone(reset.fdmFilament),
    fdmMachine: clone(reset.fdmMachine),
    fdmHardware: clone(reset.fdmHardware),
    fdmFinishing: clone(reset.fdmFinishing),
    fdmLabor: clone(preserved.fdmLabor),
    fdmExtras: clone(preserved.fdmExtras),
    fdmSales: clone(preserved.fdmSales),
    fdmOps: clone(preserved.fdmOps),
    fdmSoft: clone(preserved.fdmSoft),
    resinMaterial: clone(reset.resinMaterial),
    resinPrintParams: clone(reset.resinPrintParams),
    resinPostProcess: clone(reset.resinPostProcess),
    resinMachine: clone(reset.resinMachine),
    resinHardware: clone(reset.resinHardware),
    resinLabor: clone(preserved.resinLabor),
    resinExtras: clone(preserved.resinExtras),
    resinSales: clone(preserved.resinSales),
    resinOps: clone(preserved.resinOps),
    resinSoft: clone(preserved.resinSoft),
    productName: reset.productName,
    quantity: preserved.quantity,
    infillPercent: reset.infillPercent,
    targetMarginMode: preserved.targetMarginMode,
    enabledSections: { ...preserved.enabledSections },
    calcLevel: preserved.calcLevel,
    hiddenFields: [...preserved.hiddenFields],
    currency: preserved.currency,
    lastDeductedInfo: null,
  };
}

export interface ProjectPresetPreview {
  draft: PresetDraftV1;
  reset: PresetResetFields;
  preserved: PresetPreservedFields;
  results: CalculationResult;
}

export function previewProjectPreset(
  state: CalculatorState,
  draft: PresetDraftV1,
  catalog?: ProjectPresetCatalog,
): ProjectPresetPreview {
  const valid = validatePresetDraft(draft, catalog);
  const patch = catalog
    ? createProjectPresetApplicationPatch(valid, catalog)
    : createProjectPresetApplicationPatchWithoutCatalog(valid);
  const next = { ...state, ...patch, lastDeductedInfo: null };
  return {
    draft: valid,
    reset: valid.reset,
    preserved: valid.preserved,
    results: computeStoreResults(next as ComputeStoreInput),
  };
}

/** Internal path for a pure preview; application still validates against the live catalog. */
const createProjectPresetApplicationPatchWithoutCatalog = (
  draft: PresetDraftV1,
): Partial<CalculatorState> => {
  const { reset, preserved } = validatePresetDraft(draft);
  return {
    activeTab: reset.activeTab,
    selectedPrinter: reset.selectedPrinter as CalculatorState["selectedPrinter"],
    selectedMarketplace: preserved.selectedMarketplace,
    selectedSpoolId: null,
    fdmAmsEnabled: reset.fdmAmsEnabled,
    fdmAmsSlots: clone(reset.fdmAmsSlots),
    fixedCosts: clone(preserved.fixedCosts),
    fdmMaterial: clone(reset.fdmMaterial),
    fdmPrintParams: clone(reset.fdmPrintParams),
    fdmSlicerProfile: clone(reset.fdmSlicerProfile),
    fdmFilament: clone(reset.fdmFilament),
    fdmMachine: clone(reset.fdmMachine),
    fdmHardware: clone(reset.fdmHardware),
    fdmFinishing: clone(reset.fdmFinishing),
    fdmLabor: clone(preserved.fdmLabor),
    fdmExtras: clone(preserved.fdmExtras),
    fdmSales: clone(preserved.fdmSales),
    fdmOps: clone(preserved.fdmOps),
    fdmSoft: clone(preserved.fdmSoft),
    resinMaterial: clone(reset.resinMaterial),
    resinPrintParams: clone(reset.resinPrintParams),
    resinPostProcess: clone(reset.resinPostProcess),
    resinMachine: clone(reset.resinMachine),
    resinHardware: clone(reset.resinHardware),
    resinLabor: clone(preserved.resinLabor),
    resinExtras: clone(preserved.resinExtras),
    resinSales: clone(preserved.resinSales),
    resinOps: clone(preserved.resinOps),
    resinSoft: clone(preserved.resinSoft),
    productName: reset.productName,
    quantity: preserved.quantity,
    infillPercent: reset.infillPercent,
    targetMarginMode: preserved.targetMarginMode,
    enabledSections: { ...preserved.enabledSections },
    calcLevel: preserved.calcLevel,
    hiddenFields: [...preserved.hiddenFields],
    currency: preserved.currency,
    lastDeductedInfo: null,
  };
};

export type { CurrencySetting, Marketplace };
