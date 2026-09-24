import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type {
  CalculationResult,
  SalesParameters,
} from "@/shared/types";
import type { SellPriceOverrideResult } from "@/shared/lib/sellPriceOverride";
import { reverseFromSellPrice } from "@/shared/lib/sellPriceOverride";

/**
 * Which calculator tab the breakdown refers to. Mirrors the store's
 * `activeTab` union so this hook stays free of store coupling.
 */
export type CalculatorTab = "fdm" | "resin";

/** Stable cost-distribution categories used to select a semantic color token. */
export type CostCategory =
  | "filament"
  | "energy"
  | "machine"
  | "labor"
  | "failure"
  | "other";

/** One slice of the cost-distribution chart. */
export interface CostSegment {
  /** Already-translated label (chart + legend text). */
  readonly name: string;
  readonly value: number;
  /** Stable category used by the UI to resolve its design-token color. */
  readonly category: CostCategory;
  /** Share of `totalCost` in percent; 0 when the total is not positive. */
  readonly pct: number;
}

/** Marketplace + tax portion of the sell price. */
export interface FeeBreakdown {
  readonly taxAmount: number;
  readonly marketplaceFee: number;
  readonly total: number;
  /** True when the result carries a tax amount (drives the hero footnote). */
  readonly hasFees: boolean;
}

/** Billable-time view of the result. */
export interface TimeMetrics {
  /** `estimatedPrintTime` converted from minutes to hours. */
  readonly estimatedHours: number;
  /** `totalHoursForProfit`: print + post + setup hours. */
  readonly billableHours: number;
  readonly profitPerHour: number;
}

/** Full financial decomposition consumed by the results cards. */
export interface FinancialBreakdown {
  readonly chartData: readonly CostSegment[];
  readonly overrideCalc: SellPriceOverrideResult | null;
  readonly displaySellPrice: number;
  readonly displayProfit: number;
  readonly breakEvenPrice: number;
  readonly fees: FeeBreakdown;
  readonly time: TimeMetrics;
  readonly isFDM: boolean;
}

/** Inputs for {@link useFinancialBreakdown}. */
export interface FinancialBreakdownInput {
  readonly result: CalculationResult | null;
  readonly activeTab: CalculatorTab;
  /** Display-local sell-price override, or `null` for the calculated price. */
  readonly sellOverride: number | null;
  readonly fdmSales: SalesParameters;
  readonly resinSales: SalesParameters;
}

/** Segments at or below this value are hidden from the chart (matches UI). */
const SEGMENT_MIN_VALUE = 0.01;

/**
 * Builds the ordered, filtered cost-distribution segments.
 *
 * "Material" and "Hardware" are left untranslated to preserve the existing
 * chart rendering; every other label goes through `calc.chartLabels.*`.
 */
function buildChartSegments(
  result: CalculationResult,
  t: (key: string) => string,
): CostSegment[] {
  const total = result.totalCost;
  const raw: ReadonlyArray<readonly [string, number, CostCategory]> = [
    ["Material", result.materialCost, "filament"],
    [t("calc.chartLabels.energy"), result.energyCost, "energy"],
    [t("calc.chartLabels.machine"), result.machineCost, "machine"],
    ["Hardware", result.hardwareCost, "other"],
    [t("calc.chartLabels.finishing"), result.postProcessingCost, "other"],
    [t("calc.chartLabels.consumables"), result.consumablesCost, "other"],
    [t("calc.chartLabels.software"), result.softwareCost, "other"],
    [t("calc.chartLabels.labor"), result.laborCost, "labor"],
    [t("calc.chartLabels.failure"), result.failureCost, "failure"],
    [t("calc.chartLabels.extras"), result.extrasCost, "other"],
  ];

  return raw
    .filter(([, value]) => value > SEGMENT_MIN_VALUE)
    .map(([name, value, category]) => ({
      name,
      value,
      category,
      pct: total > 0 ? (value / total) * 100 : 0,
    }));
}

/**
 * Pure financial decomposition of a calculator result.
 *
 * Computes everything the results cards render — cost-distribution segments,
 * the display-local sell-price override re-derivation, fee totals and
 * billable-time metrics — from the {@link CalculationResult} plus the active
 * tab's sales parameters. No JSX, no side effects, no store access: callers
 * own the inputs, which keeps the unit under test deterministic.
 *
 * Returns a null-safe breakdown when `result` is absent so callers can call
 * this hook unconditionally (React rules of hooks) and bail out afterwards.
 */
export function useFinancialBreakdown(
  input: FinancialBreakdownInput,
): FinancialBreakdown {
  const { result, activeTab, sellOverride, fdmSales, resinSales } = input;
  const { t } = useTranslation();

  return useMemo<FinancialBreakdown>(() => {
    const isFDM = activeTab === "fdm";

    if (!result) {
      return {
        chartData: [],
        overrideCalc: null,
        displaySellPrice: 0,
        displayProfit: 0,
        breakEvenPrice: 0,
        fees: {
          taxAmount: 0,
          marketplaceFee: 0,
          total: 0,
          hasFees: false,
        },
        time: { estimatedHours: 0, billableHours: 0, profitPerHour: 0 },
        isFDM,
      };
    }

    const sales = isFDM ? fdmSales : resinSales;

    const overrideCalc =
      sellOverride == null
        ? null
        : reverseFromSellPrice(
            sellOverride,
            result.breakEvenPrice,
            sales.taxPercent,
            sales.marketplaceFeePercent,
          );

    const taxAmount = result.taxAmount;
    const marketplaceFee = result.marketplaceFee;

    return {
      chartData: buildChartSegments(result, t),
      overrideCalc,
      displaySellPrice: sellOverride ?? result.sellPrice,
      displayProfit: overrideCalc?.profit ?? result.profit,
      breakEvenPrice: result.breakEvenPrice,
      fees: {
        taxAmount,
        marketplaceFee,
        total: taxAmount + marketplaceFee,
        hasFees: taxAmount > 0,
      },
      time: {
        estimatedHours: result.estimatedPrintTime / 60,
        billableHours: result.totalHoursForProfit ?? 0,
        profitPerHour: result.profitPerHour ?? 0,
      },
      isFDM,
    };
  }, [result, activeTab, sellOverride, fdmSales, resinSales, t]);
}
