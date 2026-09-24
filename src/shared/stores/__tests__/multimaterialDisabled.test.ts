import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AMSSlot } from "@/shared/types";

const savedSlots: AMSSlot[] = [
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

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("initial calculator load", () => {
  it("disables AMS but preserves persisted slot configuration", async () => {
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify({
        fdmAmsEnabled: true,
        fdmAmsSlots: savedSlots,
      }),
    );

    const { useCalculatorStore } = await import("../calculatorStore");
    const state = useCalculatorStore.getState();

    expect(state.fdmAmsEnabled).toBe(false);
    expect(state.fdmAmsSlots).toEqual(savedSlots);
  });
});
