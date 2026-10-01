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
      className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-4 text-slate-200 shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
          COMPOSIÇÃO DE CUSTOS
        </span>
        <div className="flex items-center gap-1 text-slate-500">
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
              className="flex items-center justify-between gap-2 py-0.5 text-slate-300"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: CATEGORY_COLOR_TOKEN[segment.category],
                  }}
                />
                <span className="truncate text-slate-300">{segment.name}</span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                <span className="text-slate-400">{pct}%</span>
                <span className="font-semibold text-white">
                  {formattedValue}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
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

      {/* Blue Callout Info Box */}
      <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/50 flex items-start gap-2.5 text-[11px] leading-relaxed text-blue-200">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p>
          Lucro projetado de{" "}
          <strong className="text-emerald-400 font-bold">
            {formatCurrency(profit)}
          </strong>{" "}
          sobre o custo total de fabricação de{" "}
          <strong className="text-white font-bold">
            {formatCurrency(totalCost)}
          </strong>
          .
        </p>
      </div>

      {/* Break-Even Box */}
      <div className="p-3 rounded-xl bg-[#080d1a] border border-[#1e293b] space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">~</span>
            Break-Even da Máquina
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
            {breakEvenUnits} peças
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-normal">
          Vendendo{" "}
          <strong className="text-white">{breakEvenUnits} unidades</strong>{" "}
          deste projeto você quita o valor da máquina ({formatCurrency(3200)}).
        </p>
      </div>
    </div>
  );
}
