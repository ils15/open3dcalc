import { useTranslation } from "react-i18next";
import { Info, HelpCircle } from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type {
  CostCategory,
  CostSegment,
} from "@/shared/hooks/useFinancialBreakdown";

export interface CostDistributionBarsProps {
  readonly chartData: readonly CostSegment[];
  readonly totalCost: number;
  readonly profit?: number;
}

const CATEGORY_COLOR_TOKEN: Record<CostCategory, string> = {
  filament: "var(--cost-filament)",
  energy: "var(--cost-energy)",
  machine: "var(--cost-machine)",
  failure: "var(--cost-failure)",
  labor: "var(--cost-labor)",
  other: "var(--cost-other)",
};

export function CostDistributionBars({
  chartData,
  totalCost,
  profit = 18.18,
}: CostDistributionBarsProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  if (chartData.length === 0) return null;

  const breakEvenUnits = Math.ceil(3200 / (profit > 0 ? profit : 1));

  return (
    <div
      data-testid="compact-cost-bars"
      aria-label={t("calc.costDistribution")}
      className="bg-surface-raised border border-border-subtle rounded-2xl p-4 text-text-primary shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary">
          COMPOSIÇÃO DE CUSTOS
        </span>
        <div className="flex items-center gap-1 text-text-muted">
          <HelpCircle className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Segments List with Dots */}
      <div className="space-y-2 text-xs">
        {chartData.map((segment) => {
          const formattedValue = formatCurrency(segment.value);
          const pct = Math.round(segment.pct);
          const width =
            totalCost > 0 && Number.isFinite(segment.pct)
              ? Math.min(100, Math.max(0, segment.pct))
              : 0;

          return (
            <div
              key={`${segment.category}-${segment.name}`}
              data-testid={`compact-cost-bar-${segment.category}`}
              className="flex items-center justify-between gap-2 py-0.5 text-text-secondary"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: CATEGORY_COLOR_TOKEN[segment.category],
                  }}
                />
                <span className="truncate text-text-secondary">
                  {segment.name}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                <span className="text-text-secondary">{pct}%</span>
                <span className="font-semibold text-text-primary">
                  {formattedValue}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
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

      {/* Info Callout Box */}
      <div className="p-3 rounded-xl bg-accent-subtle border border-accent/30 flex items-start gap-2.5 text-[11px] leading-relaxed text-text-secondary">
        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <p>
          Lucro projetado de{" "}
          <strong className="text-positive font-bold">
            {formatCurrency(profit)}
          </strong>{" "}
          sobre o custo total de fabricação de{" "}
          <strong className="text-text-primary font-bold">
            {formatCurrency(totalCost)}
          </strong>
          .
        </p>
      </div>

      {/* Break-Even Box */}
      <div className="p-3 rounded-xl bg-surface-sunken border border-border-subtle space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
            <span className="text-positive font-bold">~</span>
            Break-Even da Máquina
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-positive-subtle text-positive border border-positive/30">
            {breakEvenUnits} peças
          </span>
        </div>
        <p className="text-[11px] text-text-secondary leading-normal">
          Vendendo{" "}
          <strong className="text-text-primary">
            {breakEvenUnits} unidades
          </strong>{" "}
          deste projeto você quita o valor da máquina ({formatCurrency(3200)}).
        </p>
      </div>
    </div>
  );
}
