export const SAFE_MARGIN_PLACEHOLDER = "—" as const;

/**
 * Derives the net margin over the customer's sell price for display only.
 *
 * The input `profitMarginPercent` remains the store's cost-markup premise;
 * this value must never be persisted back to the calculator store.
 */
export function deriveRealMarginPercent(
  profit: number,
  sellPrice: number,
): number | null {
  if (
    !Number.isFinite(profit) ||
    !Number.isFinite(sellPrice) ||
    sellPrice <= 0
  ) {
    return null;
  }

  const margin = (profit / sellPrice) * 100;
  return Number.isFinite(margin) ? margin : null;
}

/** Formats a derived margin, using a safe text placeholder when unavailable. */
export function formatRealMarginPercent(
  margin: number | null,
  locale = "pt-BR",
  placeholder: string = SAFE_MARGIN_PLACEHOLDER,
): string {
  if (margin === null || !Number.isFinite(margin)) {
    return placeholder;
  }

  return `${margin.toLocaleString(locale, {
    maximumFractionDigits: 2,
  })}%`;
}
