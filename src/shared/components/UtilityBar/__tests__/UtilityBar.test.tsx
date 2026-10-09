import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

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
 * The i18n mock is a real resolver rather than the `t: (k) => k` passthrough
 * used by some chrome suites. Every assertion below therefore reads real copy
 * in both locales, and a missing key shows up as `utilityBar.label` in the DOM.
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

/**
 * The language is a VARIABLE for the same reason `locale` is: `LanguageToggle`
 * has two halves that both read it — the label it renders (`"EN"` in pt-BR,
 * `"PT"` in en-US) and the locale it asks for next — and pinning the mock to
 * `pt-BR` makes the second half unreachable. The toggle is a two-way control, so
 * a suite that only ever mounts it in one language tests one direction of it.
 *
 * `vi.hoisted` because the `vi.mock` factory below is lifted above the file's
 * own `const`s, so a spy declared here would be in TDZ when the factory ran.
 * The repo already does this for the same reason — `ChangelogPage.test.tsx:17`.
 */
const i18nState = vi.hoisted(() => ({
  language: "pt-BR",
  changeLanguage: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translate(key, locale),
    i18n: {
      language: i18nState.language,
      resolvedLanguage: i18nState.language,
      changeLanguage: i18nState.changeLanguage,
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
 * The currency control's accessible name, RESOLVED. This suite mocks i18next
 * with a real resolver (see the note at the top of the file), so the name in
 * the DOM is the real pt-BR copy — querying by the key would find nothing and
 * quietly assert nothing.
 */
const currencyLabel = () => translate("settings.currency", locale);

/** The language control's accessible name, resolved. */
const languageLabel = () => translate("nav.language", locale);

/**
 * NOTED, NOT FIXED HERE. `ThemeToggle.tsx:12-15` still labels itself with two
 * hardcoded pt-BR literals — "Alternar para modo claro" / "…escuro", naming the
 * mode it switches TO — instead of an i18n key. They were already wrong in
 * English before this commit; the band only changed where the button lives.
 * Fixing them means adding keys to both locales and re-baselining
 * `platform/desktop/overrides/__tests__/persistence-bridge.preferences.test.ts:100-101`,
 * which pins the literal on purpose, to assert the label names the TARGET mode.
 * That is its own commit — folding a copy change into a layout commit would
 * hide it. This suite is also why it is harmless here: the toggle is stubbed,
 * so no test in it depends on the string.
 */

/** The compact 56px header row. The band must be a SIBLING, not inside it. */
function headerRow(container: HTMLElement): HTMLElement {
  const row = Array.from(
    container.querySelector("header")!.querySelectorAll("div"),
  ).find((el) => (el.className || "").includes("h-[56px]"));
  if (!row) throw new Error("the 56px header row is gone");
  return row;
}

/** The header's own `shrink-0` action cluster, if it still has one. */
function actionCluster(container: HTMLElement): Element | undefined {
  return Array.from(headerRow(container).children).find((el) =>
    (el.className || "").includes("shrink-0"),
  );
}

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

/**
 * The language defaults, for EVERY test, once rather than per `describe`. The
 * toggle tests below leave it on `en-US` on purpose, and a leaked language
 * would make whichever suite ran next depend on test order — the failure mode
 * that makes a suite untrustworthy rather than merely fragile.
 */
beforeEach(() => {
  i18nState.language = "pt-BR";
  i18nState.changeLanguage.mockClear();
});

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
      // the band sticky too, which would break `Sidebar.tsx:93`'s `top-[56px]`.
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

/**
 * What the band is FOR. The header's action cluster is `shrink-0`, so it never
 * gives ground and the band exists to take weight off it. That only works if
 * the controls actually leave — so each migration commit adds its control here
 * and asserts both halves: the band carries it, and the 56px row no longer
 * does.
 */
describe("utility band migrations", () => {
  beforeEach(() => {
    locale = ptBR;
    useNavigationPrefsStore.setState({ activeTab: "calculator" });
  });

  describe("currency", () => {
    it.each(SHELLS)(
      "the band carries the currency trigger (%s)",
      (_n, Header) => {
        renderShell(Header);
        const trigger = within(band()).getByRole("button", {
          name: currencyLabel(),
        });
        // Kept `shrink-0` deliberately: the band's row is `overflow-x-auto`, and
        // a control that shrank here would be the same defect the header had,
        // one band lower. It is the assertion Header.test.tsx:292-301 makes,
        // re-pointed at the control's new home rather than dropped.
        expect(trigger.className).toContain("shrink-0");
        // 44px target, WCAG 2.5.5.
        expect(trigger.className).toContain("min-h-[44px]");
      },
    );

    it.each(SHELLS)(
      "the header row no longer carries it (%s)",
      (_n, Header) => {
        const { container } = renderShell(Header);
        const row = headerRow(container);
        // Not merely "not in the cluster" — not anywhere in the 56px row, which
        // is what "it left the header" has to mean.
        expect(
          row.querySelector(`[aria-label="${currencyLabel()}"]`),
        ).toBeNull();
        // And named explicitly for the one container that was `shrink-0` — the
        // cluster is what refused to give ground, so "the trigger is not in it"
        // is the assertion that actually describes the fix.
        const cluster = actionCluster(container);
        expect(
          cluster,
          "the header lost its action cluster entirely",
        ).toBeDefined();
        expect(
          cluster!.querySelector(`[aria-label="${currencyLabel()}"]`),
        ).toBeNull();
      },
    );

    it.each(SHELLS)(
      "keeps the trigger/menu aria pairing (%s)",
      (_n, Header) => {
        const { container } = renderShell(Header);
        const trigger = within(band()).getByRole("button", {
          name: currencyLabel(),
        });
        expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        // The id is asserted verbatim by Header.test.tsx:133,237,244, so the
        // move could not rename it — only relocate it.
        expect(trigger).toHaveAttribute(
          "aria-controls",
          "header-currency-menu",
        );
        expect(container.ownerDocument).toBe(document);
      },
    );
  });

  /**
   * Theme and language, together, because they are the two halves of the
   * remaining ~200px and neither alone clears the breadcrumb: currency gave
   * 90.6px measured, and the breadcrumb's own sub-2xl width is ~166px. See the
   * numbers in the commit message.
   */
  describe("language and theme", () => {
    // The theme toggle is STUBBED in this suite (`data-testid="theme-toggle"`,
    // the same stub `Header.test.tsx:101` and `ContextBreadcrumb.test.tsx:57`
    // use), so it is reached by testid here, not by role. Its own rendered
    // classNames are asserted where the real component is rendered —
    // `Header/__tests__/ThemeToggle.test.tsx`.
    it.each(SHELLS)("the band carries both (%s)", (_n, Header) => {
      renderShell(Header);
      const inBand = within(band());

      const lang = inBand.getByRole("button", { name: languageLabel() });
      // Same two properties the header copy had, asserted at the new home:
      // never squashed, never below a 44px target.
      expect(lang.className).toContain("shrink-0");
      expect(lang.className).toContain("min-h-[44px]");
      // An icon-only-looking control still needs its name; the visible "EN"/"PT"
      // is a bonus, not the label.
      expect(lang).toHaveAttribute("aria-label", languageLabel());

      expect(inBand.getByTestId("theme-toggle")).toBeInTheDocument();
    });

    it.each(SHELLS)(
      "the header row no longer carries them (%s)",
      (_n, Header) => {
        const { container } = renderShell(Header);
        const row = headerRow(container);
        const cluster = actionCluster(container);
        expect(
          cluster,
          "the header lost its action cluster entirely",
        ).toBeDefined();

        // The language button by its real accessible name, and the theme toggle
        // by its stub id — one of each, so the assertion does not depend on the
        // toggle's hardcoded label pair (`ThemeToggle.tsx:12-15`).
        expect(
          row.querySelector(`[aria-label="${languageLabel()}"]`),
        ).toBeNull();
        expect(
          cluster!.querySelector(`[aria-label="${languageLabel()}"]`),
        ).toBeNull();
        expect(row.querySelector('[data-testid="theme-toggle"]')).toBeNull();
        expect(
          cluster!.querySelector('[data-testid="theme-toggle"]'),
        ).toBeNull();
      },
    );

    /**
     * The toggle is TWO-WAY, and this is where that stops being assumed.
     *
     * Everything above proves the control is in the band, is named, is never
     * squashed, and sits above the header row. None of it proves what the
     * button SAYS or where it sends you — because the suite's i18n mock pinned
     * `language: "pt-BR"`, which left both halves of the flip as dead branches
     * in `LanguageToggle.tsx:27,40`: the `"PT"` label and the `en-US → pt-BR`
     * half of the next-locale computation. The component sat at 50% branch
     * coverage as a result. Mounting it in each language is what closes them,
     * and asserting the ARGUMENT is what makes it a test of the flip rather
     * than of a click.
     *
     * `en-US` is a LEGITIMATE state, not an impossible one: i18next's own
     * language detector resolves to it for any browser set to English outside
     * Brazil, which is precisely the user the pt-BR-only mock was hiding.
     */
    it.each(SHELLS)(
      "offers EN and asks for en-US while the locale is pt-BR (%s)",
      (_n, Header) => {
        renderShell(Header);
        const lang = within(band()).getByRole("button", {
          name: languageLabel(),
        });

        // The code shown is the language it switches TO, never the one in use.
        // Getting this backwards is the classic defect of a two-state toggle,
        // and it is invisible while only one of the two states is mounted.
        expect(lang).toHaveTextContent("EN");
        expect(lang).not.toHaveTextContent("PT");

        fireEvent.click(lang);
        expect(i18nState.changeLanguage).toHaveBeenCalledTimes(1);
        expect(i18nState.changeLanguage).toHaveBeenCalledWith("en-US");
      },
    );

    it.each(SHELLS)(
      "offers PT and asks for pt-BR while the locale is en-US (%s)",
      (_n, Header) => {
        i18nState.language = "en-US";
        renderShell(Header);
        const lang = within(band()).getByRole("button", {
          name: languageLabel(),
        });

        // The label flips with the locale, and the locale the control asks for
        // is its mirror — so an English user is offered Portuguese, not a
        // second click on English.
        expect(lang).toHaveTextContent("PT");
        expect(lang).not.toHaveTextContent("EN");

        fireEvent.click(lang);
        expect(i18nState.changeLanguage).toHaveBeenCalledTimes(1);
        expect(i18nState.changeLanguage).toHaveBeenCalledWith("pt-BR");
      },
    );

    it.each(SHELLS)(
      "the band order preserves context and shell-specific controls (%s)",
      (_n, Header) => {
        renderShell(Header);
        // Order here IS the tab order. Web keeps the calculator controls beside
        // context; desktop has only the shared context and utility actions.
        const el = band();
        // The band is <section> > row > scroll row > controls, so the controls
        // are the grandchildren of the first div. Navigating by STRUCTURE
        // rather than by a utility class keeps this from breaking when the
        // band is restyled.
        const kids = Array.from(el.querySelector("div")!.children).flatMap(
          (row) => Array.from(row.children),
        );
        // Stable identifiers keep the expected visual/action order explicit
        // without depending on Tailwind class order.
        expect(
          kids.map(
            (k) =>
              k.getAttribute("data-testid") ??
              k.getAttribute("aria-label") ??
              k.querySelector("[aria-label]")?.getAttribute("aria-label") ??
              k.getAttribute("data-testid"),
          ),
        ).toEqual(
          _n === "web"
            ? [
                translate("breadcrumb.label", locale),
                "calculator-layout-control",
                "model-preset-control",
                currencyLabel(),
                languageLabel(),
                "theme-toggle",
              ]
            : [
                translate("breadcrumb.label", locale),
                currencyLabel(),
                languageLabel(),
                "theme-toggle",
              ],
        );
      },
    );
  });
});
