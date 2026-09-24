import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";
import { MaterialComparison } from "@/shared/components/Calculator/MaterialComparison";

import { PriceHeroCard } from "./PriceHeroCard";
import { CostSummaryCard } from "./CostSummaryCard";
import { ProfitSummaryCard } from "./ProfitSummaryCard";
import { CostBreakdownCard } from "./CostBreakdownCard";
import { ProductActionsCard } from "./ProductActionsCard";
import { HistoryCard } from "./HistoryCard";
import { ExportActionsCard } from "./ExportActionsCard";
import { InventoryDeductionCard } from "./InventoryDeductionCard";
import { CalculationErrorState } from "./CalculationErrorState";
import { MultiMaterialWarning } from "./MultiMaterialWarning";

interface ResultsPanelProps {
  variant: "sidebar" | "mobile";
  /** Receives the explanation when an export/share action is blocked in demo. */
  onExportBlocked?: (message: string) => void;
}

/**
 * Results panel — thin orchestrator.
 *
 * Owns only the display-local sell-price override state and mounts the
 * financial cards in the legacy order. All computation lives in
 * {@link useFinancialBreakdown} and each visual block in its own card, so the
 * rendered output stays identical to the former monolith.
 */
export function ResultsPanel({ variant, onExportBlocked }: ResultsPanelProps) {
  const { results, activeTab, fdmSales, resinSales, calculationIssues } =
    useCalculatorStore(
      useShallow((s) => ({
        results: s.results,
        activeTab: s.activeTab,
        fdmSales: s.fdmSales,
        resinSales: s.resinSales,
        calculationIssues: s.calculationIssues,
      })),
    );

  // Display-local sell-price override (issue #85): never writes back to the
  // store, so the global margin stays untouched.
  const [sellOverride, setSellOverride] = useState<number | null>(null);

  const breakdown = useFinancialBreakdown({
    result: results,
    activeTab,
    sellOverride,
    fdmSales,
    resinSales,
  });

  const isSidebar = variant === "sidebar";
  const calculationNotice = (
    <CalculationErrorState
      issues={calculationIssues}
      hasResult={results !== null}
      additionalPaths={breakdown.invalidSegmentPaths}
    />
  );
  const multiMaterialNotice = <MultiMaterialWarning />;

  if (!results) {
    return isSidebar ? (
      <>
        {multiMaterialNotice}
        {calculationNotice}
      </>
    ) : (
      <div className="space-y-4 2xl:hidden">
        {multiMaterialNotice}
        {calculationNotice}
      </div>
    );
  }

  const content = (
    <>
      {multiMaterialNotice}
      {calculationNotice}
      <PriceHeroCard
        breakdown={breakdown}
        onSellOverrideChange={setSellOverride}
      />
      <CostSummaryCard
        costPerGram={results.costPerGram}
        failureCost={results.failureCost}
      />
      <ProfitSummaryCard
        totalCost={results.totalCost}
        profit={breakdown.displayProfit}
        profitPerHour={results.profitPerHour ?? 0}
      />
      <CostBreakdownCard
        chartData={breakdown.chartData}
        totalCost={results.totalCost}
        isSidebar={isSidebar}
      />
      <MaterialComparison />
      <ProductActionsCard displaySellPrice={breakdown.displaySellPrice} />
      <HistoryCard />
      <ExportActionsCard onExportBlocked={onExportBlocked} />
      <InventoryDeductionCard />
    </>
  );

  if (isSidebar) {
    return content;
  }

  return <div className="space-y-4 2xl:hidden">{content}</div>;
}
