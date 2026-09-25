import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initTheme } from "@/shared/hooks/useTheme";
import { initPersistenceBridge } from "../persistence-bridge";

const settingsKey = "open3dcalc_settings_v2";
const themeKey = "open3dcalc_theme";
const legacySettings = JSON.stringify({
  fdmMaterial: { type: "PETG", weightUsed: 115, costPerKg: 82 },
  quantity: 5,
  legacyExtension: { preserve: "desktop snapshot" },
});
const databaseSettings = JSON.stringify({
  ...JSON.parse(legacySettings),
  currency: "GBP",
});

const database = {
  listKeys: vi.fn<() => Promise<string[]>>(),
  load: vi.fn<(key: string) => Promise<string | null>>(),
  save: vi.fn<(key: string, value: string) => Promise<void>>(),
  delete: vi.fn<(key: string) => Promise<void>>(),
};

describe("desktop preference persistence bridge compatibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem(themeKey, "system");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.clearAllMocks();
    database.listKeys.mockResolvedValue([settingsKey, themeKey]);
    database.load.mockImplementation(async (key) => {
      if (key === settingsKey) return databaseSettings;
      if (key === themeKey) return "system";
      return null;
    });
    database.save.mockResolvedValue(undefined);
    database.delete.mockResolvedValue(undefined);
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

  it("hydrates and flushes existing settings/theme formats before the desktop app renders", async () => {
    // Match main.tsx startup: resolve a synchronous theme before starting the
    // bridge, then wait for SQLite hydration before React renders.
    expect(initTheme()).toBe("dark");
    await initPersistenceBridge();

    expect(localStorage.getItem(settingsKey)).toBe(databaseSettings);
    expect(localStorage.getItem(themeKey)).toBe("system");
    expect(database.save).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("beforeunload"));
    await vi.waitFor(() => {
      expect(database.save).toHaveBeenCalledWith(settingsKey, databaseSettings);
      expect(database.save).toHaveBeenCalledWith(themeKey, "system");
    });
  });

  it("restores the SQLite currency after the store module loads before the bridge", async () => {
    localStorage.setItem(
      settingsKey,
      JSON.stringify({ currency: "auto", quantity: 1 }),
    );
    const { useCalculatorStore } =
      await import("@/shared/stores/calculatorStore");
    expect(useCalculatorStore.getState().currency).toBe("auto");

    await initPersistenceBridge();
    const { restoreAutoSnapshot } = await import("@/shared/stores/storeBridge");

    expect(restoreAutoSnapshot()).toBe(true);
    expect(useCalculatorStore.getState().currency).toBe("GBP");
    expect(useCalculatorStore.getState().quantity).toBe(5);
    expect(localStorage.getItem(settingsKey)).toBe(databaseSettings);
  });
});
