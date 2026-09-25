import { isValidQuantity } from "./quantity";

export const INVALID_CALCULATION_STATE = "INVALID_CALCULATION_STATE" as const;

export interface InvalidCalculationStateError extends Error {
  code: typeof INVALID_CALCULATION_STATE;
}

/** Context passed to lower-level persistence stores without importing the calculator store. */
export interface CalculationStateValidationContext {
  calculationIssues: readonly unknown[];
  quantity: unknown;
}

export function createInvalidCalculationStateError(): InvalidCalculationStateError {
  const error = new Error(INVALID_CALCULATION_STATE) as InvalidCalculationStateError;
  error.name = "InvalidCalculationStateError";
  error.code = INVALID_CALCULATION_STATE;
  return error;
}

export function isInvalidCalculationStateError(
  error: unknown,
): error is InvalidCalculationStateError {
  return (
    error instanceof Error &&
    (error as Partial<InvalidCalculationStateError>).code ===
      INVALID_CALCULATION_STATE
  );
}

export function isPersistableCalculationState(
  state: CalculationStateValidationContext,
): boolean {
  return state.calculationIssues.length === 0 && isValidQuantity(state.quantity);
}

export function assertPersistableCalculationState(
  state: CalculationStateValidationContext,
): void {
  if (!isPersistableCalculationState(state)) {
    throw createInvalidCalculationStateError();
  }
}
