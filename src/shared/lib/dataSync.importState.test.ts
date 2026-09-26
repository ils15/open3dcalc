import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySyncData, type SyncData } from "@/shared/lib/dataSync";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

const CALCULATOR_SETTING_KEYS = [
  "activeTab",
  "fdmMaterial",
  "fdmPrintParams",
  "fdmSlicerProfile",
  "fdmFilament",
  "fdmMachine",
  "fdmHardware",
  "fdmFinishing",
  "fdmLabor",
  "fdmExtras",
  "fdmSales",
  "fdmOps",
  "fdmSoft",
  "resinMaterial",
  "resinPrintParams",
  "resinPostProcess",
  "resinMachine",
  "resinHardware",
  "resinLabor",
  "resinExtras",
  "resinSales",
  "resinOps",
  "resinSoft",
  "fdmAmsSlots",
  "fixedCosts",
  "productName",
  "quantity",
  "infillPercent",
  "targetMarginMode",
  "enabledSections",
  "calcLevel",
  "hiddenFields",
  "currency",
] as const;

function makeImportedData(): SyncData {
  return {
    settings: {
      activeTab: "fdm",
      quantity: 7,
      productName: "Imported part 🧪",
      selectedPrinterId: "ender-3",
      selectedMarketplaceId: "none",
      currency: "EUR",
      futureUserField: { retain: "✓" },
    },
    history: [
      {
        id: "imported-history-1",
        timestamp: 1_700_000_000_001,
        name: "History item",
        totalCost: 12,
        sellPrice: 24,
        profit: 12,
        result: { totalCost: 12, sellPrice: 24, profit: 12 },
      },
    ],
    customers: [],
    quotes: [],
    catalog: { printers: [], materials: [], marketplaces: [] },
    filaments: [],
    products: [],
    colorPalette: [],
    modelComparison: [],
    theme: "dark",
    dashboard: {},
    sections: {},
  };
}

function calculatorSettingsSnapshot(
  state: ReturnType<typeof useCalculatorStore.getState>,
): Record<string, unknown> {
  return Object.fromEntries(
    CALCULATOR_SETTING_KEYS.map((key) => [key, state[key]]),
  );
}

function seedNonDefaultCalculatorState(): void {
  const current = useCalculatorStore.getState();
  useCalculatorStore.setState({
    activeTab: "resin",
    fdmMachine: { ...current.fdmMachine, machineCost: 98765 },
    productName: "Old destination value",
    quantity: 42,
    calcLevel: "advanced",
    hiddenFields: ["old-field"],
    currency: "USD",
    enabledSections: { ...current.enabledSections, energy: false },
  });
}

describe("dataSync active store import consistency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("hydrates active calculation state and prevents a pending autosave overwriting imports", async () => {
    useCalculatorStore.getState().setQuantity(99);
    const imported = makeImportedData();

    applySyncData(imported, "replace");

    expect(useCalculatorStore.getState().quantity).toBe(7);
    expect(useCalculatorStore.getState().productName).toBe("Imported part 🧪");
    expect(useCalculatorStore.getState().currency).toBe("EUR");
    await vi.advanceTimersByTimeAsync(800);
    expect(JSON.parse(localStorage.getItem("open3dcalc_settings_v2")!)).toEqual(
      imported.settings,
    );

    vi.resetModules();
    const { useCalculatorStore: rehydratedCalculator } =
      await import("@/shared/stores/calculatorStore");
    const { restoreAutoSnapshot } = await import("@/shared/stores/storeBridge");
    expect(restoreAutoSnapshot()).toBe(true);
    expect(rehydratedCalculator.getState().quantity).toBe(7);
    expect(rehydratedCalculator.getState().productName).toBe(
      "Imported part 🧪",
    );
    expect(rehydratedCalculator.getState().currency).toBe("EUR");
  });

  it.each([
    ["empty", {}],
    ["partial", { quantity: 7, productName: "Imported part" }],
  ] as const)(
    "replace with %s settings synchronizes active state with production reload",
    async (_caseName, settings) => {
      seedNonDefaultCalculatorState();
      const imported = makeImportedData();
      imported.settings = settings;

      applySyncData(imported, "replace");

      expect(
        JSON.parse(localStorage.getItem("open3dcalc_settings_v2")!),
      ).toEqual(settings);
      const activeSettings = calculatorSettingsSnapshot(
        useCalculatorStore.getState(),
      );
      vi.resetModules();
      const { useCalculatorStore: rehydratedCalculator } =
        await import("@/shared/stores/calculatorStore");
      const { restoreAutoSnapshot } =
        await import("@/shared/stores/storeBridge");
      expect(restoreAutoSnapshot()).toBe(true);

      expect(activeSettings).toEqual(
        calculatorSettingsSnapshot(rehydratedCalculator.getState()),
      );
      expect(activeSettings.activeTab).toBe("fdm");
      expect(activeSettings.fdmMachine).not.toMatchObject({
        machineCost: 98765,
      });
      if (Object.keys(settings).length === 0) {
        expect(activeSettings.quantity).toBe(1);
        expect(activeSettings.productName).toBe("");
      } else {
        expect(activeSettings.quantity).toBe(7);
        expect(activeSettings.productName).toBe("Imported part");
      }
    },
  );
});
