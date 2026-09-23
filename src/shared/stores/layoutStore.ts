import { create } from "zustand";
import { guardedStorage } from "@/shared/lib/manifestStorage";

/**
 * Layout mode preference — V2.0 Wave 1 (Adaptive Layouts).
 *
 * The app can present the calculator through different surfaces:
 * - "classic": section-based calculator (SectionNav + ResultsPanel) — the
 *   only surface implemented in W1; the others fall back to it until W3/W4.
 * - "guided": step-by-step wizard (W4 — not implemented yet).
 * - "bento": compact card grid (W3 — not implemented yet).
 *
 * Why a separate store instead of a calculatorStore field: `layoutMode` is an
 * ergonomic UI preference and MUST stay out of the calculator undo snapshot.
 * calculatorStore.captureSnapshot() whitelists data fields, but collocating
 * the preference there would still tempt future undo bugs (undoing a cost
 * edit would revert the layout the user chose). Keeping it in its own store
 * makes the isolation structural, not conventional.
 *
 * Persistence follows the colorPalette pattern: manual guardedStorage calls
 * against the SPEC-01 registered key, so the manifest gate owns the
 * privacy decision (class `ui_preference`, sync never, plaintext allowed).
 */
export const LAYOUT_STORAGE_KEY = "open3dcalc_layout_v1";

export type LayoutMode = "classic" | "guided" | "bento";

const DEFAULT_LAYOUT_MODE: LayoutMode = "classic";
const VALID_LAYOUT_MODES: readonly LayoutMode[] = [
  "classic",
  "guided",
  "bento",
];

function isLayoutMode(value: unknown): value is LayoutMode {
  return (VALID_LAYOUT_MODES as readonly string[]).includes(value as string);
}

/** Read the persisted mode; any unknown/corrupt payload resolves to classic. */
function loadLayoutMode(): LayoutMode {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_MODE;
  try {
    const saved = guardedStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return DEFAULT_LAYOUT_MODE;
    const parsed: unknown = JSON.parse(saved);
    return isLayoutMode(parsed) ? parsed : DEFAULT_LAYOUT_MODE;
  } catch {
    return DEFAULT_LAYOUT_MODE;
  }
}

interface LayoutState {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  layoutMode: loadLayoutMode(),

  setLayoutMode: (mode) => {
    guardedStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(mode));
    set({ layoutMode: mode });
  },
}));
