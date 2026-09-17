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
  /**
   * Part extents in mm, or `null` when the file carries no measurable
   * geometry (D-EA6: G-code without positioned moves or `;MINX:` metadata —
   * the UI shows "—" instead of a fake `0.0×0.0×0.0`).
   */
  dimensions: { x: number; y: number; z: number } | null;
  /**
   * Mesh volume in cm³, or `null` when there is no mesh to measure (D-EA6:
   * G-code has real weight/time but no volume — the cell shows "—").
   */
  volumeCm3: number | null;
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
      // D-EA6: the nullable fields above only WIDEN the shape — persisted v1
      // entries always carried concrete numbers, so they stay valid and no
      // state transform (version bump) is required.
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
