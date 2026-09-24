import type { CalculationResult } from "@/shared/types";
import type { ComputeStoreInput } from "./calculatorStore.types";

export type CalculationValidationReason =
  | "non_finite"
  | "negative"
  | "invalid_denominator"
  | "invalid_type"
  | "out_of_domain";

export type CalculationValidationIssue = {
  path: string;
  reason: CalculationValidationReason;
  received: unknown;
};

export type CalculationValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: CalculationValidationIssue[] };

export type NormalizedCalculationInput = {
  input: ComputeStoreInput;
  validation: CalculationValidationResult;
};

export type ComputedBoundaryResult = {
  input: ComputeStoreInput;
  results: CalculationResult | null;
  calculationIssues: CalculationValidationIssue[];
};
