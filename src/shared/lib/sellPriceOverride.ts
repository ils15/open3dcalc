import { roundCurrency } from "@/shared/lib/currency";

export interface SellPriceOverrideResult {
  sellPrice: number;
  baseCost: number;
  taxAmount: number;
  marketplaceFee: number;
  profit: number;
  /** Net margin over the sell price, in percent. */
  marginReal: number;
  /** Markup over the base cost, in percent. */
  markupEffective: number;
  /** True when the overridden price is below break-even. Warn-only. */
  belowBreakEven: boolean;
}

function num(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/**
 * Pure reverse-pricing helper for the display-local sell-price override.
 *
 * Given a manually entered sell price S:
 * - tax = S * taxPercent / 100
 * - fee = S * marketplaceFeePercent / 100
 * - profit = S - base - tax - fee
 * - marginReal = profit / S * 100 (0 when S <= 0)
 * - markupEffective = profit / base * 100 (0 when base <= 0)
 *
 * Never returns NaN: non-finite inputs are sanitized to 0 and all
 * monetary outputs are rounded to 2 decimals.
 */
export function reverseFromSellPrice(
  sellPrice: number,
  baseCost: number,
  taxPercent: number,
  marketplaceFeePercent: number,
): SellPriceOverrideResult {
  const s = Math.max(0, num(sellPrice));
  const base = Math.max(0, num(baseCost));
  const taxPct = Math.max(0, num(taxPercent));
  const feePct = Math.max(0, num(marketplaceFeePercent));

  const taxAmount = roundCurrency((s * taxPct) / 100);
  const marketplaceFee = roundCurrency((s * feePct) / 100);
  const profit = roundCurrency(s - base - taxAmount - marketplaceFee);
  const marginReal = s > 0 ? roundCurrency((profit / s) * 100) : 0;
  const markupEffective = base > 0 ? roundCurrency((profit / base) * 100) : 0;

  return {
    sellPrice: s,
    baseCost: base,
    taxAmount,
    marketplaceFee,
    profit,
    marginReal,
    markupEffective,
    belowBreakEven: s < base,
  };
}
