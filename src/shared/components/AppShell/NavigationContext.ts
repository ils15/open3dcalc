import { createContext, useContext } from "react";

import type { Tab } from "./tabs";

export const ActiveTabContext = createContext<Tab | null>(null);
export const NavigateToTabContext = createContext<((tab: Tab) => void) | null>(
  null,
);

/**
 * Nav-only visibility (Phase 7o s3). Split from the active-tab context so the
 * settings dialog and the nav surfaces can subscribe to the hidden list without
 * re-rendering on every destination change.
 */
export interface NavigationVisibility {
  hiddenTabs: Tab[];
  setTabVisibility: (tab: Tab, visible: boolean) => void;
  resetVisibility: () => void;
}

export const NavigationVisibilityContext =
  createContext<NavigationVisibility | null>(null);

/**
 * Focus Mode (Phase 7o s4) — the temporary distraction-free state.
 *
 * Unlike the two contexts above this one is NOT split into value + actions,
 * because the reason for splitting there does not apply: the active destination
 * changes constantly (every nav click) and subscribers that only need to fire
 * an event should not ride along, whereas `active` here flips at most twice per
 * session. One context therefore costs one subscription and re-renders only the
 * chrome that actually depends on the mode.
 *
 * The state itself lives in the navigation preference store — the same store
 * the active destination and the hidden list live in — so there is no second
 * source of truth to disagree about where the user is.
 */
export interface FocusMode {
  /** True while the distraction-free state is on. */
  active: boolean;
  /** Remember the current screen and show the calculator. */
  enter: () => void;
  /** Leave, restoring the remembered screen when it is still visible. */
  exit: () => void;
}

export const FocusModeContext = createContext<FocusMode | null>(null);

export function useActiveTab(): Tab {
  const activeTab = useContext(ActiveTabContext);
  if (activeTab === null) {
    throw new Error("useActiveTab must be used within NavigationProvider");
  }
  return activeTab;
}

export function useNavigateToTab(): (tab: Tab) => void {
  const navigateToTab = useContext(NavigateToTabContext);
  if (navigateToTab === null) {
    throw new Error("useNavigateToTab must be used within NavigationProvider");
  }
  return navigateToTab;
}

export function useNavigationVisibility(): NavigationVisibility {
  const visibility = useContext(NavigationVisibilityContext);
  if (visibility === null) {
    throw new Error(
      "useNavigationVisibility must be used within NavigationProvider",
    );
  }
  return visibility;
}

export function useFocusMode(): FocusMode {
  const focusMode = useContext(FocusModeContext);
  if (focusMode === null) {
    throw new Error("useFocusMode must be used within NavigationProvider");
  }
  return focusMode;
}
