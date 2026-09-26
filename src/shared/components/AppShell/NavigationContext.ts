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
