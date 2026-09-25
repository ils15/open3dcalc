import { Suspense, useId } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "@/shared/components/Dashboard/RechartsLazy";

import { useCurrency } from "@/shared/hooks/useCurrency";
import type { CostCategory, CostSegment } from "@/shared/hooks/useFinancialBreakdown";

export interface CostBreakdownCardProps {
  /** Pre-filtered, translated cost segments (empty ⇒ the card is not rendered). */
  readonly chartData: readonly CostSegment[];
  /** Total cost used as the denominator for the distribution bars. */
  readonly totalCost: number;
  /** Sidebar variant hides the pie (space constraint) — matches the legacy panel. */
  readonly isSidebar: boolean;
}

const CATEGORY_COLOR_TOKEN: Record<CostCategory, string> = {
  filament: "var(--cost-filament)",
  energy: "var(--cost-energy)",
  machine: "var(--cost-machine)",
  labor: "var(--cost-labor)",
  failure: "var(--cost-failure)",
  other: "var(--cost-other)",
};

const formatPercent = (value: number): string =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";

/**
 * Compact cost evidence followed by the full composition behind a native
 * disclosure. The summary keeps the price explanation useful without opening a
 * chart; every original segment remains available in the details panel.
 */
export function CostBreakdownCard({
  chartData,
  totalCost,
  isSidebar,
}: CostBreakdownCardProps) {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();
  const detailsDescriptionId = useId();

  if (chartData.length === 0) return null;

  const totalText = fmtCurrency(totalCost);
  const compactSegments = [...chartData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const compactText = compactSegments
    .map((segment) => `${segment.name} ${formatPercent(segment.pct)}`)
    .join(" · ");
  const remainingCount = Math.max(0, chartData.length - compactSegments.length);
  const compactLabel = t("results.distributionSummary", {
    total: totalText,
    segments: compactText,
  });

  return (
    <Suspense
      fallback={
        <div className="surface-elevated rounded-xl p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">
            {t("calc.costDistribution")}
          </div>
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            {t("dashboard.loadingCharts")}
          </p>
        </div>
      }
    >
      <div
        data-testid="cost-distribution-card"
        className="surface-elevated min-w-0 rounded-xl p-3 sm:p-5"
      >
        <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 sm:mb-4">
          {t("calc.costDistribution")}
        </div>

        <div
          data-testid="cost-distribution-compact"
          className="mb-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
          aria-label={compactLabel}
        >
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            {t("calc.totalCost")}: {totalText}
          </p>
          <div
            role="img"
            aria-label={compactLabel}
            className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-overlay)]"
          >
            {compactSegments.map((segment) => (
              <span
                key={`compact-${segment.category}-${segment.name}`}
                aria-hidden="true"
                className="h-full"
                style={{
                  width: `${totalCost > 0 ? segment.pct : 0}%`,
                  backgroundColor: CATEGORY_COLOR_TOKEN[segment.category],
                }}
              />
            ))}
          </div>
          <p
            data-testid="cost-distribution-compact-text"
            className="mt-2 break-words text-xs text-[var(--text-secondary)]"
          >
            {compactText}
          </p>
          {remainingCount > 0 && (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              {t("results.distributionMore", { count: remainingCount })}
            </p>
          )}
        </div>

        <details
          data-testid="cost-distribution-details"
          className="group rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)]"
        >
          <summary
            aria-describedby={detailsDescriptionId}
            className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none hover:bg-[var(--surface-overlay)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
          >
            <span>{t("results.distributionDetails")}</span>
            <span
              id={detailsDescriptionId}
              className="text-xs font-normal text-[var(--text-muted)] group-open:hidden"
            >
              {t("results.distributionDetailsDescription")}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-[var(--border-default)] p-3">
            <div className="space-y-1.5 sm:space-y-3">
              {chartData.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs sm:text-sm text-[var(--text-secondary)]">
                      {item.name}
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[var(--text-primary)]">
                      {fmtCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-sunken)] rounded-full overflow-hidden">
                    <div
                      role="img"
                      aria-label={`${item.name}: ${fmtCurrency(item.value)}`}
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${totalCost > 0 ? item.pct : 0}%`,
                        backgroundColor: CATEGORY_COLOR_TOKEN[item.category],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              className={`mt-4 w-full ${isSidebar ? "hidden" : "h-48 sm:h-56"}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="40%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={CATEGORY_COLOR_TOKEN[entry.category]}
                        stroke="var(--border-subtle)"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => fmtCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: "var(--surface-overlay)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "var(--text-primary)" }}
                  />
                  <Legend
                    aria-label={t("calc.costDistribution")}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", maxWidth: "42%" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </details>
      </div>
    </Suspense>
  );
}
