import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import { TABS, type Tab } from "@/shared/components/AppShell/tabs";
import { TAB_SURFACE_INFO } from "@/shared/components/AppShell/tabSurfaceInfo";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import { Header as WebHeader } from "../Header";
import { Header as DesktopHeader } from "@/platform/desktop/components/Header/Header";

/**
 * The contextual breadcrumb lives in the chrome, so it is locked from both
 * sides: the component contract (what it renders, and the accessible name it
 * claims) and the copy contract (that every key it can ask for actually
 * resolves in BOTH locales).
 *
 * The i18n mock below is a real resolver, not the `t: (k) => k` passthrough the
 * other chrome suites use. That is deliberate: the repository only locks
 * `tutorial.launcher` for pt/en parity (`layoutShell.test.ts:24-34`), so a
 * key that exists in pt-BR and is missing from en-US renders as the raw key in
 * English without failing anything. A passthrough mock would hide that; a real
 * resolver makes every assertion below assert on real copy, so a typo or an
 * untranslated key shows up as `breadcrumb.whatever` in the DOM and fails.
 */
function translate(key: string, locale: Record<string, unknown>): string {
  let node: unknown = locale;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

let locale: Record<string, unknown> = ptBR;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translate(key, locale),
    i18n: {
      language: "pt-BR",
      resolvedLanguage: "pt-BR",
      changeLanguage: vi.fn(),
    },
  }),
}));

// ── Leaf chrome stubbed so these tests observe the breadcrumb, not the tools
// around it. LayoutSwitcher is reached by two different specifiers ("./…" from
// the web Header, "@/shared/…" from the desktop one) and resolves to one
// module, so one mock covers both shells.
vi.mock("@/shared/components/Header/LayoutSwitcher", () => ({
  LayoutSwitcher: () => <div data-testid="layout-switcher" />,
}));
vi.mock("@/shared/components/Header/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@/shared/components/ui/TutorialLauncher", () => ({
  TutorialLauncher: () => <div data-testid="tutorial-launcher" />,
}));
vi.mock("@/shared/components/ui/DataSyncButton", () => ({
  DataSyncButton: () => <div data-testid="data-sync" />,
}));
vi.mock("@/shared/components/GuideDrawer/GuideDrawer", () => ({
  GuideDrawer: () => <div data-testid="guide-drawer" />,
}));
vi.mock("@/shared/components/BetaBadge/BetaBadge", () => ({
  BetaBadge: () => <span data-testid="beta-badge" />,
}));
vi.mock("@/shared/components/DemoMode/DemoModeButton", () => ({
  DemoModeButton: () => <div data-testid="demo-mode" />,
}));
vi.mock("@/shared/components/AppShell/ManageVisibilityButton", () => ({
  ManageVisibilityButton: () => <div data-testid="manage-visibility" />,
}));
vi.mock("@/shared/components/AppShell/FocusModeButton", () => ({
  FocusModeButton: () => <div data-testid="focus-mode" />,
}));

vi.mock("@/shared/stores/tutorialStore", () => ({
  useTutorialStore: {
    getState: () => ({
      startTutorial: vi.fn(),
      startTour: vi.fn(),
      completedTours: [],
      isActive: false,
      skipTutorial: vi.fn(),
    }),
  },
}));
vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { currency: "auto", setCurrency: vi.fn() };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ currency: "auto", setCurrency: vi.fn() }) },
  ),
}));
vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { isActive: false, enter: vi.fn(), exit: vi.fn() };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ isActive: false, enter: vi.fn(), exit: vi.fn() }) },
  ),
}));
vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({ symbol: "R$", format: (v: number) => `R$ ${v}` }),
}));
vi.mock("@/shared/lib/currency", () => ({
  CURRENCIES: { BRL: { symbol: "R$", name: "Real" } },
}));
vi.mock("@/shared/contexts/CurrencyContext", () => ({
  useCurrencyPreference: () => ({ currencySetting: "auto" }),
  useSetCurrency: () => vi.fn(),
}));
vi.mock(
  "@/platform/desktop/components/UpdateNotification/UpdaterStore",
  () => ({
    useUpdaterStore: Object.assign(
      (selector?: (state: Record<string, unknown>) => unknown) => {
        const state = { status: "idle", checkForUpdates: vi.fn() };
        return selector ? selector(state) : state;
      },
      { getState: () => ({ status: "idle", checkForUpdates: vi.fn() }) },
    ),
  }),
);

const SHELLS = [
  ["web", WebHeader],
  ["desktop", DesktopHeader],
] as const;

function renderShell(Header: (typeof SHELLS)[number][1]) {
  return render(
    <NavigationProvider>
      <Header />
    </NavigationProvider>,
  );
}

describe("contextual breadcrumb", () => {
  beforeEach(() => {
    locale = ptBR;
    useNavigationPrefsStore.setState({ activeTab: "calculator" });
  });

  it.each(SHELLS)(
    "shows the active destination's own title and marks it current (%s)",
    (_name, Header) => {
      renderShell(Header);

      const nav = screen.getByRole("navigation", {
        name: translate("breadcrumb.label", ptBR),
      });
      // The final item is the current page, not a link — WCAG 2.4.8.
      const current = nav.querySelector('[aria-current="page"]');
      expect(current).not.toBeNull();
      expect(current!.textContent).toContain(translate("nav.pricing", ptBR));
      expect(nav.textContent).toContain(translate("breadcrumb.root", ptBR));
    },
  );

  it.each(SHELLS)("follows the destination (%s)", (_name, Header) => {
    useNavigationPrefsStore.setState({ activeTab: "inventory" });
    renderShell(Header);

    const nav = screen.getByRole("navigation", {
      name: translate("breadcrumb.label", ptBR),
    });
    expect(nav.textContent).toContain(translate("nav.spools", ptBR));
  });

  /**
   * WCAG 2.4.6, and the rule the repo has already written down at
   * `SecondaryNavigation.tsx:23-26`: two landmarks sharing an accessible name
   * are indistinguishable in the landmark list. The four names below are taken
   * from the real surfaces — the modules region, the resources region, the
   * footer hub and the mobile primary bar — and `tabsParity.test.tsx:189,208`
   * already resolves two of them with a GLOBAL `getByRole`, so a collision
   * would be a live ambiguity, not a theoretical one.
   */
  it.each(SHELLS)(
    "claims an accessible name no other navigation landmark already owns (%s)",
    (_name, Header) => {
      renderShell(Header);

      const taken = [
        "nav.navigation",
        "nav.resources",
        "footer.navigation",
        "nav.mainNavigation",
      ].map((key) => translate(key, ptBR));

      const ours = translate("breadcrumb.label", ptBR);
      for (const name of taken) {
        expect(ours, "collides with an existing landmark name").not.toBe(name);
      }

      // And it must be the only navigation landmark wearing it.
      const navs = screen.getAllByRole("navigation");
      expect(
        navs.filter((el) => el.getAttribute("aria-label") === ours),
      ).toHaveLength(1);
    },
  );

  it("renders the same breadcrumb on web and desktop", () => {
    const read = (Header: (typeof SHELLS)[number][1]): string => {
      const { unmount } = renderShell(Header);
      const nav = screen.getByRole("navigation", {
        name: translate("breadcrumb.label", ptBR),
      });
      const text = nav.textContent ?? "";
      unmount();
      return text;
    };

    expect(read(DesktopHeader)).toBe(read(WebHeader));
  });

  it("describes all twelve destinations, so no surface can leak a raw key", () => {
    // The ten tab-contract surfaces plus the two footer-only ones (Wiki and
    // Novidades), which are reachable destinations even though they are
    // deliberately absent from TABS.
    const ids: Tab[] = [...TABS.map((t) => t.id), "wiki", "changelog"];

    for (const id of ids) {
      const info = TAB_SURFACE_INFO[id];
      expect(info, `no breadcrumb copy for ${id}`).toBeDefined();
      for (const locale of [ptBR, enUS]) {
        for (const key of [info.titleKey, info.descKey]) {
          expect(translate(key, locale), `${id}.${key}`).not.toBe(key);
        }
      }
    }
  });

  it("keeps every breadcrumb translation in sync between pt-BR and en-US", () => {
    // The repository has no general pt/en lock — only `tutorial.launcher` is
    // pinned (`layoutShell.test.ts:24-34`) — so a key added to one locale and
    // forgotten in the other ships silently and renders as the raw key. This is
    // the lock for the block this change introduced.
    const flatten = (value: unknown, prefix = ""): string[] => {
      if (typeof value !== "object" || value === null) return [prefix];
      return Object.entries(value as Record<string, unknown>).flatMap(
        ([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k),
      );
    };

    expect(flatten(enUS.breadcrumb).sort()).toEqual(
      flatten(ptBR.breadcrumb).sort(),
    );
  });
});
