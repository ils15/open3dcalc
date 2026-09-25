import { useTranslation } from "react-i18next";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { CostCategory, CostSegment } from "@/shared/hooks/useFinancialBreakdown";

export interface CostDistributionBarsProps {
  readonly chartData: readonly CostSegment[];
  readonly totalCost: number;
}

const CATEGORY_COLOR_TOKEN: Record<CostCategory, string> = {
  filament: "var(--cost-filament)",
  energy: "var(--cost-energy)",
  machine: "var(--cost-machine)",
  labor: "var(--cost-labor)",
  failure: "var(--cost-failure)",
  other: "var(--cost-other)",
};

/**
 * Compact bar view for the results sidebar.
 *
 * Every segment from the shared financial breakdown is rendered, including the
 * material/filament segment. Keeping this list derived from chartData prevents
 * the compact presentation from silently dropping a cost category.
 */
export function CostDistributionBars({
  chartData,
  totalCost,
}: CostDistributionBarsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  if (chartData.length === 0) return null;

  return (
    <section
      data-testid="compact-cost-bars"
      aria-label={t("calc.costDistribution")}
      className="min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
    >
      <div className="space-y-3">
        {chartData.map((segment, index) => {
          const width = totalCost > 0 ? Math.min(100, Math.max(0, segment.pct)) : 0;
          const formattedValue = formatCurrency(segment.value);

          return (
            <div
              key={`${segment.category}-${segment.name}-${index}`}
              data-testid={`compact-cost-bar-${segment.category}`}
              className="min-w-0 space-y-1"
              role="group"
              aria-label={`${segment.name}: ${formattedValue}`}
            >
              <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                <span className="truncate text-[var(--text-secondary)]">
                  {segment.name}
                </span>
                <span className="shrink-0 font-mono font-semibold text-[var(--text-primary)]">
                  {formattedValue}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-overlay)]">
                <div
                  role="img"
                  aria-label={`${segment.name}: ${segment.pct.toFixed(1)}%`}
                  className="h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: CATEGORY_COLOR_TOKEN[segment.category],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
