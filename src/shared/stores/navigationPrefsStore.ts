import { create } from "zustand";

import {
  canHideTab,
  isTabHidden,
  loadNavigationPrefs,
  saveNavigationPrefs,
  setTabHidden,
  type NavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * Navigation preferences store — Phase 7o stage 3.
 *
 * Two pieces of state, both ergonomic UI preferences:
 * - `activeTab` — persisted so the user returns where they left off.
 * - `hiddenTabs` — destinations the user removed from navigation.
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
}

const initial = loadNavigationPrefs();

export const useNavigationPrefsStore = create<NavigationPrefsState>(
  (set, get) => ({
    activeTab: initial.activeTab,
    hiddenTabs: initial.hiddenTabs,

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
  }),
);
