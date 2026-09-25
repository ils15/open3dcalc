import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

import {
  MORE_TAB_IDS,
  PRIMARY_TAB_IDS,
  defaultNavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import manifestFixture from "../../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import type { Tab } from "@/shared/components/AppShell/tabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

// ─── Mock the tab → surface switch; this suite is about the NAV, not the screens
vi.mock("@/shared/components/Calculator/surfaces/CalculatorSurface", () => ({
  CalculatorSurface: () => <div data-testid="surface-calculator" />,
}));
vi.mock("@/shared/components/Dashboard/Dashboard", () => ({
  Dashboard: () => <div data-testid="surface-dashboard" />,
}));
vi.mock("@/shared/components/Calculator/HistoryTab/HistoryTab", () => ({
  HistoryTab: () => <div data-testid="surface-history" />,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => <div data-testid="surface-catalog" />,
}));
vi.mock("@/shared/components/SpoolShelf/SpoolShelf", () => ({
  SpoolShelf: () => <div data-testid="surface-inventory" />,
}));
vi.mock("@/shared/components/Calculator/InfillCalculator", () => ({
  InfillCalculator: () => <div data-testid="surface-infill" />,
}));
vi.mock("@/shared/components/Calculator/QuoteSection", () => ({
  QuoteSection: () => <div data-testid="surface-quotes" />,
}));
vi.mock("@/shared/components/Catalog/CustomerTab", () => ({
  CustomerTab: () => <div data-testid="surface-customers" />,
}));
vi.mock("@/shared/components/Catalog/ProductInventory", () => ({
  ProductInventory: () => <div data-testid="surface-products" />,
}));
vi.mock("@/shared/components/Privacy/PrivacyScreen", () => ({
  PrivacyScreen: () => <div data-testid="surface-privacy" />,
}));
vi.mock("@/shared/components/Changelog/ChangelogPage", () => ({
  ChangelogPage: () => <div data-testid="surface-changelog" />,
}));
vi.mock("@/shared/components/Wiki/WikiPage", () => ({
  WikiPage: () => <div data-testid="surface-wiki" />,
}));

import { AppShell } from "@/shared/components/AppShell/AppShell";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import { useNavigateToTab } from "@/shared/components/AppShell/NavigationContext";
import { MobileNav as WebMobileNav } from "@/platform/web/components/MobileNav";
import { MobileNav as DesktopMobileNav } from "@/platform/desktop/components/MobileNav";
import { MORE_TABS, PRIMARY_TABS } from "@/shared/components/AppShell/tabs";

/**
 * Phase 7o s3 — the visible primary navigation.
 *
 * The five always-available destinations must be reachable in BOTH shells at
 * EVERY width: the desktop sidebar (lg+), the tablet strip (md) and the two
 * mobile bottom bars. Demoted destinations (Infill first) must still be
 * reachable through "More", and hiding a destination must affect navigation
 * only.
 */

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
  useNavigationPrefsStore.setState(defaultNavigationPrefs());
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const PRIMARY_LABEL_KEYS = PRIMARY_TABS.map((tab) => tab.labelKey);

function renderShell(): {
  desktopSidebar: HTMLElement;
  tabletSidebar: HTMLElement;
} {
  const { container } = render(
    <NavigationProvider>
      <AppShell activeTab="calculator" onTabChange={vi.fn()} mainClassName="" />
    </NavigationProvider>,
  );
  const asides = Array.from(container.querySelectorAll("aside"));
  return {
    tabletSidebar: asides.find((a) => a.className.includes("md:flex"))!,
    desktopSidebar: asides.find((a) => a.className.includes("hidden lg:flex"))!,
  };
}

function renderMobileNav(platform: "web" | "desktop"): HTMLElement {
  const Nav = platform === "web" ? WebMobileNav : DesktopMobileNav;
  const { container } = render(
    <NavigationProvider>
      <Nav activeTab="calculator" onTabChange={vi.fn()} />
    </NavigationProvider>,
  );
  return container.querySelector("nav")!;
}

describe("primary navigation — the five always-available destinations", () => {
  it("exposes exactly five primary entries and five demoted entries", () => {
    expect(PRIMARY_TABS.map((tab) => tab.id)).toEqual([...PRIMARY_TAB_IDS]);
    expect(MORE_TABS.map((tab) => tab.id)).toEqual([...MORE_TAB_IDS]);
  });

  it("labels the destinations Pricing, Dashboard, History, Printers, Spools", () => {
    expect(PRIMARY_LABEL_KEYS).toEqual([
      "nav.pricing",
      "nav.dashboard",
      "nav.history",
      "nav.printers",
      "nav.spools",
    ]);
  });

  it("renders the five destinations in the desktop sidebar", () => {
    const { desktopSidebar } = renderShell();
    const buttons = desktopSidebar.querySelectorAll("button");

    expect(buttons).toHaveLength(PRIMARY_TABS.length + 1); // + the More trigger
    for (const labelKey of PRIMARY_LABEL_KEYS) {
      expect(
        within(desktopSidebar).getByRole("button", { name: labelKey }),
        labelKey,
      ).toBeInTheDocument();
    }
  });

  it("renders the five destinations in the tablet strip", () => {
    const { tabletSidebar } = renderShell();

    for (const labelKey of PRIMARY_LABEL_KEYS) {
      expect(
        within(tabletSidebar).getByRole("button", { name: labelKey }),
        labelKey,
      ).toBeInTheDocument();
    }
  });

  it.each(["web", "desktop"] as const)(
    "renders the five destinations in the %s mobile bottom bar",
    (platform) => {
      const nav = renderMobileNav(platform);

      for (const labelKey of PRIMARY_LABEL_KEYS) {
        expect(
          within(nav).getByRole("button", { name: labelKey }),
          labelKey,
        ).toBeInTheDocument();
      }
    },
  );

  it("marks the active destination with aria-current", () => {
    const { container } = render(
      <NavigationProvider>
        <AppShell activeTab="history" onTabChange={vi.fn()} mainClassName="" />
      </NavigationProvider>,
    );
    const desktopSidebar = container.querySelector(
      '[class*="hidden lg:flex"]',
    ) as HTMLElement;

    const active = within(desktopSidebar).getByRole("button", {
      name: "nav.history",
    });
    const others = within(desktopSidebar).getByRole("button", {
      name: "nav.pricing",
    });

    expect(active).toHaveAttribute("aria-current", "page");
    expect(others).not.toHaveAttribute("aria-current");
  });

  it("uses real buttons with an accessible name and a focus ring", () => {
    const { desktopSidebar } = renderShell();

    for (const labelKey of PRIMARY_LABEL_KEYS) {
      const button = within(desktopSidebar).getByRole("button", {
        name: labelKey,
      });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button.className).toContain("focus-visible:ring-2");
    }
  });

  it("exposes navigation semantics, not a broken tab pattern", () => {
    // The base markup put role="tab" on these buttons with NO tablist ancestor
    // and NO tabpanel siblings (MainContent renders a single main region), so
    // assistive tech was told "tab" with nothing to anchor it to. These are
    // navigation items, so aria-current is the correct marker. Pinned here so
    // the broken pattern cannot creep back.
    const { desktopSidebar, tabletSidebar } = renderShell();

    for (const aside of [desktopSidebar, tabletSidebar]) {
      expect(aside.querySelectorAll('[role="tab"]')).toHaveLength(0);
      expect(aside.getAttribute("role")).not.toBe("tablist");
    }
    expect(
      desktopSidebar.querySelectorAll("button[aria-current='page']"),
    ).toHaveLength(1);
  });
});

describe("primary navigation — Infill is demoted to More, still working", () => {
  it("keeps Infill out of the primary set", () => {
    const { desktopSidebar } = renderShell();

    expect(
      within(desktopSidebar).queryByRole("button", { name: "nav.infill" }),
    ).toBeNull();
  });

  it("reveals Infill through the More disclosure", () => {
    const { desktopSidebar } = renderShell();

    const more = within(desktopSidebar).getByRole("button", {
      name: "nav.more",
    });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(
      within(desktopSidebar).queryByRole("button", { name: "nav.infill" }),
    ).toBeNull();

    fireEvent.click(more);

    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(
      within(desktopSidebar).getByRole("button", { name: "nav.infill" }),
    ).toBeInTheDocument();
  });

  it("navigates to the standalone Infill screen from More", () => {
    const Harness = (): React.ReactElement => {
      const activeTab = useNavigationPrefsStore((s) => s.activeTab);
      const navigateToTab = useNavigateToTab();
      return (
        <>
          <button type="button" onClick={() => navigateToTab("infill")}>
            go infill
          </button>
          <output aria-label="active">{activeTab}</output>
        </>
      );
    };
    render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "go infill" }));

    expect(screen.getByLabelText("active")).toHaveTextContent("infill");
  });

  it("still renders the Infill surface when it is the active destination", () => {
    render(
      <NavigationProvider>
        <AppShell activeTab="infill" onTabChange={vi.fn()} mainClassName="" />
      </NavigationProvider>,
    );

    expect(screen.getByTestId("surface-infill")).toBeInTheDocument();
  });

  it("gives every mounted More instance a unique panel id", () => {
    // The tablet strip and the desktop sidebar are both in the DOM at once
    // (separated only by display:none), and so are both mobile bars' siblings.
    // A shared hardcoded id would be invalid HTML and aria-controls would
    // resolve to the wrong panel.
    const { desktopSidebar, tabletSidebar } = renderShell();
    const navs = [tabletSidebar, desktopSidebar].filter((el) =>
      el.querySelector("button[aria-controls]"),
    );
    expect(navs).toHaveLength(2);

    for (const nav of navs) {
      const trigger = nav.querySelector<HTMLButtonElement>(
        "button[aria-controls]",
      )!;
      const panelId = trigger.getAttribute("aria-controls")!;
      expect(panelId).toBeTruthy();

      fireEvent.click(trigger);
      const panel = document.getElementById(panelId);
      expect(panel, `panel for ${panelId}`).toBeInTheDocument();
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(trigger);
    }

    const panelIds = [tabletSidebar, desktopSidebar].map((el) =>
      el.querySelector("button[aria-controls]")!.getAttribute("aria-controls"),
    );
    expect(new Set(panelIds).size).toBe(panelIds.length);
  });

  it("offers every demoted destination under More", () => {
    const { desktopSidebar } = renderShell();
    fireEvent.click(
      within(desktopSidebar).getByRole("button", { name: "nav.more" }),
    );

    for (const tab of MORE_TABS) {
      expect(
        within(desktopSidebar).getByRole("button", { name: tab.labelKey }),
        tab.id,
      ).toBeInTheDocument();
    }
  });
});

describe("primary navigation — hiding affects navigation only", () => {
  it("removes a hidden destination from the primary set", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    const { desktopSidebar } = renderShell();

    expect(
      within(desktopSidebar).queryByRole("button", { name: "nav.history" }),
    ).toBeNull();
    expect(
      within(desktopSidebar).getByRole("button", { name: "nav.pricing" }),
    ).toBeInTheDocument();
  });

  it("removes a hidden destination from More", () => {
    useNavigationPrefsStore.getState().setTabVisibility("infill", false);
    const { desktopSidebar } = renderShell();
    fireEvent.click(
      within(desktopSidebar).getByRole("button", { name: "nav.more" }),
    );

    expect(
      within(desktopSidebar).queryByRole("button", { name: "nav.infill" }),
    ).toBeNull();
  });

  it("keeps the hidden destination's screen reachable and rendered", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    render(
      <NavigationProvider>
        <AppShell activeTab="history" onTabChange={vi.fn()} mainClassName="" />
      </NavigationProvider>,
    );

    expect(screen.getByTestId("surface-history")).toBeInTheDocument();
  });

  it("still marks a hidden-but-active demoted destination as current", () => {
    // Infill is demoted AND hidden: it is filtered out of the panel, but More
    // still owns it, so the nav must not show the active destination as
    // unselected.
    useNavigationPrefsStore.getState().setTabVisibility("infill", false);
    const { container } = render(
      <NavigationProvider>
        <AppShell activeTab="infill" onTabChange={vi.fn()} mainClassName="" />
      </NavigationProvider>,
    );
    const more = within(
      container.querySelector('[class*="hidden lg:flex"]') as HTMLElement,
    ).getByRole("button", { name: "nav.more" });

    expect(more).toHaveAttribute("aria-current", "page");
  });

  it("marks More current for a visible demoted destination too", () => {
    const { container } = render(
      <NavigationProvider>
        <AppShell activeTab="quotes" onTabChange={vi.fn()} mainClassName="" />
      </NavigationProvider>,
    );
    const more = within(
      container.querySelector('[class*="hidden lg:flex"]') as HTMLElement,
    ).getByRole("button", { name: "nav.more" });

    expect(more).toHaveAttribute("aria-current", "page");
  });

  it("leaves More unselected when the active destination is in the bar", () => {
    const { container } = render(
      <NavigationProvider>
        <AppShell
          activeTab="dashboard"
          onTabChange={vi.fn()}
          mainClassName=""
        />
      </NavigationProvider>,
    );
    const more = within(
      container.querySelector('[class*="hidden lg:flex"]') as HTMLElement,
    ).getByRole("button", { name: "nav.more" });

    expect(more).not.toHaveAttribute("aria-current");
  });

  it("does not mark More current for a hidden PRIMARY destination", () => {
    // History is a primary destination the user hid: it belongs to neither the
    // bar nor More, so More must not claim it.
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    const { container } = render(
      <NavigationProvider>
        <AppShell activeTab="history" onTabChange={vi.fn()} mainClassName="" />
      </NavigationProvider>,
    );
    const more = within(
      container.querySelector('[class*="hidden lg:flex"]') as HTMLElement,
    ).getByRole("button", { name: "nav.more" });

    expect(more).not.toHaveAttribute("aria-current");
  });

  it("never removes Pricing/Calculator, even alone", () => {
    for (const tab of [
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
    ] as const) {
      useNavigationPrefsStore.getState().setTabVisibility(tab, false);
    }
    const { desktopSidebar, tabletSidebar } = renderShell();

    expect(
      within(desktopSidebar).getByRole("button", { name: "nav.pricing" }),
    ).toBeInTheDocument();
    expect(
      within(tabletSidebar).getByRole("button", { name: "nav.pricing" }),
    ).toBeInTheDocument();
  });

  it("hides the More trigger when no demoted destination is left", () => {
    for (const tab of MORE_TAB_IDS) {
      useNavigationPrefsStore.getState().setTabVisibility(tab, false);
    }
    const { desktopSidebar } = renderShell();

    expect(
      within(desktopSidebar).queryByRole("button", { name: "nav.more" }),
    ).toBeNull();
    expect(desktopSidebar.querySelectorAll("button")).toHaveLength(
      PRIMARY_TABS.length,
    );
  });

  it("survives the More trigger appearing and disappearing (hook order)", () => {
    // More bails out entirely when every demoted destination is hidden, so any
    // hook declared after that bail would change hook order across renders.
    const Harness = (): React.ReactElement => {
      const activeTab = useNavigationPrefsStore((s) => s.activeTab);
      return (
        <AppShell
          activeTab={activeTab}
          onTabChange={vi.fn()}
          mainClassName=""
        />
      );
    };
    const tree = (
      <NavigationProvider>
        <Harness />
      </NavigationProvider>
    );
    const { container, rerender } = render(tree);
    const more = (): HTMLElement | null =>
      within(
        container.querySelector('[class*="hidden lg:flex"]') as HTMLElement,
      ).queryByRole("button", { name: "nav.more" });

    expect(more()).toBeInTheDocument();
    act(() => {
      for (const tab of MORE_TAB_IDS) {
        useNavigationPrefsStore.getState().setTabVisibility(tab, false);
      }
    });
    rerender(tree);
    expect(more()).toBeNull();

    act(() => {
      useNavigationPrefsStore.getState().resetVisibility();
    });
    rerender(tree);
    expect(more()).toBeInTheDocument();
  });
});

describe("primary navigation — persistence through the shared owner", () => {
  it("returns to the persisted destination on a fresh mount", () => {
    useNavigationPrefsStore.getState().setActiveTab("inventory");

    function Probe(): React.ReactElement {
      return (
        <output aria-label="active">
          {useNavigationPrefsStore.getState().activeTab}
        </output>
      );
    }
    const { unmount } = render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );
    expect(screen.getByLabelText("active")).toHaveTextContent("inventory");
    unmount();

    // A reload re-evaluates the store from the persisted preference.
    vi.resetModules();
    return import("@/shared/stores/navigationPrefsStore").then(
      ({ useNavigationPrefsStore: fresh }) => {
        render(
          <NavigationProvider>
            <output aria-label="active-reloaded">
              {fresh.getState().activeTab}
            </output>
          </NavigationProvider>,
        );
        expect(screen.getByLabelText("active-reloaded")).toHaveTextContent(
          "inventory",
        );
      },
    );
  });

  it("navigates on click and persists the new destination", () => {
    const Harness = (): React.ReactElement => {
      const activeTab = useNavigationPrefsStore((s) => s.activeTab);
      const navigateToTab = useNavigateToTab();
      return (
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName=""
        />
      );
    };
    const { container } = render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );
    const desktopSidebar = container.querySelector(
      '[class*="hidden lg:flex"]',
    ) as HTMLElement;

    fireEvent.click(
      within(desktopSidebar).getByRole("button", { name: "nav.history" }),
    );

    expect(screen.getByTestId("surface-history")).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("open3dcalc_nav_v1") ?? "{}")
        .activeTab,
    ).toBe("history");
  });
});

describe("primary navigation — the active destination list is stable", () => {
  it("keeps the same primary ids on web and desktop chrome", () => {
    const webNav = renderMobileNav("web");
    const desktopNav = renderMobileNav("desktop");

    const webLabels = Array.from(
      webNav.querySelectorAll("button[aria-selected]"),
    ).map((b) => b.textContent);
    const desktopLabels = Array.from(
      desktopNav.querySelectorAll("button[aria-selected]"),
    ).map((b) => b.textContent);

    expect(webLabels.length).toBeGreaterThan(0);
    expect(desktopLabels).toEqual(webLabels);
  });

  it("exposes the same primary ids from the shared tab contract", () => {
    const ids: Tab[] = PRIMARY_TABS.map((tab) => tab.id);
    expect(ids).toEqual([...PRIMARY_TAB_IDS]);
  });
});
