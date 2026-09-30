import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import { Header as WebHeader } from "@/shared/components/Header/Header";
import { Header as DesktopHeader } from "@/platform/desktop/components/Header/Header";

/**
 * The utility band is chrome shared by both shells, so it is locked from three
 * sides: it exists and is equivalent on web and desktop; it CLAIMS an
 * accessible name nothing else owns; and — from the migration commits on — the
 * controls it carries are gone from the header, which is the only thing that
 * makes the band worth its 40px.
 *
 * The i18n mock is a real resolver rather than the `t: (k) => k` passthrough the
 * other chrome suites use, for the reason `ContextBreadcrumb.test.tsx:14-22`
 * records: the repository locks pt/en parity for `tutorial.launcher` ONLY
 * (`layoutShell.test.ts:24-34`), so a key present in pt-BR and missing from
 * en-US renders as the raw key in English and fails nothing. A passthrough
 * mock would hide that. Every assertion below therefore reads real copy, in
 * both locales, and a missing key shows up as `utilityBar.label` in the DOM.
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

// ── Leaf chrome stubbed so these tests observe the band, not the tools around
// it. LayoutSwitcher and ThemeToggle are reached by two different specifiers
// ("./…" from the web Header, "@/shared/…" from the desktop one) and resolve to
// one module, so one mock covers both shells.
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

type ShellHeader = (typeof SHELLS)[number][1];

function renderShell(Header: ShellHeader) {
  return render(
    <NavigationProvider>
      <Header />
    </NavigationProvider>,
  );
}

/** The band, as a landmark, by its accessible name in the current locale. */
const band = () =>
  screen.getByRole("region", { name: translate("utilityBar.label", locale) });

/**
 * The five names the band must not collide with, taken from the real surfaces
 * rather than from a hand-written list of strings:
 *
 *   nav.navigation      SidebarGroup — the modules region
 *   nav.resources       SecondaryNavigation
 *   footer.navigation   the footer hub
 *   nav.mainNavigation  MobileNav — still mounted below `lg`, and jsdom's
 *                       getByRole cannot see a media query, so it is in the
 *                       tree at the same time as the band
 *   breadcrumb.label    ContextBreadcrumb, which is a `nav`, not a region
 *
 * All five are resolved in BOTH locales, because a collision only has to happen
 * in one language to make the landmark list ambiguous for that language's
 * users. `ContextBreadcrumb.test.tsx:179-210` makes the same argument for the
 * breadcrumb's own name, and `SecondaryNavigation.tsx:23-26` is where the rule
 * is written down.
 */
const TAKEN_LANDMARK_KEYS = [
  "nav.navigation",
  "nav.resources",
  "footer.navigation",
  "nav.mainNavigation",
  "breadcrumb.label",
] as const;

describe("utility band", () => {
  beforeEach(() => {
    locale = ptBR;
    useNavigationPrefsStore.setState({ activeTab: "calculator" });
  });

  it.each(SHELLS)(
    "renders a named region in the flow below the header (%s)",
    (_name, Header) => {
      const { container } = renderShell(Header);

      const el = band();
      // A `section` with an accessible name, not a `nav`: nothing in the band
      // travels, so it must not claim to be a destination list.
      expect(el.tagName.toLowerCase()).toBe("section");
      expect(el.getAttribute("aria-label")).toBe(
        translate("utilityBar.label", locale),
      );

      // In the flow, AFTER the sticky header — not inside it. Inside would make
      // the band sticky too, which would break `Sidebar.tsx:87`'s `top-[68px]`.
      const header = container.querySelector("header.sticky");
      expect(header).not.toBeNull();
      expect(
        header!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // …and a sibling of it, not a descendant.
      expect(header!.contains(el)).toBe(false);
    },
  );

  it.each(SHELLS)("is not a navigation landmark (%s)", (_name, Header) => {
    renderShell(Header);
    // The band must not be reachable as `navigation`, or the landmark list
    // grows a second destination list with no destinations in it.
    expect(
      screen.queryAllByRole("navigation", {
        name: translate("utilityBar.label", locale),
      }),
    ).toHaveLength(0);
  });

  it.each(SHELLS)(
    "claims an accessible name no other landmark owns (%s)",
    (_name, Header) => {
      renderShell(Header);

      const ours = translate("utilityBar.label", locale);
      // Resolved, not passed through: a key missing from a locale would compare
      // unequal to itself here and pass, so assert it actually translated.
      expect(ours).not.toBe("utilityBar.label");

      for (const key of TAKEN_LANDMARK_KEYS) {
        expect(ours, `collides with ${key}`).not.toBe(translate(key, locale));
      }

      // And it must be the ONLY region wearing it — globally, not scoped to the
      // band, because the colliding landmarks live elsewhere in the tree.
      const regions = screen.getAllByRole("region");
      expect(
        regions.filter((el) => el.getAttribute("aria-label") === ours),
      ).toHaveLength(1);
    },
  );

  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("resolves its label in %s and keeps it distinct there too", (_id, loc) => {
    locale = loc;
    for (const Header of SHELLS.map(([, H]) => H)) {
      const { unmount } = renderShell(Header);
      const ours = translate("utilityBar.label", loc);
      expect(ours, `untranslated in ${_id}`).not.toBe("utilityBar.label");
      for (const key of TAKEN_LANDMARK_KEYS) {
        expect(ours, `collides with ${key} in ${_id}`).not.toBe(
          translate(key, loc),
        );
      }
      unmount();
    }
  });

  it("renders the same band on web and desktop", () => {
    const read = (Header: ShellHeader): string => {
      const { unmount } = renderShell(Header);
      const el = band();
      const shape = (el.className || "").toString();
      const row = el.querySelector("div");
      const rowShape = (row?.className || "").toString();
      unmount();
      return `${shape}||${rowShape}`;
    };
    expect(read(WebHeader)).toBe(read(DesktopHeader));
  });
});
