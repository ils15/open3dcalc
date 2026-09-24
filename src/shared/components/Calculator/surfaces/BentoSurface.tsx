import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  useFinancialBreakdown,
  type CostCategory,
  type CostSegment,
} from "@/shared/hooks/useFinancialBreakdown";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CalculationResult } from "@/shared/types";
import { BentoHeader } from "./bento/BentoHeader";
import { BentoLaborCard } from "./bento/BentoLaborCard";
import { BentoMachineCard } from "./bento/BentoMachineCard";
import { BentoMaterialCard } from "./bento/BentoMaterialCard";
import { BentoPricingCard } from "./bento/BentoPricingCard";
import { BentoSummaryCard } from "./bento/BentoSummaryCard";

const EMPTY_RESULT: CalculationResult = {
  materialCost: 0,
  energyCost: 0,
  machineCost: 0,
  hardwareCost: 0,
  consumablesCost: 0,
  laborCost: 0,
  softwareCost: 0,
  failureCost: 0,
  extrasCost: 0,
  postProcessingCost: 0,
  subtotal: 0,
  totalCost: 0,
  sellPrice: 0,
  profit: 0,
  marketplaceFee: 0,
  taxAmount: 0,
  costPerGram: 0,
  costPerUnit: 0,
  unitWeight: 0,
  estimatedPrintTime: 0,
  targetMarginPercent: 0,
  breakEvenPrice: 0,
  actualMargin: 0,
  carbonFootprintGrams: 0,
  profitPerHour: 0,
  totalHoursForProfit: 0,
};

function categoryValue(
  segments: readonly CostSegment[],
  category: CostCategory,
): number {
  return segments
    .filter((segment) => segment.category === category)
    .reduce((total, segment) => total + segment.value, 0);
}

/** Third calculator surface: a responsive, read-only five-card financial grid. */
export function BentoSurface(): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const {
    results,
    activeTab,
    productName,
    quantity,
    selectedSpoolId,
    selectedPrinter,
    fdmMaterial,
    resinMaterial,
    fdmPrintParams,
    resinPrintParams,
    fdmMachine,
    resinMachine,
    fdmLabor,
    resinLabor,
    fdmExtras,
    resinExtras,
    fdmSales,
    resinSales,
    addToHistory,
  } = useCalculatorStore(
    useShallow((state) => ({
      results: state.results,
      activeTab: state.activeTab,
      productName: state.productName,
      quantity: state.quantity,
      selectedSpoolId: state.selectedSpoolId,
      selectedPrinter: state.selectedPrinter,
      fdmMaterial: state.fdmMaterial,
      resinMaterial: state.resinMaterial,
      fdmPrintParams: state.fdmPrintParams,
      resinPrintParams: state.resinPrintParams,
      fdmMachine: state.fdmMachine,
      resinMachine: state.resinMachine,
      fdmLabor: state.fdmLabor,
      resinLabor: state.resinLabor,
      fdmExtras: state.fdmExtras,
      resinExtras: state.resinExtras,
      fdmSales: state.fdmSales,
      resinSales: state.resinSales,
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
  const result = results ?? EMPTY_RESULT;
  const isFDM = activeTab === "fdm";
  const materialType = isFDM ? fdmMaterial.type : resinMaterial.type;
  const materialCostPerKg = isFDM
    ? fdmMaterial.costPerKg
    : resinMaterial.density > 0
      ? (resinMaterial.costPerLiter / resinMaterial.density) * 1000
      : 0;
  const printParams = isFDM ? fdmPrintParams : resinPrintParams;
  const machine = isFDM ? fdmMachine : resinMachine;
  const labor = isFDM ? fdmLabor : resinLabor;
  const extras = isFDM ? fdmExtras : resinExtras;
  const sales = isFDM ? fdmSales : resinSales;

  return (
    <section
      aria-label={t("bento.regionLabel")}
      className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6"
    >
      <h1 className="sr-only">{t("bento.title")}</h1>
      <div className="space-y-4 sm:space-y-5">
        <BentoHeader projectName={productName} finalPrice={format(breakdown.displaySellPrice)} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BentoMaterialCard
            materialType={materialType}
            unitWeight={result.unitWeight}
            costPerKg={materialCostPerKg}
            materialCost={categoryValue(breakdown.chartData, "filament")}
            selectedSpoolId={selectedSpoolId}
          />
          <BentoMachineCard
            printerName={selectedPrinter.name}
            printHours={breakdown.time.estimatedHours}
            printerPowerWatts={printParams.printerPowerWatts}
            energyCost={categoryValue(breakdown.chartData, "energy")}
            machineCost={categoryValue(breakdown.chartData, "machine")}
            machine={machine}
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
            hasResult={results !== null}
            onSave={() => addToHistory()}
          />
        </div>
      </div>
    </section>
  );
}
