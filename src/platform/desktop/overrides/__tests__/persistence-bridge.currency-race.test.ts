import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initPersistenceBridge } from "../persistence-bridge";

const settingsKey = "open3dcalc_settings_v2";
const themeKey = "open3dcalc_theme";
const oldSettings = JSON.stringify({
  fdmMaterial: {
    type: "PLA",
    weightUsed: 90,
    costPerKg: 85,
    density: 1.24,
    spoolEfficiency: 1,
  },
  quantity: 5,
  currency: "auto",
  historicalExtension: { keep: "desktop payload" },
});

const durableRows = new Map<string, string>();
const database = {
  listKeys: vi.fn<() => Promise<string[]>>(),
  load: vi.fn<(key: string) => Promise<string | null>>(),
  save: vi.fn<(key: string, value: string) => Promise<void>>(),
  delete: vi.fn<(key: string) => Promise<void>>(),
};

describe("desktop currency close-time persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem(settingsKey, oldSettings);
    localStorage.setItem(themeKey, "system");
    localStorage.setItem("open3dcalc_onboarded", "1");
    durableRows.clear();
    durableRows.set(settingsKey, oldSettings);
    durableRows.set(themeKey, "system");

    database.listKeys.mockImplementation(async () => [...durableRows.keys()]);
    database.load.mockImplementation(
      async (key) => durableRows.get(key) ?? null,
    );
    database.save.mockImplementation(async (key, value) => {
      durableRows.set(key, value);
    });
    database.delete.mockImplementation(async (key) => {
      durableRows.delete(key);
    });
    (
      window as unknown as { electronAPI: { db: typeof database } }
    ).electronAPI = {
      db: database,
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });

  it("flushes the latest currency through the registered bridge handler before restart hydration", async () => {
    const { useCalculatorStore } =
      await import("@/shared/stores/calculatorStore");
    await initPersistenceBridge();

    const { useAppInit } = await import("@/shared/hooks/useAppInit");
    const { unmount } = renderHook(() => useAppInit(vi.fn()));

    act(() => useCalculatorStore.getState().setCurrency("USD"));

    // The persistence bridge listener is registered before useAppInit's
    // beforeunload serializer, matching desktop startup order.
    window.dispatchEvent(new Event("beforeunload"));
    await vi.waitFor(() => {
      expect(JSON.parse(durableRows.get(settingsKey)!).currency).toBe("USD");
    });
    expect(JSON.parse(localStorage.getItem(settingsKey)!).currency).toBe("USD");
    unmount();

    localStorage.clear();
    await initPersistenceBridge();
    const hydrated = JSON.parse(localStorage.getItem(settingsKey)!);
    expect(hydrated.currency).toBe("USD");
    expect(hydrated.quantity).toBe(5);
    expect(hydrated.historicalExtension).toEqual({ keep: "desktop payload" });

    vi.resetModules();
    const restartedStore = await import("@/shared/stores/calculatorStore");
    expect(restartedStore.useCalculatorStore.getState().currency).toBe("USD");
    expect(restartedStore.useCalculatorStore.getState().quantity).toBe(5);
  });
});
