import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "@/shared/components/Dashboard/RechartsLazy";

import { useCurrency } from "@/shared/hooks/useCurrency";
import type { CostSegment } from "@/shared/hooks/useFinancialBreakdown";

export interface CostBreakdownCardProps {
  /** Pre-filtered, translated cost segments (empty ⇒ the card is not rendered). */
  chartData: readonly CostSegment[];
  /** Total cost used as the denominator for the distribution bars. */
  totalCost: number;
  /** Sidebar variant hides the pie (space constraint) — matches the legacy panel. */
  isSidebar: boolean;
}

/**
 * Cost-distribution card: labelled bars (always) + donut chart (non-sidebar).
 *
 * Renders nothing when `chartData` is empty, mirroring the legacy
 * `chartData.length > 0` gate so the panel output stays byte-identical.
 */
export function CostBreakdownCard({
  chartData,
  totalCost,
  isSidebar,
}: CostBreakdownCardProps) {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();

  if (chartData.length === 0) return null;

  return (
    <Suspense
      fallback={
        <div className="surface-elevated rounded-xl p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
            {t("calc.costDistribution")}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            {t("dashboard.loadingCharts")}
          </p>
        </div>
      }
    >
      <div className="surface-elevated rounded-xl p-3 sm:p-5">
        <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 sm:mb-4">
          {t("calc.costDistribution")}
        </div>
        <div className="space-y-1.5 sm:space-y-3">
          {chartData.map((item) => (
            <div key={item.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                  {item.name}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  {fmtCurrency(item.value)}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${totalCost > 0 ? item.pct : 0}%`,
                    backgroundColor: item.color,
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
                    fill={entry.color}
                    stroke="rgba(0,0,0,0.3)"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => fmtCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--color-chart-tooltip-bg)",
                  borderColor: "var(--color-chart-tooltip-border)",
                  color: "var(--color-chart-tooltip-text)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "var(--color-chart-tooltip-text)" }}
              />
              <Legend
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
    </Suspense>
  );
}
