import { describe, it, expect, vi } from "vitest";
import type { ReactNode, ReactElement } from "react";

// ─── Mock all heavy dependencies (same surface as TabletOptimization.test) ───
vi.mock("@/shared/components/Header/Header", () => ({
  Header: () => <header data-testid="header">Header</header>,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => <div>CatalogTab</div>,
}));
vi.mock("@/shared/components/Calculator/HistoryTab/HistoryTab", () => ({
  HistoryTab: () => <div>HistoryTab</div>,
}));
vi.mock("@/shared/components/Dashboard/Dashboard", () => ({
  Dashboard: () => <div>Dashboard</div>,
}));
vi.mock("@/shared/components/Changelog/ChangelogPage", () => ({
  ChangelogPage: () => <div>ChangelogPage</div>,
}));
vi.mock("@/shared/components/Wiki/WikiPage", () => ({
  WikiPage: () => <div>WikiPage</div>,
}));
vi.mock("@/shared/components/Calculator/InfillCalculator", () => ({
  InfillCalculator: () => <div>InfillCalculator</div>,
}));
vi.mock("@/shared/components/Catalog/FilamentInventory", () => ({
  FilamentInventory: () => <div>FilamentInventory</div>,
}));
vi.mock("@/shared/components/SpoolShelf/SpoolShelf", () => ({
  SpoolShelf: () => <div>SpoolShelf</div>,
}));
vi.mock("@/shared/components/Calculator/Calculator", () => ({
  Calculator: () => <div>Calculator</div>,
}));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));
// Applies the selector, like the calculatorStore mock below. Returning the bare
// store object made `useHistoryStore(s => s.entries)` yield the store rather than
// the array, so consumers calling `entries.reduce(...)` threw.
vi.mock("@/shared/stores/historyStore", () => {
  const state = { entries: [], addEntry: vi.fn() };
  return {
    useHistoryStore: Object.assign(
      vi.fn((selector?: (s: typeof state) => unknown) =>
        selector ? selector(state) : state,
      ),
      {
        getState: vi.fn(() => state),
        // App.tsx installs the passwordless Desktop storage at import time; the
        // installer probes `persist.setOptions`, so the mock must expose it or
        // the import would take the fail-closed skip path.
        persist: { setOptions: vi.fn() },
      },
    ),
  };
});
vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { currency: "auto" };
      return selector ? selector(state) : state;
    },
  ),
}));

// Mock i18next — keys pass through so assertions can match on labelKey strings.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

// ─── Import after mocks ───
import { TABS as WEB_TABS } from "@/platform/web/App";
import { TABS as DESKTOP_TABS } from "@/platform/desktop/App";
import { TUTORIAL_TABS } from "@/shared/components/ui/tutorialTours";
import {
  MORE_TABS,
  PRIMARY_TABS,
  holdsDemotedSurface,
} from "@/shared/components/AppShell/tabs";
import { MORE_TAB_IDS, PRIMARY_TAB_IDS } from "@/shared/lib/navigationPrefs";

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
  it("keeps all eleven navigation surfaces in the tab contract", () => {
    expect(WEB_TABS.map((tab) => tab.id)).toEqual([
      "calculator",
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
      "marketplace",
    ]);
  });

  it("web TABS deep-equals desktop TABS (by id)", () => {
    expect(WEB_TABS.map(tabShape)).toEqual(DESKTOP_TABS.map(tabShape));
  });

  it("TABS deep-equals TUTORIAL_TABS", () => {
    const tutorialIds = [...TUTORIAL_TABS];

    expect(WEB_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
    expect(DESKTOP_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
  });
});

/**
 * Phase 7o s3 — the primary/demoted split is part of the same contract, so it
 * is locked here too: both platforms must agree on WHICH surfaces are primary,
 * not merely on the full set. A drift here would give the two shells different
 * navigation bars, which is the regression the whole lock exists to prevent.
 */
describe("primary vs demoted parity", () => {
  it("splits into exactly the five primary destinations and six demoted", () => {
    expect(PRIMARY_TABS.map((tab) => tab.id)).toEqual([...PRIMARY_TAB_IDS]);
    expect(MORE_TABS.map((tab) => tab.id)).toEqual([...MORE_TAB_IDS]);
  });

  it("primary and demoted together reconstruct TABS exactly", () => {
    expect([...PRIMARY_TABS, ...MORE_TABS].map((tab) => tab.id)).toEqual(
      WEB_TABS.map((tab) => tab.id),
    );
  });

  it("agrees between web and desktop (the split is derived from shared TABS)", () => {
    const webIds = new Set(WEB_TABS.map((tab) => tab.id));
    const desktopIds = new Set(DESKTOP_TABS.map((tab) => tab.id));

    for (const id of PRIMARY_TAB_IDS) {
      expect(webIds.has(id), `primary ${id} on web`).toBe(true);
      expect(desktopIds.has(id), `primary ${id} on desktop`).toBe(true);
    }
    for (const id of MORE_TAB_IDS) {
      expect(webIds.has(id), `demoted ${id} on web`).toBe(true);
      expect(desktopIds.has(id), `demoted ${id} on desktop`).toBe(true);
    }
  });

  it("demotes Infill while keeping it in the surface set", () => {
    expect(holdsDemotedSurface("infill")).toBe(true);
    expect(MORE_TABS.some((tab) => tab.id === "infill")).toBe(true);
  });

  it("keeps every primary destination out of the demoted set", () => {
    for (const id of PRIMARY_TAB_IDS) {
      expect(holdsDemotedSurface(id), id).toBe(false);
    }
  });
});

/**
 * THE WEB MOBILE-NAVIGATION BLOCK THAT USED TO LIVE HERE WAS REMOVED
 * ------------------------------------------------------------------
 * It rendered the WEB `App` and asserted on the surface that App put on screen:
 * a bottom bar carrying the five primary destinations plus a More disclosure,
 * a footer hub holding Wiki/Novidades, and a settings gear opening a settings
 * sheet. The Studio rewrite (#260) replaced the web `App` body with
 * `StudioLayout`, and that tree contains none of the three: no bottom bar, no
 * `footer.navigation` hub, no settings gear.
 *
 * The components those tests drove are still on disk but are no longer mounted
 * by any production module -- `platform/web/components/MobileNav.tsx` and
 * `platform/web/components/MobileSettingsSheet.tsx` are referenced only from
 * test files. Asserting through the App could therefore only ever have measured
 * dead code.
 *
 * Nothing was lost with the block. Each behaviour it covered is asserted against
 * the component that actually renders it:
 *
 *   - the five primary destinations and the More disclosure, on BOTH platforms'
 *     `MobileNav` -> AppShell/__tests__/primaryNavigation.test.tsx
 *     ("exposes exactly five primary entries and five demoted entries",
 *      "renders the five destinations in the tablet strip",
 *      "offers every demoted destination under More",
 *      "reveals Infill through the More disclosure").
 *   - Wiki / Novidades / GitHub / Telegram reachable by name in the resource
 *     hub, on both variants -> AppShell/__tests__/sidebarLandmarks.test.tsx
 *     ("keeps the resource items reachable by their own names").
 *   - the settings sheet starting the tutorial ->
 *     shared/components/ui/__tests__/TutorialLauncher.test.tsx
 *     ("starts the tutorial from mobile settings in Classic").
 *
 * The contract this file DOES still own -- that web and desktop derive the same
 * ten surfaces and the same five/five primary/demoted split from one shared
 * `TABS` -- is untouched above, and `AppShell/__tests__/focusModeLayering.test.tsx`
 * notes the same divergence.
 */
