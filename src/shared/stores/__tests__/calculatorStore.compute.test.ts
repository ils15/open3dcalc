import { describe, expect, it } from "vitest";

import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import type { ComputeStoreInput } from "@/shared/stores/calculatorStore.types";
import {
  createDefaultComputeInput,
  normalizeCalculationInput,
} from "@/shared/stores/calculatorStore.validation";

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

describe("marketplace fixed-fee pricing", () => {
  it.each(["fdm", "resin"] as const)(
    "includes the fixed per-unit marketplace fee for %s",
    (activeTab) => {
      const base = createDefaultComputeInput();
      const sales = {
        ...(activeTab === "fdm" ? base.fdmSales : base.resinSales),
        taxPercent: 5,
        marketplaceFeePercent: 10,
        marketplaceFeeFixed: 4,
        profitMarginPercent: 50,
      };
      const input = buildInput(
        activeTab === "fdm"
          ? { fdmSales: sales }
          : { activeTab, resinSales: sales },
      );
      const result = computeStoreResults(input);

      expect(result.sellPrice).toBeCloseTo(
        (result.totalCost * 1.5 + 4) / 0.85,
        8,
      );
      expect(result.marketplaceFee).toBeCloseTo(result.sellPrice * 0.1 + 4, 8);
      expect(result.profit).toBeCloseTo(result.totalCost * 0.5, 8);
    },
  );

  it("fills the additive fixed fee from the selected marketplace for legacy sales data", () => {
    const defaults = createDefaultComputeInput();
    const normalized = normalizeCalculationInput(
      {
        ...defaults,
        selectedMarketplace: {
          id: "custom",
          name: "Custom",
          feePercent: 12,
          feeFixed: 3.25,
          hasFreeShipping: false,
        },
        fdmSales: { ...defaults.fdmSales, marketplaceFeeFixed: undefined },
        resinSales: { ...defaults.resinSales, marketplaceFeeFixed: undefined },
      },
      defaults,
    );

    expect(normalized.validation.valid).toBe(true);
    expect(normalized.input.fdmSales.marketplaceFeeFixed).toBe(3.25);
    expect(normalized.input.resinSales.marketplaceFeeFixed).toBe(3.25);
  });
});
