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
  const isNegative = profit < 0;
  const profitSurfaceClass = isNegative
    ? "bg-[var(--critical-subtle)] border-[var(--margin-negative)]/30"
    : "bg-[var(--info-subtle)] border-[var(--margin)]/30";
  const profitTextClass = isNegative
    ? "text-[var(--margin-negative)]"
    : "text-[var(--margin)]";

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <div className="rounded-xl p-3 sm:p-5 bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center">
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5 sm:mb-1">
          {t("calc.totalCost")}
        </div>
        <div className="text-base sm:text-xl font-black text-[var(--cost)] font-mono">
          {fmtCurrency(totalCost)}
        </div>
      </div>
      <div className={`rounded-xl p-3 sm:p-5 ${profitSurfaceClass} text-center`}>
        <div className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${profitTextClass}/70 mb-0.5 sm:mb-1`}>
          {t("calc.profit")}
        </div>
        <div className={`text-base sm:text-xl font-black ${profitTextClass} font-mono`}>
          {fmtCurrency(profit)}
        </div>
        <span
          tabIndex={0}
          role="note"
          title={t("calc.profitPerHourTooltip")}
          aria-label={`${t("calc.profitPerHour")}: ${fmtCurrency(profitPerHour)}/h. ${t("calc.profitPerHourTooltip")}`}
          className={`mt-1 inline-block text-[11px] sm:text-xs font-mono font-semibold ${profitTextClass}/80 underline decoration-dotted underline-offset-2 cursor-help focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded`}
        >
          {fmtCurrency(profitPerHour)}/h
        </span>
      </div>
    </div>
  );
}
