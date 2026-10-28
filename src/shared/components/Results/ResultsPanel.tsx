import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { Info, List, PieChart } from "lucide-react";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { SidebarMode } from "@/shared/stores/layoutStore";
import type { PrintParameters } from "@/shared/types";

import { BreakEvenMachineCard } from "./BreakEvenMachineCard";
import { CalculationErrorState } from "./CalculationErrorState";
import { CostBreakdownCard } from "./CostBreakdownCard";
import { DiagnosticDetailsCard } from "./DiagnosticDetailsCard";
import { PriceHeroCard } from "./PriceHeroCard";
import { ProfitSummaryCard } from "./ProfitSummaryCard";
import { ResultsActions } from "./ResultsActions";
import { SuggestedPriceTool } from "@/shared/components/Calculator/SuggestedPriceTool";

export type ResultsSidebarTab = "chart" | "bars" | "actions";
export type ResultsCompactView = "chart" | "bars";

export interface ResultsPanelProps {
  variant: "sidebar" | "mobile" | "bento";
  /** Optional controlled override for surfaces with several linked result cards. */
  readonly sellOverride?: number | null;
  readonly onSellOverrideChange?: (price: number | null) => void;
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
  sellOverride: controlledSellOverride,
  onSellOverrideChange,
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
    quantity,
    calculationIssues,
  } = useCalculatorStore(
    useShallow((state) => ({
      results: state.results,
      activeTab: state.activeTab,
      fdmSales: state.fdmSales,
      resinSales: state.resinSales,
      fdmPrintParams: state.fdmPrintParams,
      resinPrintParams: state.resinPrintParams,
      quantity: state.quantity,
      calculationIssues: state.calculationIssues,
    })),
  );
  const setFdmSales = useCalculatorStore((s) => s.setFdmSales);
  const setResinSales = useCalculatorStore((s) => s.setResinSales);
  const selectedPrinter = useCalculatorStore((s) => s.selectedPrinter);
  const { format: fmtCurrency } = useCurrency();
  const { t } = useTranslation();

  // Display-local sell-price override (issue #85): never writes back to the
  // store, so the global margin stays untouched.
  const [localSellOverride, setLocalSellOverride] = useState<number | null>(
    null,
  );
  const sellOverride =
    controlledSellOverride === undefined
      ? localSellOverride
      : controlledSellOverride;
  const setSellOverride = onSellOverrideChange ?? setLocalSellOverride;
  // Example reference: the composition card offers the list (dot + % + value)
  // and the donut side by side via a small list/pie switch. The compact
  // "Barras" choice seeds it with the bars presentation.
  const [breakdownView, setBreakdownView] = useState<"list" | "chart">(
    compactView === "bars" ? "chart" : "list",
  );
  const sales = activeTab === "fdm" ? fdmSales : resinSales;
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
      <div className="space-y-4">{emptyContent}</div>
    ) : (
      emptyContent
    );
  }

  const isSidebar = variant === "sidebar";
  const isTabsSidebar = isSidebar && sidebarMode === "tabs";
  const activeTabView = isTabsSidebar ? sidebarTab : "chart";
  const showDiagnostics = !isTabsSidebar || activeTabView !== "actions";
  const showActions = !isTabsSidebar || activeTabView === "actions";
  // When the sidebar is not presenting the donut, the bars carry the
  // composition alone. CostBreakdownCard already renders CostDistributionBars
  // itself when `isSidebar` is set, so this component must not add a second
  // copy of the bar list — it used to, which duplicated every segment whenever
  // the compact view was on "bars". Non-sidebar surfaces (mobile/bento) keep
  // the donut disclosure, exactly as before. The list/pie switch follows the
  // Example reference: "list" shows the dot+%+value rows inline.
  const compactDistribution = (
    <div className="relative">
      {isSidebar && (
        <div
          role="group"
          aria-label={t("results.distributionViewLabel")}
          className="absolute right-3 top-3 z-10 flex items-center rounded border border-[var(--border-default)] bg-[var(--surface-overlay)] p-0.5"
        >
          {(
            [
              ["list", List],
              ["chart", PieChart],
            ] as const
          ).map(([view, Icon]) => (
            <button
              key={view}
              type="button"
              aria-pressed={breakdownView === view}
              aria-label={t(
                view === "list"
                  ? "results.distributionViewList"
                  : "results.distributionViewChart",
              )}
              onClick={() => setBreakdownView(view)}
              className={`rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                breakdownView === view
                  ? "bg-[var(--surface-raised)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <CostBreakdownCard
        chartData={breakdown.chartData}
        totalCost={results.totalCost}
        /* Sidebar layout always: the list/pie switch (seeded by the compact
           "Barras" choice) picks the composition presentation, per the
           Example reference. The old !showChart flip painted the mobile
           variant here and hid the composition entirely. */
        isSidebar={isSidebar}
        sidebarView={breakdownView}
      />
    </div>
  );
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
    variant === "mobile"
      ? "space-y-4"
      : sidebarMode === "compact"
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
        marginPercent={sales.profitMarginPercent}
        onMarginChange={(percent) =>
          activeTab === "fdm"
            ? setFdmSales({ ...fdmSales, profitMarginPercent: percent })
            : setResinSales({ ...resinSales, profitMarginPercent: percent })
        }
      />
      <SuggestedPriceTool
        totalCost={results.totalCost}
        taxPercent={sales.taxPercent}
        marketplaceFeePercent={sales.marketplaceFeePercent}
        marketplaceFeeFixed={sales.marketplaceFeeFixed ?? 0}
        quantity={quantity}
        volumeDiscounts={sales.volumeDiscounts}
        initialMarginPercent={
          breakdown.overrideCalc?.marginReal ?? results.actualMargin
        }
        initialProfit={breakdown.displayProfit}
        initialSellPrice={breakdown.displaySellPrice}
        onApply={(scenario) => setSellOverride(scenario.sellPrice)}
      />
      {isSidebar ? (
        <>
          {/* Example reference: projected-profit note + machine break-even
              replace the generic profit card in the sidebar, which already
              reads the profit inside the green hero. */}
          <div
            data-testid="projected-profit-note"
            className="flex items-start gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-2.5 text-[11px] text-[var(--text-secondary)]"
          >
            <Info
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0 text-[var(--info)]"
            />
            <span>
              {t("results.projectedProfit", {
                profit: fmtCurrency(breakdown.displayProfit),
                cost: fmtCurrency(results.totalCost),
              })}
            </span>
          </div>
          <BreakEvenMachineCard
            machineCost={selectedPrinter?.value ?? 0}
            netProfit={breakdown.displayProfit}
          />
        </>
      ) : (
        <ProfitSummaryCard
          totalCost={results.totalCost}
          profit={breakdown.displayProfit}
          profitPerHour={results.profitPerHour ?? 0}
          showProfitPerHour={false}
        />
      )}
      {compactDistribution}

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

  return content;
}
