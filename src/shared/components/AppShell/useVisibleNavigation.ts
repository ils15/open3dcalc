import { useMemo } from "react";

import { visibleTabsFrom } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { MORE_TABS, PRIMARY_TABS, type Tab } from "./tabs";

/**
 * The visible slice of each nav group (Phase 7o s3).
 *
 * Reads the persisted hidden list from the store and filters it against the
 * tab contract. Used by all four nav surfaces so a destination the user hid
 * disappears everywhere at once, while the surfaces behind it stay mounted and
 * reachable — visibility is a navigation concern, never a data one.
 */
export function useVisiblePrimaryTabs(): Tab[] {
  const hiddenTabs = useNavigationPrefsStore((state) => state.hiddenTabs);
  return useMemo(
    () =>
      visibleTabsFrom(
        PRIMARY_TABS.map((tab) => tab.id),
        { activeTab: "calculator", hiddenTabs },
      ),
    [hiddenTabs],
  );
}

export function useVisibleMoreTabs(): Tab[] {
  const hiddenTabs = useNavigationPrefsStore((state) => state.hiddenTabs);
  return useMemo(
    () =>
      visibleTabsFrom(
        MORE_TABS.map((tab) => tab.id),
        { activeTab: "calculator", hiddenTabs },
      ),
    [hiddenTabs],
  );
}
