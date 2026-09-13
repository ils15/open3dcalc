import { create } from "zustand";
import { persist } from "zustand/middleware";
import { manifestStorage } from "@/shared/lib/manifestStorage";

/**
 * Model comparison (Fase 2) — keeps the last parsed models side by side so
 * the user can compare cost drivers before committing to a print. Entries
 * are derived metadata (no PII): names, dimensions, weights, times.
 */

export interface ComparisonEntry {
  id: string;
  fileName: string;
  dimensions: { x: number; y: number; z: number };
  volumeCm3: number;
  weight: number;
  printTimeHours: number;
  triangleCount: number;
}

export const MAX_COMPARISON_ENTRIES = 4;

interface ModelComparisonStore {
  entries: ComparisonEntry[];
  add: (entry: Omit<ComparisonEntry, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

let nextId = 1;

export const useModelComparison = create<ModelComparisonStore>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (entry) => {
        const entries = [
          ...get().entries.filter(
            (e) => e.fileName !== entry.fileName || e.weight !== entry.weight,
          ),
          { ...entry, id: `cmp-${nextId++}` },
        ].slice(-MAX_COMPARISON_ENTRIES);
        set({ entries });
      },
      remove: (id) =>
        set({ entries: get().entries.filter((e) => e.id !== id) }),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "open3dcalc_model_comparison",
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
