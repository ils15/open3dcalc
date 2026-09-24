import { render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CostSummaryCard } from "@/shared/components/Results/CostSummaryCard";
import { useFinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";
import { materials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import { buildSnapshot } from "@/shared/stores/__tests__/calculatorStore.test-utils";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { restoreAutoSnapshot } from "@/shared/stores/storeBridge";
import type {
  AMSSlot,
  CalculationSnapshot,
  LaborCosts,
  PrintParameters,
} from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", resolvedLanguage: "pt-BR" },
  }),
}));

const savedAmsSlots: AMSSlot[] = [
  {
    enabled: true,
    materialType: "PETG",
    costPerKg: 90,
    weightUsedGrams: 42,
    purgeWeightGrams: 4,
    transitionPurgeGrams: 3,
    density: 1.27,
    spoolEfficiency: 97,
    color: "#00ff00",
  },
];

const LABOR: LaborCosts = {
  enabled: true,
  setupTimeMinutes: 30,
  postProcessingTimeMinutes: 0,
  hourlyRate: 25,
};

const RESTORE_SCENARIOS = ["fdm-default", "resin-default", "partial-legacy"] as const;
type RestoreScenario = (typeof RESTORE_SCENARIOS)[number];

const resetAll = (): void => {
  localStorage.clear();
  useCatalogStore.setState({
    printers: printers.map((printer) => ({ ...printer })),
    materials: materials.map((material) => ({ ...material })),
  });
  useCalculatorStore.getState().resetCalculator();
  useCalculatorStore.setState({ history: [], productName: "" });
};

const partialFdmPrintParams = (): PrintParameters =>
  ({
    printTimeHours: 2.3,
    printerPowerWatts: 350,
    failureMode: "percent",
    failureValue: 5,
    energyCostPerKwh: undefined,
  }) as unknown as PrintParameters;

const partialFdmMaterial = (): CalculationSnapshot["fdmMaterial"] =>
  ({
    type: "PETG",
    weightUsed: 48,
    costPerKg: 110,
  }) as CalculationSnapshot["fdmMaterial"];

const partialFdmLabor = (): LaborCosts =>
  ({
    enabled: true,
    setupTimeMinutes: 30,
  }) as LaborCosts;

const buildRestoreSnapshot = (scenario: RestoreScenario): CalculationSnapshot => {
  const snapshot = buildSnapshot();

  if (scenario === "partial-legacy") {
    return {
      ...snapshot,
      type: "fdm",
      fdmMaterial: partialFdmMaterial(),
      fdmPrintParams: partialFdmPrintParams(),
      fdmLabor: partialFdmLabor(),
      results: null,
    };
  }

  if (scenario === "resin-default") {
    return {
      ...snapshot,
      type: "resin",
      resinPrintParams: {
        ...snapshot.resinPrintParams,
        printTimeHours: 4,
        printerPowerWatts: 150,
        failureMode: "percent",
        failureValue: 15,
      },
    };
  }

  return snapshot;
};

const restoreSnapshot = (scenario: RestoreScenario): void => {
  useCalculatorStore
    .getState()
    .loadHistoryItem(buildRestoreSnapshot(scenario));
};

beforeEach(() => {
  resetAll();
});

describe("snapshot restore result regression", () => {
  it.each(RESTORE_SCENARIOS)(
    "recalculates positive total and sell price for %s",
    (scenario) => {
      restoreSnapshot(scenario);

      const result = useCalculatorStore.getState().results;
      expect(result).not.toBeNull();
      expect(result?.totalCost).toBeGreaterThan(0);
      expect(result?.sellPrice).toBeGreaterThan(0);
    },
  );

  it("keeps restored material cost positive without configured multi-material slots", () => {
    restoreSnapshot("partial-legacy");

    const result = useCalculatorStore.getState().results;
    expect(result).not.toBeNull();
    expect(result?.materialCost).toBeGreaterThan(0);
  });

  it("forces AMS off while preserving slots from history", () => {
    const snapshot = {
      ...buildSnapshot(),
      fdmAmsEnabled: true,
      fdmAmsSlots: savedAmsSlots,
    };

    useCalculatorStore.getState().loadHistoryItem(snapshot);

    const state = useCalculatorStore.getState();
    expect(state.fdmAmsEnabled).toBe(false);
    expect(state.fdmAmsSlots).toEqual(savedAmsSlots);
  });

  it("forces AMS off while preserving slots from an auto snapshot", () => {
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify({
        activeTab: "fdm",
        fdmAmsEnabled: true,
        fdmAmsSlots: savedAmsSlots,
      }),
    );

    expect(restoreAutoSnapshot()).toBe(true);

    const state = useCalculatorStore.getState();
    expect(state.fdmAmsEnabled).toBe(false);
    expect(state.fdmAmsSlots).toEqual(savedAmsSlots);
  });

  it("restores a partial legacy slice without losing energy or failure cost", () => {
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify({
        activeTab: "fdm",
        fdmMaterial: {
          type: "PETG",
          weightUsed: 48,
          costPerKg: 110,
        },
        fdmPrintParams: partialFdmPrintParams(),
        fdmFilament: { purgePercent: 10 },
        fdmLabor: LABOR,
      }),
    );

    expect(restoreAutoSnapshot()).toBe(true);

    const state = useCalculatorStore.getState();
    const result = state.results;
    expect(result).not.toBeNull();
    expect(state.fdmPrintParams.energyCostPerKwh).toBe(0.8);
    expect(state.fdmMaterial.spoolEfficiency).toBe(98);
    expect(state.fdmFilament.filamentDiameterMm).toBe(1.75);
    expect(state.fdmLabor.hourlyRate).toBe(25);
    expect(result?.totalCost).toBeGreaterThan(0);
    expect(result?.sellPrice).toBeGreaterThan(0);
    expect(result?.energyCost).toBeGreaterThan(0);
    expect(result?.failureCost).toBeGreaterThan(0);
    expect(Number.isFinite(result?.profit)).toBe(true);
  });

  it("keeps energy and failure visible instead of rendering the dash placeholder", () => {
    restoreSnapshot("partial-legacy");
    const state = useCalculatorStore.getState();
    const result = state.results;
    expect(result).not.toBeNull();
    expect(result?.energyCost).toBeGreaterThan(0);
    expect(result?.failureCost).toBeGreaterThan(0);

    const { result: hook } = renderHook(() =>
      useFinancialBreakdown({
        result,
        activeTab: "fdm",
        sellOverride: null,
        fdmSales: state.fdmSales,
        resinSales: state.resinSales,
      }),
    );
    const breakdown = hook.current;
    expect(breakdown.chartData.some((entry) => entry.category === "energy")).toBe(true);
    expect(breakdown.chartData.some((entry) => entry.category === "failure")).toBe(true);

    render(
      <CostSummaryCard
        costPerGram={result?.costPerGram ?? 0}
        failureCost={result?.failureCost ?? Number.NaN}
      />,
    );
    expect(screen.queryByText("---")).not.toBeInTheDocument();
  });

  it.each([
    "labor-before-snapshot",
    "snapshot-before-labor",
    "labor-before-level",
    "snapshot-twice",
    "snapshot-hidden-field",
  ] as const)("keeps results finite for %s", (scenario) => {
    const snapshot = buildRestoreSnapshot("partial-legacy");
    useCalculatorStore.setState({ fdmPrintParams: partialFdmPrintParams() });
    if (scenario === "labor-before-snapshot" || scenario === "labor-before-level") {
      useCalculatorStore.getState().setFdmLabor(LABOR);
    }
    if (scenario === "snapshot-hidden-field") {
      useCalculatorStore.getState().toggleField("labor.hourlyRate");
    }

    useCalculatorStore.getState().loadHistoryItem(snapshot);
    if (scenario === "snapshot-before-labor") {
      useCalculatorStore.getState().setFdmLabor(LABOR);
    }
    if (scenario === "labor-before-level") {
      useCalculatorStore.getState().setCalcLevel("advanced");
    }
    if (scenario === "snapshot-twice") {
      useCalculatorStore.getState().loadHistoryItem(snapshot);
    }

    const result = useCalculatorStore.getState().results;
    expect(result?.totalCost, scenario).toBeGreaterThan(0);
    expect(result?.sellPrice, scenario).toBeGreaterThan(0);
    expect(result?.energyCost, scenario).toBeGreaterThan(0);
    expect(result?.failureCost, scenario).toBeGreaterThan(0);
  });

  it("normalizes partial material, print, labor, and history slices", () => {
    const partialSnapshot = buildSnapshot({
      fdmMaterial: partialFdmMaterial(),
      fdmPrintParams: partialFdmPrintParams(),
      fdmLabor: partialFdmLabor(),
      results: null,
    });

    useCalculatorStore.getState().loadHistoryItem(partialSnapshot);
    const restored = useCalculatorStore.getState();
    expect(restored.fdmMaterial.density).toBe(1.24);
    expect(restored.fdmPrintParams.energyCostPerKwh).toBe(0.8);
    expect(restored.fdmLabor.hourlyRate).toBe(25);
    expect(restored.results?.totalCost).toBeGreaterThan(0);
    expect(restored.results?.failureCost).toBeGreaterThan(0);
  });

  it("keeps corrupted history inputs finite and records issues", () => {
    const snapshot = buildSnapshot();
    const corrupted = buildSnapshot({
      fdmPrintParams: {
        ...snapshot.fdmPrintParams,
        energyCostPerKwh: Number.NaN,
      },
      fdmMachine: {
        ...snapshot.fdmMachine,
        hoursPerMonth: Number.POSITIVE_INFINITY,
      },
    });

    useCalculatorStore.getState().loadHistoryItem(corrupted);

    const state = useCalculatorStore.getState();
    expect(Number.isFinite(state.results?.totalCost)).toBe(true);
    expect(Number.isFinite(state.results?.sellPrice)).toBe(true);
    expect(Number.isFinite(state.results?.profit)).toBe(true);
    expect(state.calculationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "fdmPrintParams.energyCostPerKwh" }),
        expect.objectContaining({ path: "fdmMachine.hoursPerMonth" }),
      ]),
    );
  });

  it("preserves the current slice when an auto snapshot omits it", () => {
    const store = useCalculatorStore.getState();
    store.setFdmMachine({ ...store.fdmMachine, hoursPerMonth: 123 });
    store.setFdmSales({ ...store.fdmSales, taxPercent: 7 });
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify({ activeTab: "fdm" }),
    );

    expect(restoreAutoSnapshot()).toBe(true);

    const restored = useCalculatorStore.getState();
    expect(restored.fdmMachine.hoursPerMonth).toBe(123);
    expect(restored.fdmSales.taxPercent).toBe(7);
  });
});
