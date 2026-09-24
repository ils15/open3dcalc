import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { INVALID_CURRENCY_MARKER } from "@/shared/lib/currency";

export interface CostSummaryCardProps {
  /** Cost per gram of the printed unit (`---` when not applicable). */
  costPerGram: number;
  /** Failure-rate allowance for this print (`---` when zero). */
  failureCost: number;
}

/**
 * Two-tile cost summary: cost per gram and the failure allowance.
 * Rendered exactly above the profit tile so the 2-col layout is preserved.
 */
export function CostSummaryCard({ costPerGram, failureCost }: CostSummaryCardProps) {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();
  const formatOptionalAmount = (value: number): string => {
    if (Number.isFinite(value) && value > 0) return fmtCurrency(value);
    if (value === 0) return "---";
    return INVALID_CURRENCY_MARKER;
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <div className="rounded-xl p-3 sm:p-5 bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center">
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5 sm:mb-1">
          {t("calc.costPerGram")}
        </div>
        <div className="text-sm sm:text-lg font-black text-[var(--cost)] font-mono">
          {formatOptionalAmount(costPerGram) +
            (Number.isFinite(costPerGram) && costPerGram > 0 ? "/g" : "")}
        </div>
      </div>
      <div className="rounded-xl p-3 sm:p-5 bg-[var(--surface-sunken)] border border-[var(--border-default)] text-center">
        <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5 sm:mb-1">
          {t("breakdown.failure")}
        </div>
        <div className="text-sm sm:text-lg font-black text-[var(--cost-failure)] font-mono">
          {formatOptionalAmount(failureCost)}
        </div>
      </div>
    </div>
  );
}
