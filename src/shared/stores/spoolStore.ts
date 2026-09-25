import { create } from "zustand";
import {
  assertPersistableCalculationState,
  type CalculationStateValidationContext,
} from "@/shared/lib/calculationState";
import { guardedStorage } from "@/shared/lib/manifestStorage";

/**
 * Estante de carretéis (W6) — store único do inventário de filamento.
 *
 * Reutiliza a chave do Phase 6 (`open3dcalc_filaments`), já registrada no
 * manifesto SPEC-01 com `class: user_content` — o inventário é DADO DE
 * USUÁRIO, nunca `ui_preference`. O gate do `guardedStorage` descarta
 * escritas de keys não registradas em produção, e o `demoModeStore`
 * suprime escritas durante uma sessão demo (dado efêmero).
 *
 * `filamentInventory.ts` é agora um shim de compatibilidade que re-exporta
 * este store — importa manter um único dono da chave para duas visões
 * (FilamentInventory e SpoolShelf) não divergirem em memória.
 */
export const SPOOLS_KEY = "open3dcalc_filaments";

export type SpoolStatus = "in_stock" | "on_the_way" | "empty";

export interface FilamentSpool {
  id: string;
  brand: string;
  material: string;
  color: string;
  colorHex: string;
  weightGrams: number;
  originalWeightGrams: number;
  costPerKg: number;
  diameterMm: number;
  dateAdded: number;
  notes: string;
  status: SpoolStatus;
  purchaseStore: string;
  /**
   * Tara do carretel (peso do carretel vazio) em gramas — Phase 6 P1 (Wave B).
   * Undefined = não informado; a lib de filamento restante faz lookup da
   * marca como fallback. Sobrescreve a tabela de marca quando presente.
   */
  tareGrams?: number;
}

/**
 * Materiais do spinser de carretéis — o mesmo conjunto do Phase 6, para que
 * carretéis antigos e filtros continuem casando. Fonte única do novo formulário
 * e dos chips de filtro da estante.
 */
export const SPOOL_MATERIALS = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "SILK",
  "Nylon",
  "PVA",
  "HIPS",
  "Outro",
] as const;

export type SpoolSortKey = "name" | "material" | "remaining" | "weight" | "dateAdded";
export type SpoolSortDir = "asc" | "desc";

export interface SpoolFilters {
  /** Texto livre — busca em cor, marca, material e nota. */
  search: string;
  /** "Todos" desativa o filtro de material. */
  material: string;
  /** "all" desativa o filtro de status. */
  status: SpoolStatus | "all";
}

const NO_FILTER_MATERIAL = "Todos";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Porcentagem restante (0–100) para ordenação/barras. */
export function remainingPct(spool: FilamentSpool): number {
  if (spool.originalWeightGrams <= 0) return 0;
  return Math.min(
    100,
    Math.round((spool.weightGrams / spool.originalWeightGrams) * 100),
  );
}

/** Regra única de baixo estoque usada pela contagem e pelo card. */
export function isLowStockSpool(
  spool: Pick<FilamentSpool, "status" | "weightGrams">,
  thresholdGrams: number,
): boolean {
  return spool.status === "in_stock" && spool.weightGrams < thresholdGrams;
}

/** Filtro puro — não muta a entrada. */
export function filterSpools(
  spools: readonly FilamentSpool[],
  filters: SpoolFilters,
): FilamentSpool[] {
  const q = filters.search.trim().toLowerCase();
  const material =
    filters.material && filters.material !== NO_FILTER_MATERIAL
      ? filters.material.toLowerCase()
      : null;
  const status = filters.status === "all" ? null : filters.status;

  return spools.filter((s) => {
    if (status && s.status !== status) return false;
    if (material && s.material.toLowerCase() !== material) return false;
    if (q) {
      const haystack = `${s.color} ${s.brand} ${s.material} ${s.notes}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Ordenação pura, estável (desempate por id) — não muta a entrada. */
export function sortSpools(
  spools: readonly FilamentSpool[],
  key: SpoolSortKey,
  dir: SpoolSortDir,
): FilamentSpool[] {
  const sorted = [...spools];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = collator.compare(a.color, b.color);
        break;
      case "material":
        cmp = collator.compare(a.material, b.material);
        if (cmp === 0) cmp = collator.compare(a.color, b.color);
        break;
      case "remaining":
        cmp = remainingPct(a) - remainingPct(b);
        break;
      case "weight":
        cmp = a.weightGrams - b.weightGrams;
        break;
      case "dateAdded":
        cmp = a.dateAdded - b.dateAdded;
        break;
    }
    if (cmp === 0) cmp = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

interface SpoolInventoryState {
  spools: FilamentSpool[];
  addSpool: (spool: Omit<FilamentSpool, "id" | "dateAdded">) => void;
  removeSpool: (id: string) => void;
  updateSpool: (id: string, updates: Partial<FilamentSpool>) => void;
  deductWeight: (
    id: string,
    grams: number,
    calculationState: CalculationStateValidationContext,
  ) => void;
  getTotalWeight: () => number;
  getSpoolsByMaterial: (material: string) => FilamentSpool[];
  getLowStockSpools: (thresholdGrams: number) => FilamentSpool[];
  getVisibleSpools: (
    filters: SpoolFilters,
    sortKey: SpoolSortKey,
    sortDir: SpoolSortDir,
  ) => FilamentSpool[];
}

const migrateSpool = (s: Record<string, unknown>): FilamentSpool => ({
  id: s.id as string,
  brand: (s.brand as string) || "",
  material: (s.material as string) || "PLA",
  color: (s.color as string) || "",
  colorHex: (s.colorHex as string) || "",
  weightGrams: (s.weightGrams as number) || 0,
  originalWeightGrams: (s.originalWeightGrams as number) || 1000,
  costPerKg: (s.costPerKg as number) || 0,
  diameterMm: (s.diameterMm as number) || 1.75,
  dateAdded: (s.dateAdded as number) || Date.now(),
  notes: (s.notes as string) || "",
  status: (s.status as SpoolStatus) || "in_stock",
  purchaseStore: (s.purchaseStore as string) || "",
  // default-on-missing para payloads legacy — undefined (não 0) para que a
  // lib caia no lookup de marca.
  tareGrams: typeof s.tareGrams === "number" ? s.tareGrams : undefined,
});

const loadSpools = (): FilamentSpool[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = guardedStorage.getItem(SPOOLS_KEY);
    const raw = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).map(migrateSpool);
  } catch {
    return [];
  }
};

const persist = (spools: FilamentSpool[]): void => {
  guardedStorage.setItem(SPOOLS_KEY, JSON.stringify(spools));
};

export const useSpoolStore = create<SpoolInventoryState>((set, get) => ({
  spools: loadSpools(),

  addSpool: (spool) => {
    const newSpool: FilamentSpool = {
      ...spool,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      dateAdded: Date.now(),
    };
    const spools = [...get().spools, newSpool];
    persist(spools);
    set({ spools });
  },

  removeSpool: (id) => {
    const spools = get().spools.filter((s) => s.id !== id);
    persist(spools);
    set({ spools });
  },

  updateSpool: (id, updates) => {
    const spools = get().spools.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    );
    persist(spools);
    set({ spools });
  },

  // This is the final persistence boundary for calculation-driven stock
  // deductions. Every caller must provide the current validation context so
  // direct/future callers cannot bypass the calculator gate.
  deductWeight: (id, grams, calculationState) => {
    assertPersistableCalculationState(calculationState);
    const spools = get().spools.map((s) =>
      s.id === id
        ? { ...s, weightGrams: Math.max(0, s.weightGrams - grams) }
        : s,
    );
    persist(spools);
    set({ spools });
  },

  getTotalWeight: () => {
    return get().spools.reduce((sum, s) => sum + s.weightGrams, 0);
  },

  getSpoolsByMaterial: (material) => {
    return get().spools.filter(
      (s) => s.material.toLowerCase() === material.toLowerCase(),
    );
  },

  getLowStockSpools: (thresholdGrams) => {
    return get().spools.filter((s) => isLowStockSpool(s, thresholdGrams));
  },

  getVisibleSpools: (filters, sortKey, sortDir) => {
    return sortSpools(filterSpools(get().spools, filters), sortKey, sortDir);
  },
}));
