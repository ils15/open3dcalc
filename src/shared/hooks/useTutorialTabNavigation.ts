import { useEffect } from "react";

import {
  TUTORIAL_NAVIGATE_EVENT,
  TUTORIAL_TABS,
  type TutorialTab,
} from "@/shared/components/ui/tutorialTours";

/**
 * Cross-tab tutorial navigation (Fase 2).
 *
 * The tour engine calls `dispatchTutorialNavigate(tab)` before spotting an
 * anchor that lives on another surface. Both platform Apps install this hook
 * so the owning tab mounts before the spotlight resolves.
 *
 * The tab is validated against `TUTORIAL_TABS` — a payload that isn't a known
 * tab id is dropped instead of being forwarded to `setActiveTab`, so a typo in
 * the registry can never blank the UI.
 */
export function useTutorialTabNavigation(
  setActiveTab: (tab: TutorialTab) => void,
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleNavigate = (event: Event): void => {
      const tab = (event as CustomEvent<TutorialTab>).detail;
      if (typeof tab !== "string") return;
      if (!TUTORIAL_TABS.includes(tab)) return;
      setActiveTab(tab);
    };

    window.addEventListener(TUTORIAL_NAVIGATE_EVENT, handleNavigate);
    return () => {
      window.removeEventListener(TUTORIAL_NAVIGATE_EVENT, handleNavigate);
    };
  }, [setActiveTab]);
}
