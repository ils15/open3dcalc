import type { ProductFormData } from "@/shared/types/product";
import { roundCurrency } from "@/shared/lib/currency";

export interface CalculatorToProductInput {
  /** Trimmed upstream; empty names throw (the UI prompts first). */
  productName: string;
  unitWeight: number;
  /** Active single spool material (multi-filament is a follow-up). */
  filamentType: string;
  /** Calculator total cost → product cost price. */
  totalCost: number;
  /** On-screen price (includes the sell-price override when active). */
  displaySellPrice: number;
}

function nonNegative(v: number): number {
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

/**
 * Pure mapper: calculator state → product form data.
 * Throws when the product name is blank — the caller must prompt
 * for a name before invoking (see ResultsPanel bridge).
 */
export function calculatorToProduct(
  input: CalculatorToProductInput,
): ProductFormData {
  const name = input.productName.trim();
  if (!name) {
    throw new Error("calculatorToProduct: productName must not be empty");
  }
  return {
    name,
    weightGrams: roundCurrency(nonNegative(input.unitWeight)),
    filamentType: input.filamentType.trim(),
    costPrice: roundCurrency(nonNegative(input.totalCost)),
    salePrice: roundCurrency(nonNegative(input.displaySellPrice)),
  };
}

/**
 * Duplicate-name check (warn-only, never blocks saving).
 * Comparison is case- and whitespace-insensitive.
 */
export function isDuplicateProductName(
  name: string,
  products: Pick<{ name: string }, "name">[] | { name: string }[],
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return products.some((p) => p.name.trim().toLowerCase() === needle);
}
