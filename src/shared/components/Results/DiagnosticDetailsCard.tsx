import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { MaterialComparison } from "@/shared/components/Calculator/MaterialComparison";
import { CostSummaryCard } from "./CostSummaryCard";

export interface DiagnosticDetailsCardProps {
  readonly costPerGram: number;
  readonly failureCost: number;
  readonly profitPerHour: number;
  /** Configured percentage failure rate, when the active mode is percentage-based. */
  readonly failureRatePercent?: number | null;
}

const formatPercent = (value: number | null | undefined): string =>
  value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;

/** Native disclosure for secondary result diagnostics. */
export function DiagnosticDetailsCard({
  costPerGram,
  failureCost,
  profitPerHour,
  failureRatePercent,
}: DiagnosticDetailsCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const descriptionId = useId();

  return (
    <details
      data-testid="diagnostic-details"
      className="group min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)]"
    >
      <summary
        aria-describedby={descriptionId}
        className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset sm:px-4"
      >
        <span className="flex min-w-0 flex-col">
          <span>{t("results.details")}</span>
          <span
            id={descriptionId}
            className="truncate text-xs font-normal text-[var(--text-muted)]"
          >
            {t("results.detailsDescription")}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="min-w-0 space-y-4 border-t border-[var(--border-default)] p-3 sm:p-4">
        <CostSummaryCard costPerGram={costPerGram} failureCost={failureCost} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            data-testid="diagnostic-failure-rate"
            className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
          >
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              {t("results.failureRate")}
            </p>
            <p
              aria-label={`${t("results.failureRate")}: ${formatPercent(failureRatePercent)}`}
              className="mt-1 font-mono text-lg font-black text-[var(--cost-failure)]"
            >
              {formatPercent(failureRatePercent)}
            </p>
          </div>
          <div
            data-testid="diagnostic-profit-per-hour"
            className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
          >
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              {t("calc.profitPerHour")}
            </p>
            <p
              aria-label={`${t("calc.profitPerHour")}: ${formatCurrency(profitPerHour)}/h`}
              className="mt-1 font-mono text-lg font-black text-[var(--margin)]"
            >
              {formatCurrency(profitPerHour)}/h
            </p>
          </div>
        </div>
        <MaterialComparison />
      </div>
    </details>
  );
}
