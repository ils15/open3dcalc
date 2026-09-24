import { QUANTITY_RULE } from "@/shared/lib/quantity";
import type { SalesParameters } from "@/shared/types";
import type { ComputeStoreInput } from "./calculatorStore.types";
import {
  DEFAULT_FDM_FILAMENT,
  DEFAULT_FDM_FINISHING,
  DEFAULT_FDM_HARDWARE,
  DEFAULT_FDM_MACHINE,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_FDM_PARAMS,
  DEFAULT_FDM_SLICER_PROFILE,
  DEFAULT_EXTRAS,
  DEFAULT_FIXED_COSTS,
  DEFAULT_LABOR,
  DEFAULT_OPS,
  DEFAULT_RESIN_EXTRAS,
  DEFAULT_RESIN_HARDWARE,
  DEFAULT_RESIN_LABOR,
  DEFAULT_RESIN_MATERIAL,
  DEFAULT_RESIN_MACHINE,
  DEFAULT_RESIN_OPS,
  DEFAULT_RESIN_PP,
  DEFAULT_RESIN_PARAMS,
  DEFAULT_RESIN_SALES,
  DEFAULT_RESIN_SOFT,
  DEFAULT_SALES,
  DEFAULT_SOFT,
} from "./calculatorStore.defaults";
import type {
  CalculationValidationIssue,
  CalculationValidationResult,
  NormalizedCalculationInput,
} from "./calculatorStore.validation.types";
import {
  addIssue,
  FDM_HARDWARE_RULES,
  FILAMENT_RULES,
  FIXED_RULES,
  FINISHING_RULES,
  isRecord,
  LABOR_RULES,
  MACHINE_RULES,
  MATERIAL_FDM_RULES,
  MATERIAL_RESIN_RULES,
  normalizeDiscounts,
  normalizeSections,
  normalizeSlice,
  OPS_RULES,
  POST_PROCESS_RULES,
  PRINT_RULES,
  PROFILE_RULES,
  RESIN_HARDWARE_RULES,
  SALES_RULES,
  SOFT_RULES,
  type Source,
} from "./calculatorStore.validation.rules";

function defaultInput(): ComputeStoreInput {
  return {
    activeTab: "fdm",
    fdmMaterial: { ...DEFAULT_FDM_MATERIAL },
    fdmPrintParams: { ...DEFAULT_FDM_PARAMS },
    fdmSlicerProfile: { ...DEFAULT_FDM_SLICER_PROFILE },
    fdmFilament: { ...DEFAULT_FDM_FILAMENT },
    fdmMachine: { ...DEFAULT_FDM_MACHINE },
    fdmHardware: { ...DEFAULT_FDM_HARDWARE },
    fdmFinishing: { ...DEFAULT_FDM_FINISHING },
    fdmLabor: { ...DEFAULT_LABOR },
    fdmExtras: { ...DEFAULT_EXTRAS },
    fdmSales: {
      ...DEFAULT_SALES,
      volumeDiscounts: DEFAULT_SALES.volumeDiscounts.map((d) => ({ ...d })),
    },
    fdmOps: { ...DEFAULT_OPS },
    fdmSoft: { ...DEFAULT_SOFT },
    resinMaterial: { ...DEFAULT_RESIN_MATERIAL },
    resinPrintParams: { ...DEFAULT_RESIN_PARAMS },
    resinPostProcess: { ...DEFAULT_RESIN_PP },
    resinMachine: { ...DEFAULT_RESIN_MACHINE },
    resinHardware: { ...DEFAULT_RESIN_HARDWARE },
    resinLabor: { ...DEFAULT_RESIN_LABOR },
    resinExtras: { ...DEFAULT_RESIN_EXTRAS },
    resinSales: {
      ...DEFAULT_RESIN_SALES,
      volumeDiscounts: DEFAULT_RESIN_SALES.volumeDiscounts.map((d) => ({ ...d })),
    },
    resinOps: { ...DEFAULT_RESIN_OPS },
    resinSoft: { ...DEFAULT_RESIN_SOFT },
    quantity: 1,
    enabledSections: {},
    fixedCosts: { ...DEFAULT_FIXED_COSTS },
  };
}

export function createDefaultComputeInput(): ComputeStoreInput {
  return defaultInput();
}

function normalizeSales(
  source: unknown,
  fallback: SalesParameters,
  path: string,
  issues: CalculationValidationIssue[],
): SalesParameters {
  const normalized = normalizeSlice(
    source,
    { ...fallback, volumeDiscounts: fallback.volumeDiscounts },
    path,
    SALES_RULES,
    issues,
  );
  const raw = isRecord(source) ? source : undefined;
  return {
    ...normalized,
    volumeDiscounts: normalizeDiscounts(
      raw?.volumeDiscounts,
      fallback.volumeDiscounts,
      `${path}.volumeDiscounts`,
      issues,
    ),
  };
}

function addCrossFieldIssues(
  input: ComputeStoreInput,
  issues: CalculationValidationIssue[],
): void {
  const addIfMissing = (path: string): void => {
    if (!issues.some((issue) => issue.path === path)) {
      addIssue(issues, path, "invalid_denominator", 0);
    }
  };
  if (input.fdmMachine.enabled && input.fdmMachine.depreciationMonths === 0) {
    addIfMissing("fdmMachine.depreciationMonths");
  }
  if (
    (input.fdmMachine.enabled || input.fdmMachine.maintenanceEnabled || input.fdmSoft.enabled) &&
    input.fdmMachine.hoursPerMonth === 0
  ) {
    addIfMissing("fdmMachine.hoursPerMonth");
  }
  if (input.resinMachine.enabled && input.resinMachine.depreciationMonths === 0) {
    addIfMissing("resinMachine.depreciationMonths");
  }
  if (
    (input.resinMachine.enabled || input.resinMachine.maintenanceEnabled || input.resinSoft.enabled) &&
    input.resinMachine.hoursPerMonth === 0
  ) {
    addIfMissing("resinMachine.hoursPerMonth");
  }
  if (input.fdmHardware.enabled && input.fdmHardware.nozzleEnabled && input.fdmHardware.nozzleLifespanKg === 0) {
    addIfMissing("fdmHardware.nozzleLifespanKg");
  }
  if (input.resinHardware.enabled && input.resinHardware.lcdLifespanHours === 0) {
    addIfMissing("resinHardware.lcdLifespanHours");
  }
  if (input.resinHardware.enabled && input.resinHardware.fepLifespanPrints === 0) {
    addIfMissing("resinHardware.fepLifespanPrints");
  }
  if (input.fixedCosts.enabled && input.fixedCosts.monthlyPrintHours === 0) {
    addIfMissing("fixedCosts.monthlyPrintHours");
  }
}

export function normalizeCalculationInput(
  source: unknown,
  fallback: ComputeStoreInput = createDefaultComputeInput(),
): NormalizedCalculationInput {
  const raw: Source = isRecord(source) ? source : {};
  const issues: CalculationValidationIssue[] = [];
  if (source !== undefined && !isRecord(source)) {
    addIssue(issues, "$", "invalid_type", source);
  }

  const input: ComputeStoreInput = {
    ...fallback,
    activeTab:
      raw.activeTab === "resin" || raw.activeTab === "fdm"
        ? raw.activeTab
        : fallback.activeTab,
    fdmMaterial: normalizeSlice(raw.fdmMaterial, fallback.fdmMaterial, "fdmMaterial", MATERIAL_FDM_RULES, issues),
    fdmPrintParams: normalizeSlice(raw.fdmPrintParams, fallback.fdmPrintParams, "fdmPrintParams", PRINT_RULES, issues),
    fdmSlicerProfile: normalizeSlice(
      raw.fdmSlicerProfile,
      fallback.fdmSlicerProfile ?? { ...DEFAULT_FDM_SLICER_PROFILE },
      "fdmSlicerProfile",
      PROFILE_RULES,
      issues,
    ),
    fdmFilament: normalizeSlice(
      raw.fdmFilament,
      fallback.fdmFilament ?? { ...DEFAULT_FDM_FILAMENT },
      "fdmFilament",
      FILAMENT_RULES,
      issues,
    ),
    fdmMachine: normalizeSlice(raw.fdmMachine, fallback.fdmMachine, "fdmMachine", MACHINE_RULES, issues),
    fdmHardware: normalizeSlice(raw.fdmHardware, fallback.fdmHardware, "fdmHardware", FDM_HARDWARE_RULES, issues),
    fdmFinishing: normalizeSlice(raw.fdmFinishing, fallback.fdmFinishing, "fdmFinishing", FINISHING_RULES, issues),
    fdmLabor: normalizeSlice(raw.fdmLabor, fallback.fdmLabor, "fdmLabor", LABOR_RULES, issues),
    fdmExtras: normalizeSlice(raw.fdmExtras, fallback.fdmExtras, "fdmExtras", { extrasCost: { kind: "number" } }, issues),
    fdmSales: normalizeSales(raw.fdmSales, fallback.fdmSales, "fdmSales", issues),
    fdmOps: normalizeSlice(raw.fdmOps, fallback.fdmOps, "fdmOps", OPS_RULES, issues),
    fdmSoft: normalizeSlice(raw.fdmSoft, fallback.fdmSoft, "fdmSoft", SOFT_RULES, issues),
    resinMaterial: normalizeSlice(raw.resinMaterial, fallback.resinMaterial, "resinMaterial", MATERIAL_RESIN_RULES, issues),
    resinPrintParams: normalizeSlice(raw.resinPrintParams, fallback.resinPrintParams, "resinPrintParams", PRINT_RULES, issues),
    resinPostProcess: normalizeSlice(raw.resinPostProcess, fallback.resinPostProcess, "resinPostProcess", POST_PROCESS_RULES, issues),
    resinMachine: normalizeSlice(raw.resinMachine, fallback.resinMachine, "resinMachine", MACHINE_RULES, issues),
    resinHardware: normalizeSlice(raw.resinHardware, fallback.resinHardware, "resinHardware", RESIN_HARDWARE_RULES, issues),
    resinLabor: normalizeSlice(raw.resinLabor, fallback.resinLabor, "resinLabor", LABOR_RULES, issues),
    resinExtras: normalizeSlice(raw.resinExtras, fallback.resinExtras, "resinExtras", { extrasCost: { kind: "number" } }, issues),
    resinSales: normalizeSales(raw.resinSales, fallback.resinSales, "resinSales", issues),
    resinOps: normalizeSlice(raw.resinOps, fallback.resinOps, "resinOps", OPS_RULES, issues),
    resinSoft: normalizeSlice(raw.resinSoft, fallback.resinSoft, "resinSoft", SOFT_RULES, issues),
    quantity: normalizeSlice(
      { quantity: raw.quantity },
      { quantity: fallback.quantity },
      "quantity",
      { quantity: QUANTITY_RULE },
      issues,
    ).quantity,
    enabledSections: normalizeSections(raw.enabledSections, fallback.enabledSections, "enabledSections", issues),
    fixedCosts: normalizeSlice(raw.fixedCosts, fallback.fixedCosts, "fixedCosts", FIXED_RULES, issues),
  };

  if (raw.activeTab !== undefined && raw.activeTab !== "fdm" && raw.activeTab !== "resin") {
    addIssue(issues, "activeTab", "invalid_type", raw.activeTab);
  }
  if (raw.fdmAmsEnabled !== undefined && typeof raw.fdmAmsEnabled !== "boolean") {
    addIssue(issues, "fdmAmsEnabled", "invalid_type", raw.fdmAmsEnabled);
  }
  addCrossFieldIssues(input, issues);
  const validation: CalculationValidationResult =
    issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
  return { input, validation };
}
