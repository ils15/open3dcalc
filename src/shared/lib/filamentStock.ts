export const INSUFFICIENT_FILAMENT_STOCK =
  "INSUFFICIENT_FILAMENT_STOCK" as const;
export const FILAMENT_SPOOL_NOT_FOUND = "FILAMENT_SPOOL_NOT_FOUND" as const;

export type FilamentStockErrorCode =
  | typeof INSUFFICIENT_FILAMENT_STOCK
  | typeof FILAMENT_SPOOL_NOT_FOUND;

export interface FilamentStockError extends Error {
  code: FilamentStockErrorCode;
  required?: number;
  available?: number;
}

export function createFilamentStockError(
  code: FilamentStockErrorCode,
  details: { required?: number; available?: number } = {},
): FilamentStockError {
  const error = new Error(code) as FilamentStockError;
  error.name = "FilamentStockError";
  error.code = code;
  if (details.required !== undefined) error.required = details.required;
  if (details.available !== undefined) error.available = details.available;
  return error;
}

export function isInsufficientFilamentStockError(
  error: unknown,
): error is FilamentStockError {
  return (
    error instanceof Error &&
    (error as Partial<FilamentStockError>).code ===
      INSUFFICIENT_FILAMENT_STOCK
  );
}

export function isFilamentSpoolNotFoundError(
  error: unknown,
): error is FilamentStockError {
  return (
    error instanceof Error &&
    (error as Partial<FilamentStockError>).code === FILAMENT_SPOOL_NOT_FOUND
  );
}

export function assertSufficientFilamentStock(
  available: number,
  required: number,
): void {
  if (available < required) {
    throw createFilamentStockError(INSUFFICIENT_FILAMENT_STOCK, {
      available,
      required,
    });
  }
}
