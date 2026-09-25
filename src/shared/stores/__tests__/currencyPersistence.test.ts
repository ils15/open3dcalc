import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const legacySettings = {
  fdmMaterial: {
    type: "PLA",
    weightUsed: 91,
    costPerKg: 90,
    density: 1.24,
    spoolEfficiency: 1,
  },
  fdmSlicerProfile: { wallCount: 4, layerHeightMm: 0.16 },
  quantity: 3,
  infillPercent: 42,
  calcLevel: "advanced",
  hiddenFields: ["fdmLabor.hourlyRate"],
  futureUserField: { source: "version-before-this-release", preserve: true },
};

describe("currency persistence compatibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify(legacySettings),
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("loads an older settings payload with no currency without losing its saved fields", async () => {
    const { useCalculatorStore } = await import("../calculatorStore");
    const state = useCalculatorStore.getState();

    expect(state.currency).toBe("auto");
    expect(state.fdmMaterial.weightUsed).toBe(91);
    expect(state.fdmSlicerProfile.wallCount).toBe(4);
    expect(state.quantity).toBe(3);
    expect(state.infillPercent).toBe(42);
    expect(state.calcLevel).toBe("advanced");
    expect(state.hiddenFields).toEqual(["fdmLabor.hourlyRate"]);
    expect(JSON.parse(localStorage.getItem("open3dcalc_settings_v2")!)).toEqual(
      legacySettings,
    );
  });

  it("round-trips a currency change without dropping fields from the older payload", async () => {
    const { useCalculatorStore } = await import("../calculatorStore");

    useCalculatorStore.getState().setCurrency("USD");
    await vi.advanceTimersByTimeAsync(800);

    const saved = JSON.parse(
      localStorage.getItem("open3dcalc_settings_v2")!,
    ) as Record<string, unknown>;

    expect(saved.currency).toBe("USD");
    expect(saved.quantity).toBe(3);
    expect(saved.fdmSlicerProfile).toMatchObject(
      legacySettings.fdmSlicerProfile,
    );
    expect(saved.hiddenFields).toEqual(legacySettings.hiddenFields);
    expect(saved.futureUserField).toEqual(legacySettings.futureUserField);
  });
});
