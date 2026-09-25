import { createContext, useContext } from "react";

import type { Tab } from "./tabs";

export const ActiveTabContext = createContext<Tab | null>(null);
export const NavigateToTabContext = createContext<((tab: Tab) => void) | null>(
  null,
);

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
