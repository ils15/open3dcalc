import type { VolumeDiscount } from "@/shared/types";
import type { CalculationValidationIssue, CalculationValidationReason } from "./calculatorStore.validation.types";

type NumberRule = {
  kind: "number";
  min?: number;
  positive?: boolean;
  integer?: boolean;
  max?: number;
};
type BooleanRule = { kind: "boolean" };
type StringRule = { kind: "string" };
type EnumRule = { kind: "enum"; values: readonly string[] };
export type FieldRule = NumberRule | BooleanRule | StringRule | EnumRule;
export type FieldRules = Record<string, FieldRule>;
export type Source = Record<string, unknown>;

const number = (options: Omit<NumberRule, "kind"> = {}): NumberRule => ({
  kind: "number",
  ...options,
});
const boolean = (): BooleanRule => ({ kind: "boolean" });
const string = (): StringRule => ({ kind: "string" });
const enumeration = (values: readonly string[]): EnumRule => ({
  kind: "enum",
  values,
});

export const MACHINE_RULES: FieldRules = {
  enabled: boolean(),
  machineCost: number(),
  depreciationMonths: number({ positive: true }),
  hoursPerMonth: number({ positive: true }),
  maintenanceEnabled: boolean(),
  maintenanceCost: number(),
};
export const FDM_HARDWARE_RULES: FieldRules = {
  enabled: boolean(),
  nozzleEnabled: boolean(),
  nozzleCost: number(),
  nozzleLifespanKg: number({ positive: true }),
  bedEnabled: boolean(),
  bedAdhesionCost: number(),
};
export const RESIN_HARDWARE_RULES: FieldRules = {
  enabled: boolean(),
  lcdCost: number(),
  lcdLifespanHours: number({ positive: true }),
  fepCost: number(),
  fepLifespanPrints: number({ positive: true }),
};
export const MATERIAL_FDM_RULES: FieldRules = {
  type: string(),
  weightUsed: number(),
  purgeWeight: number(),
  costPerKg: number(),
  density: number({ positive: true }),
  spoolEfficiency: number({ positive: true }),
};
export const MATERIAL_RESIN_RULES: FieldRules = {
  type: string(),
  volumeUsedMl: number(),
  costPerLiter: number(),
  density: number({ positive: true }),
  wasteMarginPercent: number(),
};
export const PRINT_RULES: FieldRules = {
  printTimeHours: number(),
  printerPowerWatts: number(),
  energyCostPerKwh: number(),
  failureMode: enumeration(["none", "percent", "fixed"]),
  failureValue: number(),
  riskMultiplier: number(),
  heatUpTimeMinutes: number(),
  heatUpPowerPercent: number(),
};
export const LABOR_RULES: FieldRules = {
  enabled: boolean(),
  setupTimeMinutes: number(),
  postProcessingTimeMinutes: number(),
  hourlyRate: number(),
};
export const POST_PROCESS_RULES: FieldRules = {
  washingEnabled: boolean(),
  alcoholCostPerLiter: number(),
  alcoholVolumeLiters: number(),
  washType: enumeration(["alcohol", "water"]),
  curingEnabled: boolean(),
  curingTimeMinutes: number(),
  curingPowerWatts: number(),
};
export const SALES_RULES: FieldRules = {
  packagingCost: number(),
  shippingCost: number(),
  taxPercent: number({ max: 100 }),
  marketplaceFeePercent: number({ max: 100 }),
  profitMarginPercent: number(),
};
export const OPS_RULES: FieldRules = {
  enabled: boolean(),
  ppeCostPerPrint: number(),
  carbonIntensity: number(),
};
export const SOFT_RULES: FieldRules = {
  enabled: boolean(),
  slicerMonthlyCost: number(),
  modelFileCost: number(),
};
export const FINISHING_RULES: FieldRules = { enabled: boolean(), suppliesCost: number() };
export const FIXED_RULES: FieldRules = {
  enabled: boolean(),
  monthlyCost: number(),
  monthlyPrintHours: number(),
};
export const PROFILE_RULES: FieldRules = {
  wallCount: number({ integer: true }),
  lineWidthMm: number({ positive: true }),
  topLayers: number({ integer: true }),
  bottomLayers: number({ integer: true }),
  layerHeightMm: number({ positive: true }),
  printSpeedMmPerS: number({ positive: true }),
};
export const FILAMENT_RULES: FieldRules = {
  purgePercent: number(),
  filamentDiameterMm: number({ positive: true }),
  maxVolumetricSpeedMm3PerS: number({ positive: true }),
};

export const isRecord = (value: unknown): value is Source =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const addIssue = (
  issues: CalculationValidationIssue[],
  path: string,
  reason: CalculationValidationReason,
  received: unknown,
): void => {
  issues.push({ path, reason, received });
};

function retainOrDiscardDomainValue(
  normalized: Source,
  path: string,
  key: string,
  value: number,
): void {
  if (path === "fdmSlicerProfile" || path === "fdmFilament") {
    if (key === "maxVolumetricSpeedMm3PerS") delete normalized[key];
    return;
  }
  normalized[key] = value;
}

export function normalizeSlice<T extends object>(
  source: unknown,
  fallback: T,
  path: string,
  rules: FieldRules,
  issues: CalculationValidationIssue[],
): T {
  if (source === undefined) return fallback;
  if (!isRecord(source)) {
    addIssue(issues, path, "invalid_type", source);
    return fallback;
  }

  const normalized: Source = { ...(fallback as Source) };
  for (const [key, rule] of Object.entries(rules)) {
    const value = source[key];
    if (value === undefined) continue;

    if (rule.kind === "number") {
      if (typeof value !== "number") {
        addIssue(issues, `${path}.${key}`, "invalid_type", value);
        continue;
      }
      if (!Number.isFinite(value)) {
        addIssue(issues, `${path}.${key}`, "non_finite", value);
        continue;
      }
      if (value < (rule.min ?? 0)) {
        addIssue(issues, `${path}.${key}`, "negative", value);
        retainOrDiscardDomainValue(normalized, path, key, value);
        continue;
      }
      if (rule.positive && value === 0) {
        addIssue(issues, `${path}.${key}`, "invalid_denominator", value);
        retainOrDiscardDomainValue(normalized, path, key, value);
        continue;
      }
      if (rule.integer && !Number.isInteger(value)) {
        addIssue(issues, `${path}.${key}`, "out_of_domain", value);
        retainOrDiscardDomainValue(normalized, path, key, value);
        continue;
      }
      if (rule.max !== undefined && value > rule.max) {
        addIssue(issues, `${path}.${key}`, "out_of_domain", value);
        retainOrDiscardDomainValue(normalized, path, key, value);
        continue;
      }
    } else if (rule.kind === "boolean") {
      if (typeof value !== "boolean") {
        addIssue(issues, `${path}.${key}`, "invalid_type", value);
        continue;
      }
    } else if (rule.kind === "string") {
      if (typeof value !== "string" || value.trim().length === 0) {
        addIssue(issues, `${path}.${key}`, "invalid_type", value);
        continue;
      }
    } else if (!rule.values.includes(value as string)) {
      addIssue(issues, `${path}.${key}`, "invalid_type", value);
      continue;
    }
    normalized[key] = value;
  }
  return normalized as T;
}

export function normalizeDiscounts(
  source: unknown,
  fallback: readonly VolumeDiscount[],
  path: string,
  issues: CalculationValidationIssue[],
): VolumeDiscount[] {
  if (source === undefined) return fallback.map((item) => ({ ...item }));
  if (!Array.isArray(source)) {
    addIssue(issues, path, "invalid_type", source);
    return fallback.map((item) => ({ ...item }));
  }
  return source.map((item, index) => {
    const fallbackItem = fallback[index] ?? { minQuantity: 0, discountPercent: 0 };
    return normalizeSlice(
      item,
      fallbackItem,
      `${path}[${index}]`,
      { minQuantity: number(), discountPercent: number({ max: 100 }) },
      issues,
    );
  });
}

export function normalizeSections(
  source: unknown,
  fallback: Record<string, boolean>,
  path: string,
  issues: CalculationValidationIssue[],
): Record<string, boolean> {
  if (source === undefined) return { ...fallback };
  if (!isRecord(source)) {
    addIssue(issues, path, "invalid_type", source);
    return { ...fallback };
  }
  const sections = { ...fallback };
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "boolean") {
      addIssue(issues, `${path}.${key}`, "invalid_type", value);
      continue;
    }
    sections[key] = value;
  }
  return sections;
}
