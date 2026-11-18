import { create } from "zustand";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

/**
 * Ephemeral in-memory Scenario A/B Comparison store.
 *
 * Deliberately unpersisted (no localStorage writes) so it never touches the
 * SPEC-01 data classification manifest (`dataManifest.ts`), matching the
 * working-memory pattern used by `wizardStore` and `demoModeStore`.
 */
export interface PinnedScenarioSnapshot {
  label: string;
  pinnedAt: number;
  activeTab: "fdm" | "resin";
  materialSummary: string;
  infillPercent: number;
  quantity: number;
  profitMarginPercent: number;
  totalCost: number;
  sellPrice: number;
  profit: number;
  effectiveMarginPercent: number;
}

export interface ScenarioDeltaSummary {
  costDelta: number;
  sellPriceDelta: number;
  profitDelta: number;
  marginDeltaPp: number;
}

interface ScenarioComparisonState {
  pinnedScenario: PinnedScenarioSnapshot | null;
  pinFromCalculator: (customLabel?: string) => boolean;
  clearPinnedScenario: () => void;
}

export function computeEffectiveMarginPercent(
  sellPrice: number,
  profit: number,
): number {
  if (!Number.isFinite(sellPrice) || sellPrice <= 0) return 0;
  if (!Number.isFinite(profit)) return 0;
  return Number(((profit / sellPrice) * 100).toFixed(1));
}

export function computeScenarioDeltas(
  baseline: PinnedScenarioSnapshot,
  current: {
    totalCost: number;
    sellPrice: number;
    profit: number;
  },
): ScenarioDeltaSummary {
  const currentMargin = computeEffectiveMarginPercent(
    current.sellPrice,
    current.profit,
  );
  return {
    costDelta: Number((current.totalCost - baseline.totalCost).toFixed(2)),
    sellPriceDelta: Number((current.sellPrice - baseline.sellPrice).toFixed(2)),
    profitDelta: Number((current.profit - baseline.profit).toFixed(2)),
    marginDeltaPp: Number(
      (currentMargin - baseline.effectiveMarginPercent).toFixed(1),
    ),
  };
}

export const useScenarioComparisonStore = create<ScenarioComparisonState>(
  (set) => ({
    pinnedScenario: null,

    pinFromCalculator: (customLabel) => {
      const state = useCalculatorStore.getState();
      const results = state.results;
      if (!results) return false;

      const isResin = state.activeTab === "resin";
      const materialSummary = isResin
        ? `${state.resinMaterial.type} · ${state.resinMaterial.volumeUsedMl}ml`
        : `${state.fdmMaterial.type} · ${state.fdmMaterial.weightUsed}g`;
      const profitMarginPercent = isResin
        ? state.resinSales.profitMarginPercent
        : state.fdmSales.profitMarginPercent;
      const defaultLabel = state.productName.trim() || materialSummary;

      set({
        pinnedScenario: {
          label: customLabel?.trim() || defaultLabel,
          pinnedAt: Date.now(),
          activeTab: state.activeTab,
          materialSummary,
          infillPercent: state.infillPercent,
          quantity: state.quantity,
          profitMarginPercent,
          totalCost: results.totalCost,
          sellPrice: results.sellPrice,
          profit: results.profit,
          effectiveMarginPercent: computeEffectiveMarginPercent(
            results.sellPrice,
            results.profit,
          ),
        },
      });
      return true;
    },

    clearPinnedScenario: () => set({ pinnedScenario: null }),
  }),
);
