import { useCallback, useMemo, type ReactNode } from "react";

import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { ActiveTabContext, NavigateToTabContext } from "./NavigationContext";
import { NavigationVisibilityContext } from "./NavigationContext";
import type { NavigationVisibility } from "./NavigationContext";
import type { Tab } from "./tabs";

interface NavigationProviderProps {
  children: ReactNode;
}

/**
 * Navigation chrome façade over the persisted preference store (Phase 7o s3).
 *
 * The provider no longer owns transient state: `navigationPrefsStore` is the
 * single source of truth, so the active destination survives a reload and the
 * visibility list the nav renders always matches the one the settings dialog
 * writes. Split contexts are kept (value + actions) so action-only consumers
 * — the `onTabChange` passed into `useAppInit` — do not rerender on every
 * destination change.
 *
 * `navigateToTab` deliberately accepts ANY destination, including a hidden one:
 * visibility governs the navigation bar, not reachability, so internal flows
 * (History → Calculator, the go-products event, tutorial cross-tab hops) keep
 * working whatever the user hid.
 */
export function NavigationProvider({
  children,
}: NavigationProviderProps): React.ReactElement {
  const activeTab = useNavigationPrefsStore((state) => state.activeTab);
  const hiddenTabs = useNavigationPrefsStore((state) => state.hiddenTabs);
  const setActiveTab = useNavigationPrefsStore((state) => state.setActiveTab);
  const setTabVisibility = useNavigationPrefsStore(
    (state) => state.setTabVisibility,
  );
  const resetVisibility = useNavigationPrefsStore(
    (state) => state.resetVisibility,
  );

  const navigateToTab = useCallback(
    (tab: Tab): void => {
      setActiveTab(tab);
    },
    [setActiveTab],
  );

  const visibility = useMemo<NavigationVisibility>(
    () => ({ hiddenTabs, setTabVisibility, resetVisibility }),
    [hiddenTabs, setTabVisibility, resetVisibility],
  );

  return (
    <NavigateToTabContext.Provider value={navigateToTab}>
      <ActiveTabContext.Provider value={activeTab}>
        <NavigationVisibilityContext.Provider value={visibility}>
          {children}
        </NavigationVisibilityContext.Provider>
      </ActiveTabContext.Provider>
    </NavigateToTabContext.Provider>
  );
}
