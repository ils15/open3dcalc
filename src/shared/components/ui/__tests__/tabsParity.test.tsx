import { describe, it, expect } from "vitest";
import type { ReactNode, ReactElement } from "react";

import { TABS as WEB_TABS } from "@/platform/web/App";
import { MORE_TABS, MOBILE_VISIBLE_TABS } from "@/platform/web/App";
import { TABS as DESKTOP_TABS } from "@/platform/desktop/App";
import { TUTORIAL_TABS } from "@/shared/components/ui/tutorialTours";

type TabEntry = {
  id: string;
  icon: ReactNode;
  labelKey: string;
  label: string;
};

/**
 * Structural shape of a tab entry: id, i18n key, pt-BR fallback label and the
 * icon identity (lucide component reference + size class). Two TABS arrays that
 * agree on this shape render an identical navigation surface on both platforms.
 */
function tabShape(tab: TabEntry) {
  const icon = tab.icon as ReactElement<{ className?: string }>;
  return {
    id: tab.id,
    labelKey: tab.labelKey,
    label: tab.label,
    iconType: icon.type,
    iconClassName: icon.props.className,
  };
}

describe("tabs parity", () => {
  it("web TABS deep-equals desktop TABS (by id)", () => {
    expect(WEB_TABS.map(tabShape)).toEqual(DESKTOP_TABS.map(tabShape));
  });

  it("TABS deep-equals TUTORIAL_TABS", () => {
    const tutorialIds = [...TUTORIAL_TABS];

    expect(WEB_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
    expect(DESKTOP_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
  });

  it("MORE_TABS has no overlap with visible TABS", () => {
    const visible = new Set<string>(MOBILE_VISIBLE_TABS);

    for (const tabId of MORE_TABS) {
      expect(visible.has(tabId)).toBe(false);
    }
  });

  it("every MORE_TABS id resolves in TABS (bottom sheet finds its tab)", () => {
    // The mobile bottom sheet looks each id up with TABS.find(...)! — an id that
    // is missing from TABS would crash instead of degrading to a hidden entry.
    const tabIds = new Set<string>(WEB_TABS.map((tab) => tab.id));

    for (const tabId of MORE_TABS) {
      expect(tabIds.has(tabId)).toBe(true);
    }
  });
});
