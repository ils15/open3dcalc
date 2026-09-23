import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  useFinancialBreakdown,
  type FinancialBreakdown,
  type FinancialBreakdownInput,
} from "../useFinancialBreakdown";
import type {
  CalculationResult,
  SalesParameters,
} from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const sales: SalesParameters = {
  packagingCost: 0,
  shippingCost: 0,
  taxPercent: 10,
  marketplaceFeePercent: 5,
  profitMarginPercent: 30,
  volumeDiscounts: [],
};

const resinSales: SalesParameters = {
  ...sales,
  taxPercent: 8,
  marketplaceFeePercent: 4,
};

const result: CalculationResult = {
  materialCost: 10,
  energyCost: 2,
  machineCost: 3,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 20,
  softwareCost: 1,
  failureCost: 4,
  extrasCost: 2,
  postProcessingCost: 5,
  subtotal: 49,
  totalCost: 60,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.71,
  costPerUnit: 60,
  unitWeight: 85,
  estimatedPrintTime: 150,
  targetMarginPercent: 30,
  breakEvenPrice: 70,
  actualMargin: 28.3,
  carbonFootprintGrams: 120,
  profitPerHour: 11.5,
  totalHoursForProfit: 2.6,
};

/** Renders the hook once and returns its value. */
function render(input: Partial<FinancialBreakdownInput>): FinancialBreakdown {
  const { result: ref } = renderHook(() =>
    useFinancialBreakdown({
      result,
      activeTab: "fdm",
      sellOverride: null,
      fdmSales: sales,
      resinSales,
      ...input,
    }),
  );
  return ref.current;
}

describe("useFinancialBreakdown — null safety", () => {
  it("returns an empty breakdown when there is no result", () => {
    const breakdown = render({ result: null });

    expect(breakdown.chartData).toHaveLength(0);
    expect(breakdown.overrideCalc).toBeNull();
    expect(breakdown.displaySellPrice).toBe(0);
    expect(breakdown.displayProfit).toBe(0);
    expect(breakdown.breakEvenPrice).toBe(0);
    expect(breakdown.fees.hasFees).toBe(false);
    expect(breakdown.isFDM).toBe(true);
  });
});

describe("useFinancialBreakdown — cost segments", () => {
  it("maps every positive cost into a chart segment with its color", () => {
    const breakdown = render({});

    expect(breakdown.chartData.map((s) => s.name)).toEqual([
      "Material",
      "calc.chartLabels.energy",
      "calc.chartLabels.machine",
      "Hardware",
      "calc.chartLabels.finishing",
      "calc.chartLabels.consumables",
      "calc.chartLabels.software",
      "calc.chartLabels.labor",
      "calc.chartLabels.failure",
      "calc.chartLabels.extras",
    ]);
    const byName = Object.fromEntries(
      breakdown.chartData.map((s) => [s.name, s]),
    );
    expect(byName["Material"]?.color).toBe("#38bdf8");
    expect(byName["calc.chartLabels.energy"]?.color).toBe("#facc15");
    expect(byName["calc.chartLabels.machine"]?.color).toBe("#94a3b8");
    expect(byName["Hardware"]?.color).toBe("#f97316");
    expect(byName["calc.chartLabels.failure"]?.color).toBe("#f87171");
  });

  it("uses the resin material color on the resin tab", () => {
    const breakdown = render({ activeTab: "resin" });

    expect(breakdown.isFDM).toBe(false);
    expect(breakdown.chartData[0]).toEqual(
      expect.objectContaining({ name: "Material", color: "#a855f7" }),
    );
  });

  it("drops segments whose value is at or below the 0.01 threshold", () => {
    const breakdown = render({
      result: { ...result, failureCost: 0, postProcessingCost: 0.01 },
    });

    const names = breakdown.chartData.map((s) => s.name);
    expect(names).not.toContain("calc.chartLabels.failure");
    expect(names).not.toContain("calc.chartLabels.finishing");
  });

  it("computes each segment share of the total cost in percent", () => {
    const breakdown = render({});

    const material = breakdown.chartData.find((s) => s.name === "Material");
    expect(material?.pct).toBeCloseTo((10 / 60) * 100, 5);
    const labor = breakdown.chartData.find(
      (s) => s.name === "calc.chartLabels.labor",
    );
    expect(labor?.pct).toBeCloseTo((20 / 60) * 100, 5);
  });

  it("reports 0% shares when the total cost is not positive", () => {
    const breakdown = render({ result: { ...result, totalCost: 0 } });

    expect(breakdown.chartData.every((s) => s.pct === 0)).toBe(true);
  });
});

describe("useFinancialBreakdown — sell-price override", () => {
  it("keeps the calculated price when no override is set", () => {
    const breakdown = render({});

    expect(breakdown.overrideCalc).toBeNull();
    expect(breakdown.displaySellPrice).toBe(105.88);
    expect(breakdown.displayProfit).toBe(30);
  });

  it("re-derives profit and margin from an overridden price", () => {
    const breakdown = render({ sellOverride: 120 });

    expect(breakdown.overrideCalc).not.toBeNull();
    expect(breakdown.overrideCalc?.sellPrice).toBe(120);
    expect(breakdown.overrideCalc?.baseCost).toBe(70);
    // 120 - 70 - (120 * 10%) - (120 * 5%) = 32
    expect(breakdown.overrideCalc?.profit).toBe(32);
    expect(breakdown.displaySellPrice).toBe(120);
    expect(breakdown.displayProfit).toBe(32);
    expect(breakdown.overrideCalc?.belowBreakEven).toBe(false);
  });

  it("flags an override below break-even", () => {
    const breakdown = render({ sellOverride: 60 });

    expect(breakdown.overrideCalc?.belowBreakEven).toBe(true);
  });

  it("uses the resin sales parameters on the resin tab", () => {
    const breakdown = render({ activeTab: "resin", sellOverride: 100 });

    // 100 - 70 - (100 * 8%) - (100 * 4%) = 18
    expect(breakdown.overrideCalc?.profit).toBe(18);
  });

  it("exposes the break-even price for warnings", () => {
    const breakdown = render({});

    expect(breakdown.breakEvenPrice).toBe(70);
  });
});

describe("useFinancialBreakdown — fees and time", () => {
  it("aggregates tax and marketplace fees", () => {
    const breakdown = render({});

    expect(breakdown.fees.taxAmount).toBe(10.59);
    expect(breakdown.fees.marketplaceFee).toBe(5.29);
    expect(breakdown.fees.total).toBeCloseTo(15.88, 5);
    expect(breakdown.fees.hasFees).toBe(true);
  });

  it("reports no fees when the tax amount is zero", () => {
    const breakdown = render({ result: { ...result, taxAmount: 0 } });

    expect(breakdown.fees.hasFees).toBe(false);
    expect(breakdown.fees.taxAmount).toBe(0);
  });

  it("converts the estimated print time from minutes to hours", () => {
    const breakdown = render({});

    expect(breakdown.time.estimatedHours).toBe(2.5);
    expect(breakdown.time.billableHours).toBe(2.6);
    expect(breakdown.time.profitPerHour).toBe(11.5);
  });

  it("falls back to zero time metrics when the result is absent", () => {
    const breakdown = render({ result: null });

    expect(breakdown.time).toEqual({
      estimatedHours: 0,
      billableHours: 0,
      profitPerHour: 0,
    });
  });
});
