import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";
import type { SidebarMode } from "@/shared/stores/layoutStore";
import type { PrintParameters } from "@/shared/types";

import { CalculationErrorState } from "./CalculationErrorState";
import { CostBreakdownCard } from "./CostBreakdownCard";
import { CostDistributionBars } from "./CostDistributionBars";
import { DiagnosticDetailsCard } from "./DiagnosticDetailsCard";
import { PriceHeroCard } from "./PriceHeroCard";
import { ProfitSummaryCard } from "./ProfitSummaryCard";
import { ResultsActions } from "./ResultsActions";

export type ResultsSidebarTab = "chart" | "bars" | "actions";
export type ResultsCompactView = "chart" | "bars";

export interface ResultsPanelProps {
  variant: "sidebar" | "mobile" | "bento";
  /** Receives the explanation when an export/share action is blocked in demo. */
  readonly onExportBlocked?: (message: string) => void;
  /** Bento owns the outer alert slot so it can remain the first child. */
  readonly suppressCalculationError?: boolean;
  /** Optional surface-specific label for the history action. */
  readonly historyActionLabel?: string;
  /** Independent presentation preference for the classic results sidebar. */
  readonly sidebarMode?: SidebarMode;
  /** Active task tab when the sidebar is in the specialized-tabs mode. */
  readonly sidebarTab?: ResultsSidebarTab;
  /** Chart/bars switch used by the compact sidebar presentation. */
  readonly compactView?: ResultsCompactView;
}

function getFailureRatePercent(params: PrintParameters): number | null {
  if (params.failureMode !== "percent") return null;
  const rate = params.failureValue * (params.riskMultiplier ?? 1);
  return Number.isFinite(rate) ? rate : null;
}

/**
 * Results hierarchy shared by Classic and Bento.
 *
 * The order is intentional: commercial response, profit/cost, compact cost
 * evidence, secondary diagnostics, then grouped actions. All calculation work
 * remains in useFinancialBreakdown; this component only arranges presentation.
 */
export function ResultsPanel({
  variant,
  onExportBlocked,
  suppressCalculationError = false,
  historyActionLabel,
  sidebarMode,
  sidebarTab = "chart",
  compactView = "chart",
}: ResultsPanelProps): React.ReactElement {
  const {
    results,
    activeTab,
    fdmSales,
    resinSales,
    fdmPrintParams,
    resinPrintParams,
    calculationIssues,
  } = useCalculatorStore(
    useShallow((state) => ({
      results: state.results,
      activeTab: state.activeTab,
      fdmSales: state.fdmSales,
      resinSales: state.resinSales,
      fdmPrintParams: state.fdmPrintParams,
      resinPrintParams: state.resinPrintParams,
      calculationIssues: state.calculationIssues,
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

  const calculationNotice = suppressCalculationError ? null : (
    <CalculationErrorState
      issues={calculationIssues}
      hasResult={results !== null}
      additionalPaths={breakdown.invalidSegmentPaths}
    />
  );

  if (!results) {
    const emptyContent = (
      <div data-testid="results-hierarchy" className="min-w-0 space-y-4">
        {calculationNotice}
      </div>
    );
    return variant === "mobile" ? (
      <div className="space-y-4 2xl:hidden">{emptyContent}</div>
    ) : (
      emptyContent
    );
  }

  const isSidebar = variant === "sidebar";
  const isTabsSidebar = isSidebar && sidebarMode === "tabs";
  const activeTabView = isTabsSidebar ? sidebarTab : "chart";
  const showDiagnostics = !isTabsSidebar || activeTabView !== "actions";
  const showActions = !isTabsSidebar || activeTabView === "actions";
  const showBars =
    isSidebar &&
    ((sidebarMode === "compact" && compactView === "bars") ||
      (sidebarMode === "tabs" && activeTabView === "bars"));
  const showChart =
    isSidebar &&
    ((sidebarMode === "compact" && compactView === "chart") ||
      (sidebarMode === "tabs" && activeTabView === "chart"));
  const compactDistribution = (
    <CostBreakdownCard
      chartData={breakdown.chartData}
      totalCost={results.totalCost}
      isSidebar={!showChart}
    />
  );
  const detailedBars = showBars ? (
    <CostDistributionBars
      chartData={breakdown.chartData}
      totalCost={results.totalCost}
    />
  ) : null;
  const actions = (
    <ResultsActions
      displaySellPrice={breakdown.displaySellPrice}
      onExportBlocked={onExportBlocked}
      showInventory={activeTab === "fdm"}
      historyActionLabel={historyActionLabel}
    />
  );
  const actionContent =
    sidebarMode === "dock" ? (
      <div className="sticky bottom-0 z-10 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-md)]">
        {actions}
      </div>
    ) : (
      actions
    );

  const spacingClass =
    sidebarMode === "compact"
      ? "space-y-3"
      : sidebarMode === "expanded"
        ? "space-y-6"
        : "space-y-4";
  const content = (
    <div
      data-testid="results-hierarchy"
      data-layout={variant}
      data-sidebar-mode={sidebarMode}
      className={`min-w-0 ${spacingClass}`}
    >
      {calculationNotice}
      <PriceHeroCard
        breakdown={breakdown}
        onSellOverrideChange={setSellOverride}
      />
      <ProfitSummaryCard
        totalCost={results.totalCost}
        profit={breakdown.displayProfit}
        profitPerHour={results.profitPerHour ?? 0}
        showProfitPerHour={false}
      />
      {compactDistribution}
      {detailedBars}
      {showDiagnostics && (
        <DiagnosticDetailsCard
          costPerGram={results.costPerGram}
          failureCost={results.failureCost}
          profitPerHour={results.profitPerHour ?? 0}
          failureRatePercent={getFailureRatePercent(
            activeTab === "fdm" ? fdmPrintParams : resinPrintParams,
          )}
        />
      )}
      {showActions && actionContent}
    </div>
  );

  if (variant === "mobile") {
    return <div className="space-y-4 2xl:hidden">{content}</div>;
  }
  return content;
}
