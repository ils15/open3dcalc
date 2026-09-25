import { useCallback, useState, type ReactNode } from "react";

import { ActiveTabContext, NavigateToTabContext } from "./NavigationContext";
import type { Tab } from "./tabs";

const INITIAL_TAB: Tab = "calculator";

interface NavigationProviderProps {
  children: ReactNode;
}

/** Owns transient tab navigation state without persisting it. */
export function NavigationProvider({
  children,
}: NavigationProviderProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>(INITIAL_TAB);
  const navigateToTab = useCallback((tab: Tab): void => {
    setActiveTab(tab);
  }, []);

  return (
    <NavigateToTabContext.Provider value={navigateToTab}>
      <ActiveTabContext.Provider value={activeTab}>
        {children}
      </ActiveTabContext.Provider>
    </NavigateToTabContext.Provider>
  );
}
