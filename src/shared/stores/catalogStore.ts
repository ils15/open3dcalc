import { create } from "zustand";
import type { Material, PrinterProfile, Marketplace } from "@/shared/types";
import { fdmMaterials, resinMaterials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import { marketplaces } from "@/shared/lib/marketplace";
import { guardedStorage } from "@/shared/lib/manifestStorage";

const STORAGE_KEY = "open3dcalc_catalog_v1";

type CatalogPrinter = PrinterProfile & { custom?: boolean };
type CatalogMaterial = Material & { custom?: boolean };
type CatalogMarketplace = Marketplace & { custom?: boolean };

interface CatalogState {
  printers: CatalogPrinter[];
  materials: CatalogMaterial[];
  marketplaces: CatalogMarketplace[];
  load: () => void;
  save: () => void;
  addPrinter: (printer: CatalogPrinter) => void;
  updatePrinter: (id: string, patch: Partial<CatalogPrinter>) => void;
  removePrinter: (id: string) => void;
  addMaterial: (material: CatalogMaterial) => void;
  updateMaterial: (id: string, patch: Partial<CatalogMaterial>) => void;
  removeMaterial: (id: string) => void;
  addMarketplace: (marketplace: CatalogMarketplace) => void;
  updateMarketplace: (id: string, patch: Partial<CatalogMarketplace>) => void;
  removeMarketplace: (id: string) => void;
}

const cloneDefaults = () => ({
  printers: printers.map((p) => ({ ...p })),
  materials: [...fdmMaterials, ...resinMaterials].map((m) => ({ ...m })),
  marketplaces: marketplaces.map((m) => ({ ...m })),
});

const loadFromStorage = (): Partial<ReturnType<typeof cloneDefaults>> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(guardedStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const persist = (state: ReturnType<typeof cloneDefaults>) => {
  guardedStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useCatalogStore = create<CatalogState>((set, get) => {
  const defaults = cloneDefaults();
  const saved = loadFromStorage();

  const initial = {
    printers: (saved.printers ?? defaults.printers) as CatalogPrinter[],
    materials: (saved.materials ?? defaults.materials) as CatalogMaterial[],
    marketplaces: (saved.marketplaces ??
      defaults.marketplaces) as CatalogMarketplace[],
  };

  return {
    ...initial,

    load: () => {
      const next = loadFromStorage();
      set({
        printers: (next.printers ?? defaults.printers) as CatalogPrinter[],
        materials: (next.materials ?? defaults.materials) as CatalogMaterial[],
        marketplaces: (next.marketplaces ??
          defaults.marketplaces) as CatalogMarketplace[],
      });
    },

    save: () => persist(get()),

    addPrinter: (printer) =>
      set((state) => {
        const next = { ...state, printers: [...state.printers, printer] };
        persist(next);
        return next;
      }),
    updatePrinter: (id, patch) =>
      set((state) => {
        const next = {
          ...state,
          printers: state.printers.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        };
        persist(next);
        return next;
      }),
    removePrinter: (id) =>
      set((state) => {
        const next = {
          ...state,
          printers: state.printers.filter((p) => p.id !== id),
        };
        persist(next);
        return next;
      }),

    addMaterial: (material) =>
      set((state) => {
        const next = { ...state, materials: [...state.materials, material] };
        persist(next);
        return next;
      }),
    updateMaterial: (id, patch) =>
      set((state) => {
        const next = {
          ...state,
          materials: state.materials.map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          ),
        };
        persist(next);
        return next;
      }),
    removeMaterial: (id) =>
      set((state) => {
        const next = {
          ...state,
          materials: state.materials.filter((m) => m.id !== id),
        };
        persist(next);
        return next;
      }),

    addMarketplace: (marketplace) =>
      set((state) => {
        const next = {
          ...state,
          marketplaces: [...state.marketplaces, marketplace],
        };
        persist(next);
        return next;
      }),
    updateMarketplace: (id, patch) =>
      set((state) => {
        const next = {
          ...state,
          marketplaces: state.marketplaces.map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          ),
        };
        persist(next);
        return next;
      }),
    removeMarketplace: (id) =>
      set((state) => {
        const next = {
          ...state,
          marketplaces: state.marketplaces.filter((m) => m.id !== id),
        };
        persist(next);
        return next;
      }),
  };
});
