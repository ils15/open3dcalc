import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, X } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { roundCurrency } from "@/shared/lib/currency";
import type { FinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";

export interface PriceHeroCardProps {
  /** Pre-computed financial decomposition (see useFinancialBreakdown). */
  breakdown: FinancialBreakdown;
  /** Receives the new override, or `null` to clear it back to the calculated price. */
  onSellOverrideChange: (price: number | null) => void;
}

/**
 * Sell-price hero with the display-local price override (issue #85).
 *
 * The override never writes back to the store — the global margin stays
 * untouched and only this card re-derives profit/margin/markup from the
 * entered price, via the pre-computed `breakdown.overrideCalc`.
 */
export function PriceHeroCard({
  breakdown,
  onSellOverrideChange,
}: PriceHeroCardProps) {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState(false);

  const openPriceEditor = () => {
    setPriceDraft(String(breakdown.displaySellPrice));
    setPriceError(false);
    setIsEditingPrice(true);
  };

  const handleConfirmPrice = () => {
    const parsed = parseFloat(priceDraft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPriceError(true);
      return;
    }
    setPriceError(false);
    onSellOverrideChange(roundCurrency(parsed));
    setIsEditingPrice(false);
  };

  const handleCancelPrice = () => {
    setIsEditingPrice(false);
    setPriceError(false);
  };

  const handleResetPrice = () => {
    onSellOverrideChange(null);
  };

  const { overrideCalc, fees, breakEvenPrice } = breakdown;

  return (
    <div className="result-hero rounded-xl p-3 sm:p-5 text-center">
      <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--revenue)]/70">
          {t("calc.sellPrice")}
        </div>
        {!isEditingPrice && (
          <button
            type="button"
            onClick={openPriceEditor}
            aria-label={t("calc.sellPriceEdit")}
            className="p-1.5 rounded-lg text-[var(--revenue)]/70 hover:text-[var(--revenue)] hover:bg-[var(--revenue)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {isEditingPrice ? (
        <div className="flex items-center justify-center gap-2">
          <label htmlFor="sell-price-override" className="sr-only">
            {t("calc.sellPriceInputLabel")}
          </label>
          <input
            id="sell-price-override"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            autoFocus
            value={priceDraft}
            onChange={(e) => setPriceDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmPrice();
              if (e.key === "Escape") handleCancelPrice();
            }}
            aria-label={t("calc.sellPriceInputLabel")}
            aria-invalid={priceError}
            aria-describedby={priceError ? "sell-price-error" : undefined}
            className="w-36 sm:w-44 px-3 py-2 rounded-xl text-center text-lg sm:text-xl font-mono font-bold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={handleConfirmPrice}
            aria-label={t("calc.sellPriceConfirm")}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-[var(--positive)] text-[var(--text-inverse)] hover:bg-[var(--positive)]/90 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--positive)] focus-visible:outline-none flex items-center justify-center"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelPrice}
            aria-label={t("calc.sellPriceCancel")}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight leading-none text-[var(--text-primary)]">
          {fmtCurrency(breakdown.displaySellPrice)}
        </div>
      )}
      {priceError && isEditingPrice && (
        <p
          id="sell-price-error"
          role="alert"
          className="text-xs sm:text-sm text-[var(--critical)] mt-2"
        >
          {t("calc.sellPriceInvalid")}
        </p>
      )}
      {overrideCalc ? (
        <div className="mt-2 space-y-1.5">
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
            {t("calc.sellPriceCustom")}
          </span>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            {t("calc.profit")}: {fmtCurrency(overrideCalc.profit)} ·{" "}
            {t("calc.actualMargin")}: {overrideCalc.marginReal.toFixed(1)}% ·{" "}
            {t("calc.effectiveMarkup")}:{" "}
            {overrideCalc.markupEffective.toFixed(1)}%
          </p>
          {overrideCalc.belowBreakEven && (
            <p
              role="alert"
              className="text-xs sm:text-sm font-semibold text-[var(--margin-negative)]"
            >
              {t("calc.belowBreakEven", {
                value: fmtCurrency(breakEvenPrice),
              })}
            </p>
          )}
          <button
            type="button"
            onClick={handleResetPrice}
            className="text-[11px] sm:text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded"
          >
            {t("calc.sellPriceReset")}
          </button>
        </div>
      ) : (
        fees.hasFees && (
          <div className="text-xs sm:text-sm text-[var(--revenue)]/80 mt-2">
            {t("calc.taxesAndFeesIncluded", {
              value: fmtCurrency(fees.taxAmount),
            })}
          </div>
        )
      )}
    </div>
  );
}
