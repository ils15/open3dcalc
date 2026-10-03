/**
 * Robust profit and margin derivation for the Studio calculator.
 * Resolves the "price 0, profit 100%" bug regardless of user input sequence.
 *
 * Lives apart from `StudioCalculatorView` so the module only exports
 * components (fast refresh) and so a pure money calculation can be unit
 * tested without mounting the 1.6k-line view.
 */
export function deriveProfitAndMargin({
  baseCost,
  targetMarginPercent,
  customSellPrice,
}: {
  baseCost: number;
  targetMarginPercent: number;
  customSellPrice: number | null;
}): {
  sellPrice: number;
  profit: number;
  marginPercent: number;
  hasCost: boolean;
  isLoss: boolean;
} {
  if (!baseCost || baseCost <= 0) {
    const fallbackPrice =
      customSellPrice !== null && customSellPrice > 0 ? customSellPrice : 0;
    return {
      sellPrice: fallbackPrice,
      profit: 0,
      marginPercent: 0,
      hasCost: false,
      isLoss: false,
    };
  }

  if (customSellPrice !== null) {
    const profit = customSellPrice - baseCost;
    const margin = (profit / baseCost) * 100;
    return {
      sellPrice: Math.max(0, customSellPrice),
      profit: profit > 0 ? profit : 0,
      marginPercent: Math.round(margin),
      hasCost: true,
      isLoss: profit < 0,
    };
  }

  const safeMargin = Math.max(0, targetMarginPercent || 0);
  const profit = baseCost * (safeMargin / 100);
  const sellPrice = baseCost + profit;

  return {
    sellPrice,
    profit,
    marginPercent: safeMargin,
    hasCost: true,
    isLoss: false,
  };
}
