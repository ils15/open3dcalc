import { describe, expect, it } from "vitest";

import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import type { ComputeStoreInput } from "@/shared/stores/calculatorStore.types";
import { createDefaultComputeInput } from "@/shared/stores/calculatorStore.validation";

function buildInput(
  overrides: Partial<ComputeStoreInput> = {},
): ComputeStoreInput {
  const base = createDefaultComputeInput();
  return {
    ...base,
    enabledSections: { ...base.enabledSections, material: true },
    ...overrides,
  };
}

describe("computeStoreResults multi-material boundary", () => {
  it("falls back to single-material cost when enabled with no slots", () => {
    const input = buildInput();
    const singleMaterial = computeStoreResults({
      ...input,
      fdmAmsEnabled: false,
    });
    const emptyMultiMaterial = computeStoreResults({
      ...input,
      fdmAmsEnabled: true,
      fdmAmsSlots: [],
    });

    expect(singleMaterial.materialCost).toBeGreaterThan(0);
    expect(emptyMultiMaterial.materialCost).toBe(singleMaterial.materialCost);
    expect(emptyMultiMaterial.subtotal).toBe(singleMaterial.subtotal);
  });

  it("falls back when enabled slots have no positive material weight", () => {
    const input = buildInput();
    const singleMaterial = computeStoreResults({
      ...input,
      fdmAmsEnabled: false,
    });
    const configuredButEmpty = computeStoreResults({
      ...input,
      fdmAmsEnabled: true,
      fdmAmsSlots: [
        {
          enabled: true,
          materialType: "PLA",
          costPerKg: 80,
          weightUsedGrams: 0,
          purgeWeightGrams: 0,
          transitionPurgeGrams: 3,
          density: 1.24,
          spoolEfficiency: 98,
          color: "#ff0000",
        },
      ],
    });

    expect(configuredButEmpty.materialCost).toBe(singleMaterial.materialCost);
  });

  it("keeps the single-material result unchanged for legacy active AMS data", () => {
    const input = buildInput();
    const singleMaterial = computeStoreResults(input);
    const legacyMultiMaterial = computeStoreResults({
      ...input,
      fdmAmsEnabled: true,
      fdmAmsSlots: [
        {
          enabled: true,
          materialType: "PLA",
          costPerKg: 80,
          weightUsedGrams: 50,
          purgeWeightGrams: 5,
          transitionPurgeGrams: 3,
          density: 1.24,
          spoolEfficiency: 98,
          color: "#ff0000",
        },
      ],
    });

    expect(legacyMultiMaterial).toEqual(singleMaterial);
  });
});
