import type { CalculationResult } from "@/shared/types";
import { computeStoreResults } from "./calculatorStore.compute";
import type { ComputeStoreInput } from "./calculatorStore.types";
import {
  createDefaultComputeInput,
  normalizeCalculationInput,
} from "./calculatorStore.validation.normalize";
import type {
  ComputedBoundaryResult,
  CalculationValidationIssue,
  CalculationValidationResult,
} from "./calculatorStore.validation.types";
import { addIssue } from "./calculatorStore.validation.rules";

const RESULT_NUMERIC_FIELDS: readonly (keyof CalculationResult)[] = [
  "materialCost",
  "energyCost",
  "machineCost",
  "hardwareCost",
  "consumablesCost",
  "laborCost",
  "softwareCost",
  "failureCost",
  "extrasCost",
  "postProcessingCost",
  "subtotal",
  "totalCost",
  "sellPrice",
  "profit",
  "marketplaceFee",
  "taxAmount",
  "costPerGram",
  "costPerUnit",
  "unitWeight",
  "estimatedPrintTime",
  "targetMarginPercent",
  "breakEvenPrice",
  "actualMargin",
  "carbonFootprintGrams",
  "profitPerHour",
  "totalHoursForProfit",
];

export function validateCalculationResult(
  result: CalculationResult | null | undefined,
): CalculationValidationResult {
  if (!result) return { valid: true, issues: [] };
  const issues: CalculationValidationIssue[] = [];
  for (const field of RESULT_NUMERIC_FIELDS) {
    const value = result[field];
    if (value !== undefined && !Number.isFinite(value)) {
      addIssue(issues, `results.${String(field)}`, "non_finite", value);
    }
  }
  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

export function computeValidatedStoreResults(
  source: unknown,
  fallback: ComputeStoreInput = createDefaultComputeInput(),
): ComputedBoundaryResult {
  const normalized = normalizeCalculationInput(source, fallback);
  const calculated = computeStoreResults(normalized.input);
  const resultValidation = validateCalculationResult(calculated);
  const calculationIssues = [
    ...normalized.validation.issues,
    ...resultValidation.issues,
  ];
  return {
    input: normalized.input,
    results: resultValidation.valid ? calculated : null,
    calculationIssues,
  };
}
