import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Percent, Pencil, X } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { roundCurrency } from "@/shared/lib/currency";
import {
  deriveRealMarginPercent,
  formatRealMarginPercent,
} from "@/shared/lib/realMargin";
import type { FinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";

export interface PriceHeroCardProps {
  /** Pre-computed financial decomposition (see useFinancialBreakdown). */
  breakdown: FinancialBreakdown;
  /** Receives the new override, or `null` to clear it back to the calculated price. */
  onSellOverrideChange: (price: number | null) => void;
  /** Current commercial margin percent, when the surface can edit it. */
  marginPercent?: number;
  /** Writes a new commercial margin (recomputes the base suggested price). */
  onMarginChange?: (percent: number) => void;
}

export function PriceHeroCard({
  breakdown,
  onSellOverrideChange,
  marginPercent,
  onMarginChange,
}: PriceHeroCardProps) {
  const { t, i18n } = useTranslation();
  const { format: fmtCurrency } = useCurrency();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState(false);
  const [isEditingMargin, setIsEditingMargin] = useState(false);

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

  const { overrideCalc, fees } = breakdown;
  const targetMarkup = breakdown.targetMarkupPercent ?? 100;
  const locale = i18n.resolvedLanguage || i18n.language || "pt-BR";
  const realMargin = deriveRealMarginPercent(
    breakdown.displayProfit,
    breakdown.displaySellPrice,
  );
  const realMarginValue = formatRealMarginPercent(realMargin, locale);

  // useFinancialBreakdown exposes a flat shape; the old `breakdown.result.*`
  // reads pointed at a nested result the hook never had.
  const { totalCost, costPerGram, time } = breakdown;
  const printHours = time.estimatedHours;
  const profitPerHour =
    printHours > 0 ? breakdown.displayProfit / printHours : 0;

  return (
    <div
      data-testid="price-hero"
      /* Green-tinted hero, per the Example reference: the suggested price is
         the one optimistic surface in the panel. */
      className="rounded-2xl border border-[var(--positive)]/40 bg-[var(--positive-wash)] p-4 text-[var(--text-primary)] shadow-xl space-y-4"
    >
      {/* Header: PREÇO SUGERIDO + Badge Lucro */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--positive)]">
            {t("calc.sellPrice")}
          </span>
          {!isEditingPrice && (
            <button
              type="button"
              onClick={openPriceEditor}
              aria-label={t("calc.sellPriceEdit")}
              className="p-1 rounded-md text-[var(--positive)] hover:text-[var(--positive)] hover:bg-[var(--positive-subtle)] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Example reference: quick margin slider lives on the hero. */}
          {onMarginChange && marginPercent !== undefined && !isEditingPrice && (
            <button
              type="button"
              onClick={() => setIsEditingMargin((v) => !v)}
              aria-label={t("calc.marginQuickEdit")}
              aria-expanded={isEditingMargin}
              className={`p-1 rounded-md transition-colors ${
                isEditingMargin
                  ? "bg-[var(--positive-subtle)] text-[var(--positive)]"
                  : "text-[var(--positive)] hover:bg-[var(--positive-subtle)]"
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {overrideCalc ? (
          <>
            {/* contrast-site: price-hero-margin-label */}
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
              {t("calc.sellPriceCustom")}
            </span>
          </>
        ) : (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--positive-subtle)] text-[var(--positive)] border border-[var(--positive)]/40">
            +{targetMarkup.toFixed(0)}% LUCRO
          </span>
        )}
      </div>

      {/* Commercial context: target markup vs. the real margin actually earned */}
      <div
        data-testid="commercial-context"
        className="flex items-center justify-center gap-3 text-[10px] font-mono text-[var(--text-muted)]"
      >
        <span>
          {t("calc.markupTarget")}: <strong>{targetMarkup.toFixed(0)}%</strong>
        </span>
        <span>
          {t("calc.actualMargin")}:{" "}
          <strong className="text-[var(--positive)]">{realMarginValue}</strong>
        </span>
        {overrideCalc && (
          <span>
            {t("calc.effectiveMarkup")}:{" "}
            <strong>{overrideCalc.markupEffective.toFixed(0)}%</strong>
          </span>
        )}
      </div>

      {overrideCalc?.belowBreakEven && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--critical)]/70 bg-[var(--critical-subtle)] px-3 py-2 text-[11px] font-mono text-[var(--critical)]"
        >
          {t("calc.belowBreakEven", {
            value: fmtCurrency(breakdown.breakEvenPrice),
          })}
        </div>
      )}

      {priceError && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--warning)]/70 bg-[var(--warning-subtle)] px-3 py-2 text-[11px] font-mono text-[var(--warning)]"
        >
          {t("calc.sellPriceInvalid")}
        </div>
      )}

      {/* Main Price */}
      {isEditingPrice ? (
        <div className="flex items-center justify-center gap-2 py-1">
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
              if (e.key === "Escape") {
                e.preventDefault();
                handleCancelPrice();
              }
            }}
            className="w-36 px-3 py-1.5 rounded-xl text-center text-xl font-mono font-bold bg-[var(--surface-input)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
          {/* contrast-site: price-hero-confirm-price-button */}
          <button
            type="button"
            onClick={handleConfirmPrice}
            aria-label={t("calc.sellPriceConfirm")}
            className="p-2 rounded-xl bg-[var(--positive-fill)] text-[var(--positive-fill-fg)] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelPrice}
            aria-label={t("calc.sellPriceCancel")}
            className="p-2 rounded-xl bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-canvas)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="text-center py-1">
          <span
            data-testid="price-hero-value"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] font-mono"
          >
            {fmtCurrency(breakdown.displaySellPrice)}
          </span>
        </div>
      )}

      {/* Quick margin slider (Example reference): recomputes the base price
          live; a set override keeps overriding and stays labelled custom. */}
      {isEditingMargin && onMarginChange && marginPercent !== undefined && (
        <div className="mt-1 space-y-1 border-t border-[var(--positive)]/30 pt-2">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
            <span>{t("calc.marginQuickLabel")}</span>
            <span className="font-mono font-bold text-[var(--positive)]">
              {marginPercent}%
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={marginPercent}
            onChange={(e) => onMarginChange(Number(e.target.value))}
            aria-label={t("calc.marginQuickEdit")}
            className="h-1.5 w-full cursor-pointer rounded bg-[var(--positive)]/20 accent-[var(--positive)]"
          />
        </div>
      )}

      {/* Calculated fees — hidden while an override recomputes them */}
      {!overrideCalc && (
        <div
          data-testid="fee-breakdown"
          className="flex items-center justify-center gap-3 text-[10px] font-mono text-[var(--text-muted)]"
        >
          <span>
            {t("bento.fields.taxAmount")}: {fmtCurrency(fees.taxAmount)}
          </span>
          <span>
            {t("bento.fields.marketplaceFeeAmount")}:{" "}
            {fmtCurrency(fees.marketplaceFee)}
          </span>
          <span>
            {t("bento.fields.totalFees")}: {fmtCurrency(fees.total)}
          </span>
        </div>
      )}

      {!overrideCalc && fees.hasFees && (
        <p className="text-center text-[10px] font-mono text-[var(--text-muted)]">
          {t("calc.taxesAndFeesIncluded", { value: fmtCurrency(fees.total) })}
        </p>
      )}

      {/* Two Metric Sub-Boxes: Custo de Produção & Lucro Líquido */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border-default)]">
        <div className="p-2.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-0.5">
            {t("results.hero.productionCost")}
          </span>
          <span className="text-sm font-bold font-mono text-[var(--text-primary)] block">
            {fmtCurrency(totalCost)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
            {fmtCurrency(costPerGram)}/g
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-0.5">
            {t("results.hero.netProfit")}
          </span>
          <span className="text-sm font-bold font-mono text-[var(--positive)] block">
            {fmtCurrency(breakdown.displayProfit)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
            {fmtCurrency(profitPerHour)}/h máquina
          </span>
        </div>
      </div>

      {overrideCalc && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={handleResetPrice}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
          >
            {t("calc.sellPriceReset")}
          </button>
        </div>
      )}
    </div>
  );
}
