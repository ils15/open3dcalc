import { create } from "zustand";

import {
  canHideTab,
  isTabHidden,
  loadNavigationPrefs,
  saveNavigationPrefs,
  setTabHidden,
  type NavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import { resolveFocusModeExit } from "@/shared/lib/focusMode";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * Navigation preferences store — Phase 7o stage 3, extended by stage 4.
 *
 * Two PERSISTED pieces of state, both ergonomic UI preferences:
 * - `activeTab` — persisted so the user returns where they left off.
 * - `hiddenTabs` — destinations the user removed from navigation.
 *
 * And, since stage 4, two TRANSIENT ones:
 * - `focusMode` — the temporary distraction-free state.
 * - `focusModeReturnTab` — the screen to come back to when it ends.
 *
 * Why its own store, like layoutStore: `activeTab` here is the *navigation*
 * destination, not calculatorStore's fdm/resin `activeTab`, and neither
 * belongs in the calculator undo snapshot. Undoing a cost edit must not revert
 * the tab the user chose, and navigation state must not grow the calculator
 * snapshot as side effects. Keeping them separate makes that structural.
 *
 * Hiding is NAVIGATION-ONLY by construction: nothing in this store touches a
 * user-data store, and `setActiveTab` accepts ANY destination including a
 * hidden one, so internal flows (History → Calculator, the go-products event,
 * tutorial cross-tab hops) keep working regardless of visibility.
 *
 * Focus Mode rides along here rather than in a store of its own for the same
 * reason: it is navigation state, it is owned by the same questions, and a
 * second store would mean a second place to get the "where do we go back to"
 * answer wrong. What makes it TRANSIENT is that the serializer is untouched —
 * `saveNavigationPrefs` still writes exactly `activeTab` and `hiddenTabs`, so
 * there is no key to register in SPEC-01, no second persistence path, and no
 * payload that could resurrect the mode on reload. The two transient fields
 * are also deliberately NOT part of `NavigationPrefs`: that type IS the
 * persisted shape.
 *
 * Persistence follows the layoutStore pattern: manual guardedStorage calls
 * against the SPEC-01 registered key, so the manifest gate owns the privacy
 * decision (class `ui_preference`, sync never, export never).
 */
export interface NavigationPrefsState extends NavigationPrefs {
  /** Navigate to a destination. Accepts hidden destinations on purpose. */
  setActiveTab: (tab: Tab) => void;
  setTabVisibility: (tab: Tab, visible: boolean) => void;
  toggleTabVisibility: (tab: Tab) => void;
  isTabVisible: (tab: Tab) => boolean;
  canHide: (tab: Tab) => boolean;
  /** Show every destination again (Calculator is never hidden to begin with). */
  resetVisibility: () => void;
  /** Temporary distraction-free state. Never persisted — a reload ends it. */
  focusMode: boolean;
  /** Screen to return to on exit, or null when there is nothing to go back to. */
  focusModeReturnTab: Tab | null;
  /** Enter Focus Mode: remember the current screen and show the calculator. */
  enterFocusMode: () => void;
  /** Leave Focus Mode: back to the remembered screen, or to the calculator. */
  exitFocusMode: () => void;
}

const initial = loadNavigationPrefs();

export const useNavigationPrefsStore = create<NavigationPrefsState>(
  (set, get) => ({
    activeTab: initial.activeTab,
    hiddenTabs: initial.hiddenTabs,
    focusMode: false,
    focusModeReturnTab: null,

    setActiveTab: (tab) => {
      set({ activeTab: tab });
      saveNavigationPrefs(get());
    },

    setTabVisibility: (tab, visible) => {
      if (!canHideTab(tab)) return;
      const next = setTabHidden(get(), tab, !visible);
      if (next.hiddenTabs.length === get().hiddenTabs.length) return;
      set({ hiddenTabs: next.hiddenTabs });
      saveNavigationPrefs(get());
    },

    toggleTabVisibility: (tab) => {
      get().setTabVisibility(tab, isTabHidden(get(), tab));
    },

    isTabVisible: (tab) => !isTabHidden(get(), tab),

    canHide: canHideTab,

    resetVisibility: () => {
      set({ hiddenTabs: [] });
      saveNavigationPrefs(get());
    },

    // Entering is a no-op when the mode is already on. Without that guard a
    // second call would capture the calculator as the "previous" screen and
    // throw away the real context the user would want back.
    enterFocusMode: () => {
      if (get().focusMode) return;
      const returnTab = get().activeTab;
      set({
        focusMode: true,
        focusModeReturnTab: returnTab,
        activeTab: "calculator",
      });
      // The destination switch is an ordinary navigation, so it goes through
      // the same single persistence path as every other one. What stays
      // unpersisted is the MODE, which is the point of the stage.
      saveNavigationPrefs(get());
    },

    exitFocusMode: () => {
      if (!get().focusMode) return;
      const target = resolveFocusModeExit(get(), get().focusModeReturnTab);
      set({ focusMode: false, focusModeReturnTab: null, activeTab: target });
      saveNavigationPrefs(get());
    },
  }),
);
