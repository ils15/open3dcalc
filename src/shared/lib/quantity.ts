/**
 * Shared domain rule for production quantities.
 *
 * A 100,000-unit batch is already far beyond a normal desktop production run,
 * while the cap keeps downstream weight and price arithmetic finite and makes
 * accidental numeric input easy to reject.
 */
export const MAX_QUANTITY = 100_000;

export const QUANTITY_RULE = {
  kind: "number",
  positive: true,
  integer: true,
  max: MAX_QUANTITY,
} as const;

/** Whether a value is a safe, positive, integral production quantity. */
export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_QUANTITY
  );
}
