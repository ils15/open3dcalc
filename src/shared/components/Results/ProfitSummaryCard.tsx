import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";

export interface ProfitSummaryCardProps {
  /** Break-even (total) cost — the baseline the profit is measured against. */
  totalCost: number;
  /** Profit at the currently displayed sell price (override-aware). */
  profit: number;
  /** Net profit per billable hour (`profitPerHour` from the result). */
  profitPerHour: number;
}

/**
 * Break-even + profit tile pair. The profit per hour is exposed as a
 * keyboard-focusable note (tabIndex 0) with an accessible label so screen
 * readers announce it even though it renders as a small dotted underline.
 */
export function ProfitSummaryCard({
  totalCost,
  profit,
  profitPerHour,
}: ProfitSummaryCardProps) {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <div className="rounded-xl p-3 sm:p-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5 sm:mb-1">
          {t("calc.totalCost")}
        </div>
        <div className="text-base sm:text-xl font-black text-[var(--color-success)] font-mono">
          {fmtCurrency(totalCost)}
        </div>
      </div>
      <div className="rounded-xl p-3 sm:p-5 bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/30 text-center">
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-warning)]/70 mb-0.5 sm:mb-1">
          {t("calc.profit")}
        </div>
        <div className="text-base sm:text-xl font-black text-[var(--color-warning)] font-mono">
          {fmtCurrency(profit)}
        </div>
        <span
          tabIndex={0}
          role="note"
          title={t("calc.profitPerHourTooltip")}
          aria-label={`${t("calc.profitPerHour")}: ${fmtCurrency(profitPerHour)}/h. ${t("calc.profitPerHourTooltip")}`}
          className="mt-1 inline-block text-[11px] sm:text-xs font-mono font-semibold text-[var(--color-warning)]/80 underline decoration-dotted underline-offset-2 cursor-help focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded"
        >
          {fmtCurrency(profitPerHour)}/h
        </span>
      </div>
    </div>
  );
}
