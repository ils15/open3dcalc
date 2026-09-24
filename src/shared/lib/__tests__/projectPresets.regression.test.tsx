import { render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";
import { CostSummaryCard } from "@/shared/components/Results/CostSummaryCard";
import { buildProjectPresetDraft, projectPresets } from "@/shared/lib/projectPresets";
import { materials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { restoreAutoSnapshot } from "@/shared/stores/storeBridge";
import type {
  CalculationResult,
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

const LABOR: LaborCosts = {
  enabled: true,
  setupTimeMinutes: 30,
  postProcessingTimeMinutes: 0,
  hourlyRate: 25,
};

const resetAll = (): void => {
  localStorage.clear();
  useCatalogStore.setState({
    printers: printers.map((printer) => ({ ...printer })),
    materials: materials.map((material) => ({ ...material })),
  });
  useCalculatorStore.getState().resetCalculator();
  useCalculatorStore.setState({ history: [], productName: "" });
  useLayoutStore.setState({ layoutMode: "classic" });
};

const buildDraft = (index: number) =>
  buildProjectPresetDraft(
    useCalculatorStore.getState(),
    projectPresets[index],
    {
      catalog: useCatalogStore.getState(),
      productName: projectPresets[index].id,
    },
  );

const applyPreset = (index: number): void => {
  useCalculatorStore.getState().applyProjectPresetDraft(buildDraft(index));
};

const partialFdmPrintParams = (): PrintParameters =>
  ({
    printTimeHours: 2.3,
    printerPowerWatts: 350,
    failureMode: "percent",
    failureValue: 5,
    energyCostPerKwh: undefined,
  }) as unknown as PrintParameters;

const cloneResult = (result: CalculationResult): CalculationResult =>
  JSON.parse(JSON.stringify(result)) as CalculationResult;

beforeEach(() => {
  resetAll();
});

describe("project preset result regression", () => {
  it.each(projectPresets.map((preset, index) => [preset.id, index] as const))(
    "recalculates positive total and sell price for %s",
    (_id, index) => {
      applyPreset(index);

      const result = useCalculatorStore.getState().results;
      expect(result).not.toBeNull();
      expect(result?.totalCost).toBeGreaterThan(0);
      expect(result?.sellPrice).toBeGreaterThan(0);
    },
  );

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
    applyPreset(1);

    const state = useCalculatorStore.getState();
    const result = state.results;
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

  it("keeps the failure cost visible instead of rendering the dash placeholder", () => {
    applyPreset(1);
    const state = useCalculatorStore.getState();
    const result = state.results;
    expect(result).not.toBeNull();
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
    "labor-before-preset",
    "preset-before-labor",
    "labor-before-preset-level",
    "preset-twice",
    "preset-hidden-field",
  ] as const)("keeps results finite for %s", (scenario) => {
    useCalculatorStore.setState({ fdmPrintParams: partialFdmPrintParams() });
    if (scenario === "labor-before-preset" || scenario === "labor-before-preset-level") {
      useCalculatorStore.getState().setFdmLabor(LABOR);
    }
    if (scenario === "preset-hidden-field") {
      useCalculatorStore.getState().toggleField("labor.hourlyRate");
    }
    applyPreset(1);
    if (scenario === "preset-before-labor") {
      useCalculatorStore.getState().setFdmLabor(LABOR);
    }
    if (scenario === "labor-before-preset-level") {
      useCalculatorStore.getState().setCalcLevel("advanced");
    }
    if (scenario === "preset-twice") {
      applyPreset(1);
    }

    const result = useCalculatorStore.getState().results;
    expect(result?.totalCost, scenario).toBeGreaterThan(0);
    expect(result?.sellPrice, scenario).toBeGreaterThan(0);
    expect(result?.energyCost, scenario).toBeGreaterThan(0);
    expect(result?.failureCost, scenario).toBeGreaterThan(0);
  });

  it("normalizes partial material, print, labor, and history slices", () => {
    const state = useCalculatorStore.getState();
    const partialSnapshot = {
      ...state,
      fdmMaterial: {
        type: "PETG",
        weightUsed: 48,
        costPerKg: 110,
      },
      fdmPrintParams: partialFdmPrintParams(),
      fdmLabor: { enabled: true, setupTimeMinutes: 30 } as LaborCosts,
      results: null,
    } as unknown as CalculationSnapshot;

    useCalculatorStore.getState().loadHistoryItem(partialSnapshot);
    const restored = useCalculatorStore.getState();
    expect(restored.fdmMaterial.density).toBe(1.24);
    expect(restored.fdmPrintParams.energyCostPerKwh).toBe(0.8);
    expect(restored.fdmLabor.hourlyRate).toBe(25);
    expect(restored.results?.totalCost).toBeGreaterThan(0);
  });

  it.each(projectPresets.map((preset, index) => [preset.id, index] as const))(
    "keeps Classic and Bento results in parity for %s",
    (_id, index) => {
      resetAll();
      useLayoutStore.setState({ layoutMode: "classic" });
      applyPreset(index);
      const classic = cloneResult(useCalculatorStore.getState().results!);

      resetAll();
      useLayoutStore.setState({ layoutMode: "bento" });
      applyPreset(index);
      const bento = cloneResult(useCalculatorStore.getState().results!);

      expect(bento).toEqual(classic);
      expect(bento.totalCost).toBeGreaterThan(0);
      expect(bento.sellPrice).toBeGreaterThan(0);
    },
  );
});
