import { describe, it, expect } from "vitest";
import { computeAmsPurge } from "../amsPurge";

describe("computeAmsPurge", () => {
  it("computes purge, prime tower, and full-plate batch dilution accurately", () => {
    // 4-color print, 120 swaps * 0.65g = 78g purge + 12g prime tower = 90g plate waste
    const single = computeAmsPurge({
      colorCount: 4,
      filamentChanges: 120,
      purgeGramsPerSwap: 0.65,
      primeTowerGrams: 12,
      partWeightGrams: 40,
      batchQuantity: 1,
      filamentCostPerKg: 120,
    });

    expect(single.totalPurgeGrams).toBe(78);
    expect(single.totalWastePerPlateGrams).toBe(90);
    expect(single.wastePerUnitGrams).toBe(90);
    expect(single.totalFilamentPerUnitGrams).toBe(130);
    expect(single.savingsGramsPerUnit).toBe(0);

    // Same plate with 6 identical parts: 90g / 6 = 15g waste per part
    const batch = computeAmsPurge({
      colorCount: 4,
      filamentChanges: 120,
      purgeGramsPerSwap: 0.65,
      primeTowerGrams: 12,
      partWeightGrams: 40,
      batchQuantity: 6,
      filamentCostPerKg: 120,
    });

    expect(batch.wastePerUnitGrams).toBe(15);
    expect(batch.totalFilamentPerUnitGrams).toBe(55);
    expect(batch.savingsGramsPerUnit).toBe(75);
    expect(batch.savingsCostPerUnit).toBe(9);
    expect(batch.savingsPercentVsSingle).toBeCloseTo(57.7, 1);
  });

  it("sanitizes invalid/negative inputs safely", () => {
    const res = computeAmsPurge({
      colorCount: 1,
      filamentChanges: -10,
      purgeGramsPerSwap: Number.NaN,
      primeTowerGrams: -5,
      partWeightGrams: 25,
      batchQuantity: 0,
      filamentCostPerKg: 100,
    });

    expect(res.colorCount).toBe(2);
    expect(res.batchQuantity).toBe(1);
    expect(res.totalFilamentPerUnitGrams).toBe(25);
    expect(res.wasteCostPerUnit).toBe(0);
  });
});
