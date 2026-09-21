import { create } from "zustand";
import { guardedStorage } from "@/shared/lib/manifestStorage";

/**
 * Chave de persistência da paleta personalizada do usuário.
 *
 * Registrada em `docs/privacy/SPEC-01-manifest-fixture.json` e em
 * `LOCALSTORAGE_KEYS` (persistence-bridge) — o gate do guardedStorage
 * descarta silenciosamente escritas de keys não registradas em produção.
 */
export const COLOR_PALETTE_KEY = "open3dcalc_color_palette_v1";

export interface CustomColor {
  id: string;
  name: string;
  hex: string;
}

interface ColorPaletteState {
  colors: CustomColor[];
  addColor: (name: string, hex: string) => void;
  removeColor: (id: string) => void;
}

const migrateColor = (c: Record<string, unknown>): CustomColor => ({
  id: (c.id as string) || "",
  name: (c.name as string) || "",
  hex: (c.hex as string) || "#6366f1",
});

const loadColors = (): CustomColor[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = guardedStorage.getItem(COLOR_PALETTE_KEY);
    const raw = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).map(migrateColor);
  } catch {
    return [];
  }
};

export const useColorPalette = create<ColorPaletteState>((set, get) => ({
  colors: loadColors(),

  addColor: (name, hex) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newColor: CustomColor = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: trimmed,
      hex: hex || "#6366f1",
    };
    const colors = [...get().colors, newColor];
    guardedStorage.setItem(COLOR_PALETTE_KEY, JSON.stringify(colors));
    set({ colors });
  },

  removeColor: (id) => {
    const colors = get().colors.filter((c) => c.id !== id);
    guardedStorage.setItem(COLOR_PALETTE_KEY, JSON.stringify(colors));
    set({ colors });
  },
}));
