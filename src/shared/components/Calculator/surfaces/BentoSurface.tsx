import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { INVALID_CURRENCY_MARKER } from "@/shared/lib/currency";
import {
  useFinancialBreakdown,
  type CostCategory,
  type CostSegment,
} from "@/shared/hooks/useFinancialBreakdown";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { CalculationErrorState } from "@/shared/components/Results/CalculationErrorState";
import { ResultsPanel } from "@/shared/components/Results/ResultsPanel";
import { LevelToggle } from "../LevelToggle";
import { TechToggle } from "../TechToggle";
import { BentoHeader } from "./bento/BentoHeader";
import { BentoLaborCard } from "./bento/BentoLaborCard";
import { BentoMachineCard } from "./bento/BentoMachineCard";
import { BentoMaterialCard } from "./bento/BentoMaterialCard";
import { BentoPricingCard } from "./bento/BentoPricingCard";

function categoryValue(
  segments: readonly CostSegment[],
  category: CostCategory,
): number {
  return segments
    .filter((segment) => segment.category === category)
    .reduce((total, segment) => total + segment.value, 0);
}

/** Third calculator surface: a responsive calculation grid with shared results. */
export function BentoSurface(): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const {
    results,
    activeTab,
    productName,
    quantity,
    selectedSpoolId,
    fdmMaterial,
    resinMaterial,
    fdmLabor,
    resinLabor,
    fdmExtras,
    resinExtras,
    fdmSales,
    resinSales,
    calculationIssues,
  } = useCalculatorStore(
    useShallow((state) => ({
      results: state.results,
      activeTab: state.activeTab,
      productName: state.productName,
      quantity: state.quantity,
      selectedSpoolId: state.selectedSpoolId,
      fdmMaterial: state.fdmMaterial,
      resinMaterial: state.resinMaterial,
      fdmLabor: state.fdmLabor,
      resinLabor: state.resinLabor,
      fdmExtras: state.fdmExtras,
      resinExtras: state.resinExtras,
      fdmSales: state.fdmSales,
      resinSales: state.resinSales,
      calculationIssues: state.calculationIssues,
    })),
  );

  const breakdown = useFinancialBreakdown({
    result: results,
    activeTab,
    sellOverride: null,
    fdmSales,
    resinSales,
  });
  const isFDM = activeTab === "fdm";
  const materialType = isFDM ? fdmMaterial.type : resinMaterial.type;
  const materialCostPerKg = isFDM
    ? fdmMaterial.costPerKg
    : resinMaterial.density > 0
      ? (resinMaterial.costPerLiter / resinMaterial.density) * 1000
      : 0;
  const labor = isFDM ? fdmLabor : resinLabor;
  const extras = isFDM ? fdmExtras : resinExtras;
  const sales = isFDM ? fdmSales : resinSales;
  const calculationNotice = (
    <CalculationErrorState
      issues={calculationIssues}
      hasResult={results !== null}
      additionalPaths={breakdown.invalidSegmentPaths}
    />
  );
  const header = (
    <div className="flex min-w-0 flex-wrap flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-64 flex-1">
        <BentoHeader
          projectName={productName}
          finalPrice={
            results === null
              ? INVALID_CURRENCY_MARKER
              : format(breakdown.displaySellPrice)
          }
          hasResults={results !== null}
        />
      </div>
      <div
        data-testid="bento-header-controls"
        className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end"
      >
        <div className="w-full min-w-0 max-w-full sm:w-auto">
          <TechToggle wrapOnNarrow />
        </div>
        <div className="w-full min-w-0 max-w-full sm:w-auto">
          <LevelToggle wrapOnNarrow />
        </div>
      </div>
    </div>
  );

  if (!results) {
    return (
      <section
        aria-label={t("bento.regionLabel")}
        className="mx-auto w-full min-w-0 max-w-7xl px-3 py-4 sm:px-5 sm:py-6"
      >
        <h1 className="sr-only">{t("bento.title")}</h1>
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {calculationNotice}
          {header}
        </div>
      </section>
    );
  }

  const result = results;

  return (
    <section
      aria-label={t("bento.regionLabel")}
      className="mx-auto w-full min-w-0 max-w-7xl px-3 py-4 sm:px-5 sm:py-6"
    >
      <h1 className="sr-only">{t("bento.title")}</h1>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        {calculationNotice}
        {header}

        {/* KPI Mini-Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] block">
              Tempo Estimado
            </span>
            <strong className="text-[var(--color-text-primary)] text-xs font-bold">
              {breakdown.time.estimatedHours.toFixed(1)}h
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] block">
              Peso da Peça
            </span>
            <strong className="text-[var(--color-text-primary)] text-xs font-bold">
              {result.unitWeight.toFixed(1)}g
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] block">
              Custo Fabril
            </span>
            <strong className="text-[var(--color-text-secondary)] text-xs font-bold">
              {format(result.totalCost)}
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] block">
              Preço Sugerido
            </span>
            <strong className="text-[var(--color-success)] text-xs font-bold">
              {format(breakdown.displaySellPrice)}
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] block">
              Lucro Líquido
            </span>
            <strong className="text-[var(--color-accent)] text-xs font-bold">
              {format(breakdown.displayProfit)}
            </strong>
          </div>
        </div>

        <section
          id="bento-results"
          aria-labelledby="bento-results-heading"
          className="min-w-0"
        >
          <h2 id="bento-results-heading" className="sr-only">
            {t("bento.cards.summary")}
          </h2>
          <ResultsPanel
            variant="bento"
            suppressCalculationError
            historyActionLabel={t("results.addHistorySeparate")}
          />
        </section>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BentoMaterialCard
            materialType={materialType}
            unitWeight={result.unitWeight}
            costPerKg={materialCostPerKg}
            materialCost={categoryValue(breakdown.chartData, "filament")}
            selectedSpoolId={selectedSpoolId}
          />
          <BentoMachineCard
            printHours={breakdown.time.estimatedHours}
            energyCost={categoryValue(breakdown.chartData, "energy")}
            machineCost={categoryValue(breakdown.chartData, "machine")}
          />
          <BentoLaborCard
            labor={labor}
            laborCost={categoryValue(breakdown.chartData, "labor")}
            extrasCost={extras.extrasCost}
          />
          <BentoPricingCard
            result={result}
            sales={sales}
            quantity={quantity}
            breakEvenPrice={breakdown.breakEvenPrice}
            profit={breakdown.displayProfit}
          />
        </div>
      </div>
    </section>
  );
}
