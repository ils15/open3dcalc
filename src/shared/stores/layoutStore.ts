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
 * The sidebar presentation is an independent preference in this same store.
 * The original payload was a layout-mode string, so that format remains valid;
 * once a sidebar mode is selected, the registered key stores a small composite
 * preference object. No second storage key or persistence system is created.
 *
 * Persistence follows the colorPalette pattern: manual guardedStorage calls
 * against the SPEC-01 registered key, so the manifest gate owns the privacy
 * decision (class `ui_preference`, sync never, plaintext allowed).
 */
export const LAYOUT_STORAGE_KEY = "open3dcalc_layout_v1";

export type LayoutMode = "classic" | "guided" | "bento";
export type SidebarMode = "compact" | "tabs" | "dock" | "expanded";

const DEFAULT_LAYOUT_MODE: LayoutMode = "classic";
export const DEFAULT_SIDEBAR_MODE: SidebarMode = "compact";
const VALID_LAYOUT_MODES: readonly LayoutMode[] = [
  "classic",
  "guided",
  "bento",
];
const VALID_SIDEBAR_MODES: readonly SidebarMode[] = [
  "compact",
  "tabs",
  "dock",
  "expanded",
];

interface LayoutPreferences {
  layoutMode: LayoutMode;
  sidebarMode: SidebarMode;
}

function isLayoutMode(value: unknown): value is LayoutMode {
  return (VALID_LAYOUT_MODES as readonly string[]).includes(value as string);
}

function isSidebarMode(value: unknown): value is SidebarMode {
  return (VALID_SIDEBAR_MODES as readonly string[]).includes(value as string);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultPreferences(): LayoutPreferences {
  return {
    layoutMode: DEFAULT_LAYOUT_MODE,
    sidebarMode: DEFAULT_SIDEBAR_MODE,
  };
}

/** Read either the legacy layout-only string or the composite preference. */
function loadLayoutPreferences(): LayoutPreferences {
  if (typeof window === "undefined") return defaultPreferences();
  try {
    const saved = guardedStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return defaultPreferences();
    const parsed: unknown = JSON.parse(saved);
    if (isLayoutMode(parsed)) {
      return { layoutMode: parsed, sidebarMode: DEFAULT_SIDEBAR_MODE };
    }
    if (
      isRecord(parsed) &&
      isLayoutMode(parsed.layoutMode) &&
      isSidebarMode(parsed.sidebarMode)
    ) {
      return { layoutMode: parsed.layoutMode, sidebarMode: parsed.sidebarMode };
    }
  } catch {
    return defaultPreferences();
  }
  return defaultPreferences();
}

function hasCompositePayload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = guardedStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return false;
    const parsed: unknown = JSON.parse(saved);
    return (
      isRecord(parsed) &&
      isLayoutMode(parsed.layoutMode) &&
      isSidebarMode(parsed.sidebarMode)
    );
  } catch {
    return false;
  }
}

function persistPreferences(
  preferences: LayoutPreferences,
  forceComposite: boolean,
): void {
  if (forceComposite || hasCompositePayload()) {
    guardedStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(preferences));
    return;
  }
  // Preserve the original wire format until the user chooses a sidebar mode.
  guardedStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(preferences.layoutMode));
}

interface LayoutState extends LayoutPreferences {
  setLayoutMode: (mode: LayoutMode) => void;
  setSidebarMode: (mode: SidebarMode) => void;
}

const initialPreferences = loadLayoutPreferences();

export const useLayoutStore = create<LayoutState>((set) => ({
  ...initialPreferences,

  setLayoutMode: (mode) => {
    set((state) => {
      const preferences = {
        layoutMode: mode,
        sidebarMode: state.sidebarMode,
      };
      persistPreferences(preferences, false);
      return preferences;
    });
  },

  setSidebarMode: (mode) => {
    set((state) => {
      const preferences = {
        layoutMode: state.layoutMode,
        sidebarMode: mode,
      };
      // Selecting any sidebar mode opts into the composite format, including
      // compact, so the independent choice survives a reload.
      persistPreferences(preferences, true);
      return preferences;
    });
  },
}));
