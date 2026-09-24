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
import { MultiMaterialWarning } from "@/shared/components/Results/MultiMaterialWarning";
import { LevelToggle } from "../LevelToggle";
import { BentoHeader } from "./bento/BentoHeader";
import { BentoLaborCard } from "./bento/BentoLaborCard";
import { BentoMachineCard } from "./bento/BentoMachineCard";
import { BentoMaterialCard } from "./bento/BentoMaterialCard";
import { BentoPricingCard } from "./bento/BentoPricingCard";
import { BentoSummaryCard } from "./bento/BentoSummaryCard";

function categoryValue(
  segments: readonly CostSegment[],
  category: CostCategory,
): number {
  return segments
    .filter((segment) => segment.category === category)
    .reduce((total, segment) => total + segment.value, 0);
}

/** Third calculator surface: a responsive five-card calculation grid. */
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
    addToHistory,
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
      addToHistory: state.addToHistory,
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
  const multiMaterialNotice = <MultiMaterialWarning />;
  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <BentoHeader
          projectName={productName}
          finalPrice={
            results === null ? INVALID_CURRENCY_MARKER : format(breakdown.displaySellPrice)
          }
        />
      </div>
      <div className="flex shrink-0 sm:justify-end">
        <LevelToggle />
      </div>
    </div>
  );

  if (!results) {
    return (
      <section
        aria-label={t("bento.regionLabel")}
        className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6"
      >
        <h1 className="sr-only">{t("bento.title")}</h1>
        <div className="space-y-4 sm:space-y-5">
          {header}
          {multiMaterialNotice}
          {calculationNotice}
        </div>
      </section>
    );
  }

  const result = results;

  return (
    <section
      aria-label={t("bento.regionLabel")}
      className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6"
    >
      <h1 className="sr-only">{t("bento.title")}</h1>
      <div className="space-y-4 sm:space-y-5">
        {header}
        {multiMaterialNotice}
        {calculationNotice}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <BentoSummaryCard
            sellPrice={breakdown.displaySellPrice}
            totalCost={result.totalCost}
            taxAmount={breakdown.fees.taxAmount}
            marketplaceFee={breakdown.fees.marketplaceFee}
            totalFees={breakdown.fees.total}
            profit={breakdown.displayProfit}
            hasResult
            onSave={() => addToHistory()}
          />
        </div>
      </div>
    </section>
  );
}
