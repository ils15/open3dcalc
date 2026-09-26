import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySyncData, type SyncData } from "@/shared/lib/dataSync";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

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
});
