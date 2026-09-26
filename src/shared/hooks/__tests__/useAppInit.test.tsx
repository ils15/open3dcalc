import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageGetItem = vi.hoisted(() => vi.fn());
const storageSetItem = vi.hoisted(() => vi.fn());
const storageRemoveItem = vi.hoisted(() => vi.fn());
const storageValues = vi.hoisted(() => new Map<string, string>());
const calculatorSetState = vi.hoisted(() => vi.fn());
const calculatorState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const sharedCalculation = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/shared/lib/manifestStorage", () => ({
  guardedStorage: {
    getItem: (key: string) => storageGetItem(key),
    setItem: (key: string, value: string) => storageSetItem(key, value),
    removeItem: (key: string) => storageRemoveItem(key),
  },
  manifestStorage: () => ({
    getItem: (key: string) => {
      const value = storageGetItem(key);
      return value === null ? null : JSON.parse(value);
    },
    setItem: (key: string, value: unknown) =>
      storageSetItem(key, JSON.stringify(value)),
    removeItem: (key: string) => storageRemoveItem(key),
  }),
}));

vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: {
    getState: () =>
      calculatorState.current ?? {
        quantity: 1,
        calculationIssues: [],
      },
    setState: calculatorSetState,
  },
}));

vi.mock("@/shared/stores/calculatorStore.compute", () => ({
  computeStoreResults: vi.fn(),
}));

vi.mock("@/shared/lib/calculationLink", () => ({
  getSharedCalculation: vi.fn(() => sharedCalculation.current),
}));

vi.mock("@/shared/lib/printers", () => ({ printers: [] }));
vi.mock("@/shared/lib/marketplace", () => ({ marketplaces: [] }));
vi.mock("@/shared/hooks/useTutorialTabNavigation", () => ({
  useTutorialTabNavigation: vi.fn(),
}));

import { useAppInit } from "../useAppInit";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

describe("useAppInit tutorial auto-start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageValues.clear();
    storageGetItem.mockImplementation(
      (key: string) => storageValues.get(key) ?? null,
    );
    storageSetItem.mockImplementation((key: string, value: string) => {
      storageValues.set(key, value);
    });
    storageRemoveItem.mockImplementation((key: string) => {
      storageValues.delete(key);
    });
    useHistoryStore.setState({ entries: [] });
    sharedCalculation.current = null;
    calculatorState.current = null;
    vi.useFakeTimers();
    localStorage.clear();
    storageGetItem.mockImplementation((key: string) =>
      key === "open3dcalc_onboarded" ? "1" : (storageValues.get(key) ?? null),
    );
    useLayoutStore.setState({ layoutMode: "classic" });
    useTutorialStore.setState({
      isActive: false,
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      completedTours: [],
      sessionDismissed: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(["guided", "bento"] as const)(
    "does not auto-start the tutorial in %s layout",
    (layoutMode) => {
      useLayoutStore.setState({ layoutMode });
      renderHook(() => useAppInit(vi.fn()));

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(useTutorialStore.getState().isActive).toBe(false);
    },
  );

  it("auto-starts the tutorial in Classic", () => {
    renderHook(() => useAppInit(vi.fn()));

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(useTutorialStore.getState().isActive).toBe(true);
  });

  it("forces AMS off from a shared URL while preserving its slots", () => {
    const slots = [
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
    sharedCalculation.current = {
      activeTab: "fdm",
      fdmAmsEnabled: true,
      fdmAmsSlots: slots,
    };
    window.location.hash = "#shared-calculation";

    renderHook(() => useAppInit(vi.fn()));

    expect(calculatorSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        fdmAmsEnabled: false,
        fdmAmsSlots: slots,
      }),
    );
    expect(window.location.hash).toBe("");
  });

  it("routes go-products events and removes the listener on unmount", () => {
    const navigate = vi.fn();
    const { unmount } = renderHook(() => useAppInit(navigate));

    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("products");

    unmount();
    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("saves the currency and retains older settings fields on beforeunload", () => {
    const oldSettings = JSON.stringify({
      quantity: 3,
      futureUserField: { keep: true },
    });
    storageGetItem.mockImplementation((key: string) => {
      if (key === "open3dcalc_settings_v2") return oldSettings;
      return key === "open3dcalc_onboarded" ? "1" : null;
    });
    calculatorState.current = {
      quantity: 3,
      calculationIssues: [],
      currency: "GBP",
      selectedPrinter: { id: "printer-legacy" },
      selectedMarketplace: { id: "marketplace-legacy" },
    };

    const { unmount } = renderHook(() => useAppInit(vi.fn()));
    act(() => window.dispatchEvent(new Event("beforeunload")));
    unmount();

    const settingsWrite = storageSetItem.mock.calls.find(
      ([key]) => key === "open3dcalc_settings_v2",
    );
    expect(settingsWrite).toBeDefined();
    const saved = JSON.parse(settingsWrite![1] as string) as Record<
      string,
      unknown
    >;
    expect(saved.currency).toBe("GBP");
    expect(saved.quantity).toBe(3);
    expect(saved.futureUserField).toEqual({ keep: true });
  });

  it("does not delete the current product-store wrapper when history is empty", () => {
    const wrapper = JSON.stringify({
      state: { products: [{ id: "product-1", name: "Peça salva" }] },
      version: 1,
    });
    storageValues.set("open3dcalc_products", wrapper);

    renderHook(() => useAppInit(vi.fn()));

    expect(storageValues.get("open3dcalc_products")).toBe(wrapper);
    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it("migrates literal legacy products without removing the source before verifying the entries", () => {
    const result = {
      totalCost: 12.5,
      sellPrice: 25,
      profit: 12.5,
      materialCost: 8,
      energyCost: 1,
      machineCost: 2,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 0.5,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 1,
      subtotal: 12.5,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.25,
      costPerUnit: 12.5,
      unitWeight: 50,
      estimatedPrintTime: 2,
      targetMarginPercent: 50,
      breakEvenPrice: 12.5,
      actualMargin: 50,
      carbonFootprintGrams: 3,
    };
    const snapshot = { type: "resin" as const, summary: "Resina • azul" };
    const legacyProducts = [
      {
        id: "legacy-product-7",
        timestamp: 1_700_000_000_007,
        name: "Peça 🧪",
        result,
        snapshot,
      },
    ];
    storageValues.set("open3dcalc_products", JSON.stringify(legacyProducts));
    const expectedEntry = {
      id: "legacy-product-7",
      timestamp: 1_700_000_000_007,
      type: "resin",
      name: "Peça 🧪",
      summary: "Resina • azul",
      totalCost: 12.5,
      sellPrice: 25,
      profit: 12.5,
      result,
      snapshot,
    };
    let verifiedAtRemoval = false;
    storageRemoveItem.mockImplementation((key: string) => {
      if (key === "open3dcalc_products") {
        verifiedAtRemoval =
          JSON.stringify(useHistoryStore.getState().entries) ===
          JSON.stringify([expectedEntry]);
      }
      storageValues.delete(key);
    });

    renderHook(() => useAppInit(vi.fn()));

    const migrated = useHistoryStore.getState().entries;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual(expectedEntry);
    expect(verifiedAtRemoval).toBe(true);
    expect(storageValues.has("open3dcalc_products")).toBe(false);

    renderHook(() => useAppInit(vi.fn()));
    expect(useHistoryStore.getState().entries).toEqual(migrated);
  });

  it("keeps unconvertible legacy product records instead of dropping their source", () => {
    const raw = JSON.stringify([
      { id: "legacy-without-result", name: "Salvo" },
    ]);
    storageValues.set("open3dcalc_products", raw);

    renderHook(() => useAppInit(vi.fn()));

    expect(storageValues.get("open3dcalc_products")).toBe(raw);
    expect(useHistoryStore.getState().entries).toEqual([]);
    expect(storageRemoveItem).not.toHaveBeenCalledWith("open3dcalc_products");
  });

  it("retains and verifies legacy history in its destination key without deleting it", () => {
    const result = {
      totalCost: 18,
      sellPrice: 36,
      profit: 18,
      materialCost: 12,
      energyCost: 2,
      machineCost: 2,
      hardwareCost: 0,
      consumablesCost: 0,
      laborCost: 1,
      softwareCost: 0,
      failureCost: 0,
      extrasCost: 0,
      postProcessingCost: 1,
      subtotal: 18,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.3,
      costPerUnit: 18,
      unitWeight: 60,
      estimatedPrintTime: 3,
      targetMarginPercent: 50,
      breakEvenPrice: 18,
      actualMargin: 50,
      carbonFootprintGrams: 4,
    };
    const snapshot = { type: "fdm" as const, summary: "PETG café" };
    storageValues.set(
      "open3dcalc_history_v2",
      JSON.stringify([
        {
          id: "legacy-history-9",
          timestamp: 1_700_000_000_009,
          type: "fdm",
          summary: "PETG café",
          totalCost: 18,
          sellPrice: 36,
          profit: 18,
          result,
          snapshot,
        },
      ]),
    );

    renderHook(() => useAppInit(vi.fn()));

    const migrated = useHistoryStore.getState().entries;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual({
      id: "legacy-history-9",
      timestamp: 1_700_000_000_009,
      type: "fdm",
      name: "PETG café",
      summary: "PETG café",
      totalCost: 18,
      sellPrice: 36,
      profit: 18,
      result,
      snapshot,
    });
    expect(storageValues.has("open3dcalc_history_v2")).toBe(true);
    expect(
      JSON.parse(storageValues.get("open3dcalc_history_v2")!).state.entries,
    ).toEqual(migrated);

    renderHook(() => useAppInit(vi.fn()));
    expect(useHistoryStore.getState().entries).toEqual(migrated);
  });
});
