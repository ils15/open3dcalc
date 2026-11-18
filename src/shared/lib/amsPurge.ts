/**
 * Pure multi-color AMS / CFS / ACE Pro / MMU purge & batch dilution math.
 *
 * Kept strictly separate from `src/shared/lib/calculator.ts` (frozen per
 * Phase 7b / Phase 7m) so multi-material waste and full-plate dilution can be
 * computed, previewed, and fed into `weightUsed` without touching the core
 * pricing engine.
 */

export interface AmsPurgeInput {
  /** Number of active colors/filaments (2..16). */
  colorCount: number;
  /** Number of filament changes across the plate. */
  filamentChanges: number;
  /** Average purged filament per swap in grams ("poop"). */
  purgeGramsPerSwap: number;
  /** Prime / wipe tower weight for the whole plate in grams. */
  primeTowerGrams: number;
  /** Net model weight of a single part in grams. */
  partWeightGrams: number;
  /** Number of identical parts printed together on the same plate. */
  batchQuantity: number;
  /** Filament cost per kg in active currency. */
  filamentCostPerKg: number;
}

export interface AmsPurgeResult {
  colorCount: number;
  filamentChanges: number;
  purgeGramsPerSwap: number;
  primeTowerGrams: number;
  partWeightGrams: number;
  batchQuantity: number;
  /** Total purge waste for the plate (filamentChanges * purgeGramsPerSwap). */
  totalPurgeGrams: number;
  /** Total non-part waste on the plate (purge + prime tower). */
  totalWastePerPlateGrams: number;
  /** Waste diluted per unit when printing `batchQuantity` on the same plate. */
  wastePerUnitGrams: number;
  /** Total filament consumed per unit (part + diluted waste). */
  totalFilamentPerUnitGrams: number;
  /** Waste share of total filament per unit (%). */
  wasteSharePercent: number;
  /** Cost of wasted filament per unit. */
  wasteCostPerUnit: number;
  /** Total filament cost per unit (part + diluted waste). */
  totalMaterialCostPerUnit: number;
  /** Baseline total filament per unit if printed alone (batchQuantity = 1). */
  singleUnitTotalGrams: number;
  /** Baseline material cost if printed alone (batchQuantity = 1). */
  singleUnitMaterialCost: number;
  /** Grams saved per unit compared to printing 1 piece at a time. */
  savingsGramsPerUnit: number;
  /** Currency saved per unit compared to printing 1 piece at a time. */
  savingsCostPerUnit: number;
  /** Percentage of material cost saved per unit vs. printing 1 piece alone. */
  savingsPercentVsSingle: number;
}

function finiteNonNegative(value: number, fallback = 0): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function computeAmsPurge(input: AmsPurgeInput): AmsPurgeResult {
  const colorCount = Math.max(2, Math.min(16, Math.round(finiteNonNegative(input.colorCount, 2))));
  const filamentChanges = Math.round(finiteNonNegative(input.filamentChanges, 0));
  const purgeGramsPerSwap = finiteNonNegative(input.purgeGramsPerSwap, 0);
  const primeTowerGrams = finiteNonNegative(input.primeTowerGrams, 0);
  const partWeightGrams = finiteNonNegative(input.partWeightGrams, 0);
  const batchQuantity = Math.max(1, Math.round(finiteNonNegative(input.batchQuantity, 1)));
  const filamentCostPerKg = finiteNonNegative(input.filamentCostPerKg, 0);
  const costPerGram = filamentCostPerKg / 1000;

  const totalPurgeGrams = round2(filamentChanges * purgeGramsPerSwap);
  const totalWastePerPlateGrams = round2(totalPurgeGrams + primeTowerGrams);
  const wastePerUnitGrams = round2(totalWastePerPlateGrams / batchQuantity);
  const totalFilamentPerUnitGrams = round2(partWeightGrams + wastePerUnitGrams);

  const wasteSharePercent =
    totalFilamentPerUnitGrams > 0
      ? Number(((wastePerUnitGrams / totalFilamentPerUnitGrams) * 100).toFixed(1))
      : 0;

  const wasteCostPerUnit = round2(wastePerUnitGrams * costPerGram);
  const totalMaterialCostPerUnit = round2(totalFilamentPerUnitGrams * costPerGram);

  const singleUnitTotalGrams = round2(partWeightGrams + totalWastePerPlateGrams);
  const singleUnitMaterialCost = round2(singleUnitTotalGrams * costPerGram);

  const savingsGramsPerUnit = round2(
    Math.max(0, singleUnitTotalGrams - totalFilamentPerUnitGrams),
  );
  const savingsCostPerUnit = round2(
    Math.max(0, singleUnitMaterialCost - totalMaterialCostPerUnit),
  );
  const savingsPercentVsSingle =
    singleUnitTotalGrams > 0
      ? Number(((savingsGramsPerUnit / singleUnitTotalGrams) * 100).toFixed(1))
      : 0;

  return {
    colorCount,
    filamentChanges,
    purgeGramsPerSwap,
    primeTowerGrams,
    partWeightGrams,
    batchQuantity,
    totalPurgeGrams,
    totalWastePerPlateGrams,
    wastePerUnitGrams,
    totalFilamentPerUnitGrams,
    wasteSharePercent,
    wasteCostPerUnit,
    totalMaterialCostPerUnit,
    singleUnitTotalGrams,
    singleUnitMaterialCost,
    savingsGramsPerUnit,
    savingsCostPerUnit,
    savingsPercentVsSingle,
  };
}
