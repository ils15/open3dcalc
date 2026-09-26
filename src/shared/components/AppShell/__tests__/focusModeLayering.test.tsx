import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import { resolve } from "node:path";

import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

/**
 * Phase 7o s4 follow-up — the Focus Mode exit is ALWAYS VISIBLE.
 *
 * The stage shipped a structural promise: the exit renders whenever the mode is
 * on, in no dialog and in no trap. Themis found two ways the "always" was
 * false anyway, both purely about LAYER — the promise was made in the DOM tree
 * and never checked in the stacking order:
 *
 * 1. The exit sat at z-[60], ABOVE the modal tier (z-50), so it painted over
 *    the backdrops of ConfirmDialog, ConsentModal, PrivacyPolicy, DataSyncModal,
 *    ComparisonModal, the field customizer and the tutorial. Chrome floating
 *    over a modal's scrim is the visible half; the other half is that it
 *    contradicts the rule the design already reasons about — a modal owns
 *    Escape and owns the screen while it is up.
 *
 * 2. StlPreview's fullscreen / toolpath overlay sat at z-[100], above the exit,
 *    so it obscured AND intercepted it. That overlay is reachable while Focus
 *    Mode is on precisely because the mode forces activeTab: "calculator" —
 *    StlPreview is mounted by MaterialSection, inside the calculator. It is
 *    not a permanent trap (the overlay owns Escape and has its own toggle), but
 *    the guarantee as written did not hold.
 *
 * The fix is a scale, not a nudged number. `tokens.css` already owned
 * `--z-dropdown`, so this file joins that scale rather than inventing a second
 * one, and consumes it the way `Select` already does (inline
 * `style={{ zIndex: "var(--z-…)" }}`) so the ordering is assertable here and
 * not only by reading class names.
 *
 * These tests drive the REAL StlPreview portal. Mocking it away is exactly the
 * mistake that let defect 2 through: a test that deletes the overlay proves
 * nothing about what the overlay does to the stacking order.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

// ─── R3F / three: jsdom has no GL. Mirrors StlPreview.test.tsx so the real
// StlPreview (and therefore the real fullscreen portal) can mount.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}));
vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBounds: () => ({ fit: vi.fn(), refresh: vi.fn(), clip: vi.fn() }),
  MeshStandardMaterial: () => null,
  MeshBasicMaterial: () => null,
}));
vi.mock("three/examples/jsm/loaders/STLLoader", () => ({ STLLoader: vi.fn() }));
vi.mock("three/examples/jsm/loaders/OBJLoader", () => ({ OBJLoader: vi.fn() }));

// The calculator surface is stubbed exactly as focusMode.test.tsx does, but it
// renders the REAL StlPreview — which is what MaterialSection mounts at the
// three call sites that stay reachable in Focus Mode. The factory body runs at
// render time, not at hoist time, so the closed-over imports are initialised.
vi.mock("@/shared/components/Calculator/surfaces/CalculatorSurface", () => ({
  CalculatorSurface: () => <StlPreview initialGeometry={geometryFixture} />,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geometryFixture: any = {
  type: "BufferGeometry",
  uuid: "focus-mode-geometry",
  clone: vi.fn().mockReturnThis(),
};

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
import { FocusModeButton } from "@/shared/components/AppShell/FocusModeButton";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import {
  useActiveTab,
  useNavigateToTab,
} from "@/shared/components/AppShell/NavigationContext";
import { StlPreview } from "@/shared/components/StlPreview/StlPreview";
import { ToastContainer } from "@/shared/components/ui/Toast";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import { Tutorial } from "@/shared/components/ui/Tutorial";
import { useLayoutStore } from "@/shared/stores/layoutStore";

const TOKENS_CSS = resolve(process.cwd(), "src/styles/tokens.css");

/** The numeric value a `--z-*` scale step declares in tokens.css. */
function scaleStep(name: string): number {
  const css = fs.readFileSync(TOKENS_CSS, "utf8");
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)`));
  expect(
    match,
    `--${name} must be declared in the layering scale in tokens.css`,
  ).not.toBeNull();
  return Number(match![1]);
}

/** The scale step a real element actually resolved to. */
function resolvedStep(element: HTMLElement): string {
  const value = element.style.zIndex;
  expect(
    value,
    "element must take its layer from the scale, not from a literal class",
  ).toMatch(/^var\(--z-[a-z-]+\)$/);
  // `var(--z-viewer)` -> `z-viewer`; `scaleStep` re-adds the `--` prefix.
  return value.slice(4, -1).replace(/^--/, "");
}

/**
 * Every scale step a source file's surfaces take, read from their inline styles.
 *
 * Used only for surfaces this harness does not mount — the platform bottom nav
 * is composed by the Apps, outside AppShell, and the results-sidebar listbox
 * and field customizer sit behind store state that a layering test has no
 * business arranging. The property under test is static anyway (which step a
 * surface was given), so reading the declaration is the direct assertion; the
 * surfaces that CAN be mounted here are mounted instead, further down.
 */
function sourceLayers(file: string): string[] {
  const src = fs.readFileSync(resolve(process.cwd(), file), "utf8");
  // Captured WITH the `z-` prefix, so the result feeds `scaleStep` and
  // `resolvedStep` unchanged — one spelling of a step name in this file.
  return [...src.matchAll(/zIndex:\s*"var\(--(z-[a-z-]+)\)"/g)].map(
    (m) => m[1],
  );
}

function Harness(): React.ReactElement {
  const activeTab = useActiveTab();
  const navigateToTab = useNavigateToTab();
  return (
    <>
      <FocusModeButton />
      <AppShell
        activeTab={activeTab}
        onTabChange={navigateToTab}
        mainClassName="main-normal"
        mainFocusClassName="main-focus"
      />
    </>
  );
}

function renderHarness(): void {
  render(
    <NavigationProvider>
      <Harness />
    </NavigationProvider>,
  );
}

function enterFocusMode(): void {
  fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));
}

function exitBar(): HTMLElement {
  return screen.getByTestId("focus-mode-exit");
}

function exitButton(): HTMLElement {
  return screen.getByRole("button", { name: "focusMode.exit" });
}

beforeEach(() => {
  window.localStorage.clear();
  useNavigationPrefsStore.setState({
    ...defaultNavigationPrefs(),
    focusMode: false,
    focusModeReturnTab: null,
  });
  useTutorialStore.setState({ isActive: false, sessionDismissed: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("focus mode — the exit is layered, not merely present", () => {
  it("sits BELOW the modal tier, so chrome never paints over a scrim", () => {
    renderHarness();
    enterFocusMode();

    // The defect: z-[60] against a modal tier of z-50. A modal asks the user a
    // question and owns the screen while it is up; an always-on-top exit
    // floating across its backdrop contradicts the rule the design already
    // reasons about everywhere else.
    expect(resolvedStep(exitBar())).toBe("z-shell-chrome");
    expect(scaleStep("z-shell-chrome")).toBeLessThan(50);
  });

  it("declares the two steps it needs as one ordered scale", () => {
    // A viewer (the same surface, full-bleed) sits under shell chrome; a modal
    // sits over it. If the order of those three ever inverts, one of the two
    // guarantees above is false again — so the ORDER is the assertion.
    expect(scaleStep("z-viewer")).toBeLessThan(scaleStep("z-shell-chrome"));
    expect(scaleStep("z-shell-chrome")).toBeLessThan(50);
    expect(scaleStep("z-dropdown")).toBeGreaterThan(50);
  });
});

/**
 * Defect 3 — a PASSIVE surface buried the exit.
 *
 * Moving the exit from `z-[60]` down to `--z-shell-chrome` fixed the scrim
 * half of the first defect and opened this one: at `z-50` the Toast was the
 * modal TIER, and the modal tier sits above shell chrome by design. The toast
 * is not a modal. It is `role="region"` — no scrim, no focus trap, it does not
 * own Escape, and it dismisses itself after 4s — and `escapeIsOwnedByOverlay`
 * does not even match it, so nothing in the model treated it as a layer at
 * all. It inherited the one tier whose whole justification is "this surface
 * owns the screen", and the exit inherited the consequence.
 *
 * At `sm+` the two are pixel-identical: Toast anchors `sm:top-4 sm:right-4`,
 * the exit anchors `sm:top-4 sm:right-4`. The toast therefore painted
 * directly over the only way out of the mode, and covered it for four
 * seconds. It is reachable: `Calculator.tsx` mounts `ToastContainer` on the
 * calculator surface and Focus Mode forces `activeTab: "calculator"`.
 *
 * The root cause is not the number. It is that one tier admitted both
 * scrim-owning modals AND passive transients, so a surface that owns nothing
 * could inherit the right to cover the only thing that must stay reachable.
 * Passive surfaces get their own step, under shell chrome, and the modal tier
 * is left meaning only what it says.
 */
describe("focus mode — a passive surface never buries the exit", () => {
  /** The real ToastContainer, in the position Calculator.tsx gives it. */
  function PassiveHarness(): React.ReactElement {
    const activeTab = useActiveTab();
    const navigateToTab = useNavigateToTab();
    return (
      <>
        <FocusModeButton />
        <ToastContainer
          items={[{ id: 1, message: "Export blocked", type: "info" }]}
          onDismiss={vi.fn()}
        />
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName="main-normal"
          mainFocusClassName="main-focus"
        />
      </>
    );
  }

  function renderPassiveHarness(): void {
    render(
      <NavigationProvider>
        <PassiveHarness />
      </NavigationProvider>,
    );
  }

  function toastRegion(): HTMLElement {
    return screen.getByRole("region", { name: "Notificações" });
  }

  it("mounts the REAL toast inside Focus Mode and keeps it under the exit", () => {
    // Not a stub: the toast is the element that caused the defect, so mocking
    // it away would prove nothing — the same mistake the StlPreview portal
    // test was written to avoid.
    renderPassiveHarness();
    enterFocusMode();

    const toast = toastRegion();
    expect(
      toast,
      "the real toast must be mounted while the mode is on",
    ).toBeInTheDocument();

    // The defect: the toast resolved to the modal tier (z-50), one step above
    // the exit, at the same top-right anchor.
    expect(resolvedStep(toast)).toBe("z-passive");
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(toast)),
    );
  });

  it("shares the exit's top-right anchor at sm+, which is why the tier decides", () => {
    // jsdom has no layout and no hit-testing, so the occlusion itself cannot be
    // measured. Its two INPUTS can be: both surfaces resolve to the same corner
    // once the mobile breakpoint passes, so nothing but the layer order keeps
    // them apart. Pin both, or this test silently stops describing the bug.
    renderPassiveHarness();
    enterFocusMode();

    const toast = toastRegion();
    const exit = exitBar();
    for (const anchor of ["sm:top-4", "sm:right-4"]) {
      expect(toast.className).toContain(anchor);
      expect(exit.className).toContain(anchor);
    }
  });

  it("leaves the exit focusable and clickable while a toast is up", () => {
    // Layering alone is not the guarantee, and neither is focus: the toast is
    // the surface that used to sit on top. So the control is actually used,
    // because a number nobody clicks is not a reachable exit.
    renderPassiveHarness();
    enterFocusMode();
    const toast = toastRegion();
    expect(toast).toBeInTheDocument();
    // Anchored, not vacuous: jsdom does not hit-test, so this test would pass on
    // its own even with the toast on top. The layer relation is the part that
    // would have caught it; the click below is what keeps the number honest.
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(toast)),
    );

    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);

    fireEvent.click(exit);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(screen.queryByTestId("focus-mode-exit")).toBeNull();
  });

  it("gives Escape to nobody when only a passive surface is up", () => {
    // A toast owns no key, so it must not silently disarm the exit the way an
    // overlay would. `escapeIsOwnedByOverlay` matches dialog/menu/listbox and
    // a toast is none of those — asserted here so the passive tier cannot grow
    // a marker that would make the toast an Escape owner by accident.
    renderPassiveHarness();
    enterFocusMode();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("declares passive as its own step, not as a member of the modal tier", () => {
    // The model, as an order. Everything that owns nothing is under the exit;
    // the exit is under everything that owns the screen.
    expect(scaleStep("z-app-chrome")).toBeLessThan(scaleStep("z-passive"));
    expect(scaleStep("z-viewer")).toBeLessThan(scaleStep("z-passive"));
    expect(scaleStep("z-passive")).toBeLessThan(scaleStep("z-shell-chrome"));
    expect(scaleStep("z-shell-chrome")).toBeLessThan(50);
    expect(50).toBeLessThan(scaleStep("z-dropdown"));
    expect(scaleStep("z-dropdown")).toBeLessThan(scaleStep("z-panel"));
  });

  it("puts the mobile bottom nav under the passive band, in both platforms", () => {
    // The toast sits at `bottom-4` and the nav at `bottom-0`, so the toast has
    // to win or the nav buries IT — which is why the nav cannot stay filed in
    // the modal tier either. Web and desktop had drifted to 50 and 40 for the
    // same component; one named step is what stops them drifting again.
    for (const file of [
      "src/platform/web/components/MobileNav.tsx",
      "src/platform/desktop/components/MobileNav.tsx",
    ]) {
      expect(
        sourceLayers(file),
        `${file} must take its layer from the scale`,
      ).toContain("z-app-chrome");
    }
  });

  it("keeps the bounded non-scrim popovers under the exit", () => {
    // Two more surfaces that were filed in the modal tier without being modals.
    // Neither is mounted here, so the assertion is on the declared step.
    for (const file of [
      "src/shared/components/Results/InventoryDeductionCard.tsx",
      "src/shared/components/Calculator/FieldCustomizer.tsx",
    ]) {
      const layers = sourceLayers(file);
      expect(
        layers.length,
        `${file} must take its layer from the scale`,
      ).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(
          scaleStep(layer),
          `${file} (${layer}) must stay under the exit`,
        ).toBeLessThan(scaleStep("z-shell-chrome"));
      }
    }
  });

  it("files every menu at the dropdown step, not as a scrim", () => {
    // The last non-scrim occupants of the tiers they do not belong to. None can
    // reach Focus Mode (the nav chrome is unmounted there), so none is part of
    // the occlusion bug — but a menu left at z-50 or on a bare literal is how
    // this scale was breached twice, and the two Headers are the pair that
    // drifted apart last time (the bottom nav was 50 on web and 40 on desktop
    // for the same component). Every one of these is a `role="menu"` the user is
    // actively operating, so they belong with Select at --z-dropdown.
    //
    // The marker differs per file on purpose: `MoreMenu` is the one
    // `useDismissablePopover` panel with no ARIA role at all, which
    // `focusMode.ts` calls out by name — it needs no marker because it is
    // navigation chrome and so does not exist while Focus Mode is on. The other
    // three are `role="menu"`.
    const menus: Array<[string, string]> = [
      [
        "src/shared/components/AppShell/MoreMenu.tsx",
        'data-testid="more-menu"',
      ],
      ["src/shared/components/Header/Header.tsx", 'role="menu"'],
      ["src/platform/desktop/components/Header/Header.tsx", 'role="menu"'],
      ["src/shared/components/ui/TutorialLauncher.tsx", 'role="menu"'],
    ];
    for (const [file, marker] of menus) {
      const src = fs.readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src, `${file} must actually render a menu`).toContain(marker);
      expect(
        sourceLayers(file),
        `${file} must take its band from the scale, not a literal`,
      ).toEqual(["z-dropdown"]);
    }
  });

  it("leaves no undeclared layer above the exit", () => {
    // The audit, as a test. Every remaining `z-50` in the tree is a real scrim,
    // so the rule in tokens.css ("z-50 means a surface that owns the screen") is
    // true rather than aspirational. A menu left at z-50 is how the last two
    // holes got in, so the tier is pinned here.
    const scrims = [
      "src/shared/components/ui/ConfirmDialog.tsx",
      "src/shared/components/ui/ConsentModal.tsx",
      "src/shared/components/ui/PrivacyPolicy.tsx",
      "src/shared/components/ui/DataSyncModal.tsx",
      "src/shared/components/ui/ComparisonModal.tsx",
      "src/shared/components/Calculator/QuoteSection.tsx",
      "src/shared/components/Calculator/HistoryTab/HistoryTab.tsx",
      "src/shared/components/Catalog/CustomerTab.tsx",
      "src/shared/components/Catalog/ProductInventory.tsx",
      "src/shared/components/Catalog/FilamentInventory.tsx",
      "src/shared/components/Catalog/CatalogTab.tsx",
      "src/shared/components/SpoolShelf/SpoolForm.tsx",
    ];
    for (const file of scrims) {
      const src = fs.readFileSync(resolve(process.cwd(), file), "utf8");
      // Each of these is `fixed inset-0 z-50` plus a backdrop colour: the shape
      // of a surface that dims the page and closes on a click.
      expect(
        /fixed inset-0 z-50[^\n]*bg-/.test(src),
        `${file} must be a scrim if it sits in the scrim tier`,
      ).toBe(true);
    }
  });
});

/**
 * Defect 4 — the guided tour is an OWNING surface, and the rule said it was not.
 *
 * The tour is a scrim (`rgba(0,0,0,0.6)`, click-to-dismiss) with a card the user
 * is meant to answer: it has a scrim, it takes a click, and it takes Escape
 * (`finishTutorial()`, Tutorial.tsx:504). By ownership that puts it in the same
 * class as a scrim modal, so it is CORRECT for it to sit above the exit, and
 * correct for the exit to yield while it is up.
 *
 * What was wrong was the rule text, which claimed the tooltip was "the one
 * surface allowed above shell chrome" and that "anything clickable" was
 * forbidden there. 55 and 56 are above 45, and the tour card is clickable. The
 * rule was describing a tree it did not match, which is how a second hole got
 * in after the first was closed.
 *
 * `App.tsx:93` mounts the tutorial outside the Focus Mode guard on purpose, and
 * `App.focusMode.test.tsx` pins that — but it pins it with a MOCK
 * (`Tutorial: () => <div data-testid="tutorial" />`), so what it actually
 * asserts is that the component is still mounted, never that a scrim exists.
 * The decision stands, unchanged; these tests are what finally exercise it. A
 * keyboard user, with no focus trap to stop them, can Tab to the
 * FocusModeButton and press Enter mid-tour — the sequence modelled here.
 */
describe("focus mode — the guided tour owns the screen, and the exit yields", () => {
  function TourHarness(): React.ReactElement {
    const activeTab = useActiveTab();
    const navigateToTab = useNavigateToTab();
    return (
      <>
        <FocusModeButton />
        {/* The anchor the first spotlighted step looks for. */}
        <div data-tutorial="material" data-testid="tour-anchor" />
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName="main-normal"
          mainFocusClassName="main-focus"
        />
        {/* As App.tsx:93 mounts it: outside the Focus Mode guard. */}
        <Tutorial />
      </>
    );
  }

  function renderTourHarness(): void {
    render(
      <NavigationProvider>
        <TourHarness />
      </NavigationProvider>,
    );
  }

  function startTour(): void {
    useLayoutStore.setState({ layoutMode: "classic" });
    act(() => {
      useTutorialStore.getState().startTutorial();
    });
  }

  /** The real scrim, found by its test id rather than by its class. */
  function tourScrim(): HTMLElement {
    return screen.getByTestId("tutorial-overlay");
  }

  it("mounts the REAL tour in Focus Mode and layers it as an owning surface", () => {
    renderTourHarness();
    startTour();
    enterFocusMode();

    // The real component, the real scrim, the real card. Mocking the tutorial is
    // what `App.focusMode.test.tsx` does, and it is why this went uncaught.
    const scrim = tourScrim();
    expect(scrim).toBeInTheDocument();
    const card = document.querySelector<HTMLElement>('[data-tutorial="true"]');
    expect(card, "the real tour card must be up").not.toBeNull();

    // Declared steps, not magic literals — the rule can only be true of the
    // tree if every layer in it is named.
    expect(resolvedStep(scrim)).toBe("z-tour");
    expect(resolvedStep(card!)).toBe("z-tour-card");

    // And the relationship is asserted deliberately, not tolerated: an owning
    // surface belongs above the exit, because it owns the screen and the key.
    expect(scaleStep("z-tour")).toBeGreaterThan(scaleStep("z-shell-chrome"));
    expect(scaleStep("z-tour-card")).toBeGreaterThan(scaleStep("z-tour"));
  });

  it("gives Escape to the tour, and the exit is operable the moment it ends", () => {
    // "Always reachable" stated honestly: while an owning surface is up, the
    // exit is not what responds — the owning layer is, and it ends on that same
    // key. One key, one layer, and the exit is back. This is the contract the
    // exit has had for scrim modals since the first commit; the tour is the same
    // class, so it gets the same contract, and the spec's "always" is NOT
    // narrowed — the exit is never destroyed and never trapped, only deferred.
    renderTourHarness();
    startTour();
    enterFocusMode();
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(
      useNavigationPrefsStore.getState().focusMode,
      "the tour owns Escape, so the mode must survive it",
    ).toBe(true);
    expect(screen.queryByTestId("tutorial-overlay")).toBeNull();

    // And the exit now works, for real.
    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);
    fireEvent.click(exit);
    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("is the scrim, not the exit, that the tour intercepts", () => {
    // The defect was never "the exit is under an opaque scrim" — that is what a
    // tour IS. It was that the scrim had no declared owner. It takes the click,
    // and taking it is what dismisses the tour.
    renderTourHarness();
    startTour();
    enterFocusMode();

    fireEvent.click(tourScrim());

    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    expect(exitBar()).toBeInTheDocument();
  });
});
/**
 * The Tooltip is the one INERT surface allowed above the exit, and that
 * exception is asserted rather than assumed.
 *
 * It cannot simply join the passive band, because it is a global annotator and
 * its trigger can live inside any layer: a trigger added inside a Select menu
 * (60) or the guide drawer (70) tomorrow must not produce help text that
 * renders behind its own trigger. It also cannot stay an undocumented
 * `zIndex: 100`, which was the defect — a magic number that outranked
 * everything, including the exit.
 *
 * What makes it safe above the exit is inertness: `pointer-events-none` on the
 * bubble and `visibility: hidden` whenever it is closed. It may overlap the
 * exit while a trigger is hovered, and the exit stays operable. These tests
 * hold that line: a named step from the scale, no interception, and a real
 * click on the real exit with the real tooltip mounted.
 *
 * Worth being precise about, because the first version of this comment was
 * wrong twice over: no call site needs the top band today. `InputGroup` renders
 * its tooltip only when the `tooltip` prop is passed, and no `tooltip=` call
 * site is inside a modal, a panel or a menu — so this is a rule about the
 * primitive, pinned by a test, not a claim about a usage that does not exist.
 */
describe("focus mode — the tooltip exception holds", () => {
  function TooltipHarness(): React.ReactElement {
    const activeTab = useActiveTab();
    const navigateToTab = useNavigateToTab();
    return (
      <>
        <FocusModeButton />
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName="main-normal"
          mainFocusClassName="main-focus"
        />
        <Tooltip content="Ajuda" delay={0}>
          <button type="button">tooltip-trigger</button>
        </Tooltip>
      </>
    );
  }

  /** The floating bubble, found through its inline z-index like the DOM does. */
  function tooltipBubble(): HTMLElement {
    const bubble = screen
      .getByText("Ajuda")
      .closest<HTMLElement>('[style*="z-index"]');
    expect(
      bubble,
      "the real tooltip bubble must be portaled into the document",
    ).not.toBeNull();
    return bubble!;
  }

  it("takes a named step from the scale instead of an undocumented 100", () => {
    render(
      <NavigationProvider>
        <TooltipHarness />
      </NavigationProvider>,
    );
    enterFocusMode();

    // The defect: a bare 100, above every declared step, documenting nothing.
    expect(resolvedStep(tooltipBubble())).toBe("z-tooltip");
    expect(scaleStep("z-tooltip")).toBeGreaterThan(scaleStep("z-panel"));
  });

  it("cannot intercept the exit, so being above it is survivable", () => {
    render(
      <NavigationProvider>
        <TooltipHarness />
      </NavigationProvider>,
    );
    enterFocusMode();

    const bubble = tooltipBubble();
    expect(
      bubble.className,
      "the exception is only sound while the bubble is inert",
    ).toContain("pointer-events-none");
    // Same anchoring as the toast case: the click is the proof that the
    // exception is load-bearing, the layer is what makes it non-vacuous.
    expect(resolvedStep(bubble)).toBe("z-tooltip");

    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);
    fireEvent.click(exit);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });
});

describe("focus mode — the exit survives the real StlPreview fullscreen overlay", () => {
  it("opens the REAL portal from inside Focus Mode and leaves the exit on top of it", () => {
    // MaterialSection mounts StlPreview at three sites inside the calculator,
    // and Focus Mode forces activeTab: "calculator" — so this overlay is
    // reachable while the mode is on. Driving the real component is the point:
    // a stub would delete the very element that caused the defect.
    renderHarness();
    enterFocusMode();

    fireEvent.click(screen.getByRole("button", { name: "stl.fullscreen" }));

    const overlay = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    expect(
      overlay,
      "the real fullscreen portal must be in the DOM",
    ).not.toBeNull();
    expect(resolvedStep(overlay!)).toBe("z-viewer");
    // The defect: z-[100] against the exit's z-[60].
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(overlay!)),
    );
  });

  it("leaves the exit focusable and clickable while the overlay is up", () => {
    // Layering alone is not the guarantee: the overlay is `fixed inset-0`, so
    // it also INTERCEPTS pointer events over the exit. jsdom has no layout and
    // no hit-testing, so the interception property is asserted structurally —
    // nothing may sit in a layer above the exit while the overlay is open —
    // and the operability of the control is then asserted by actually using it,
    // because a number nobody clicks is not a reachable exit.
    renderHarness();
    enterFocusMode();
    fireEvent.click(screen.getByRole("button", { name: "stl.fullscreen" }));
    const overlay = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    expect(overlay).not.toBeNull();
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(overlay!)),
    );
    // The exit is a sibling of the portal, not swallowed by it.
    expect(overlay).not.toContainElement(exitButton());

    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);

    fireEvent.click(exit);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(screen.queryByTestId("focus-mode-exit")).toBeNull();
  });

  it("gives Escape to the overlay rather than taking it for the exit", () => {
    // One Escape, one layer. The overlay declares role="dialog", which is what
    // `escapeIsOwnedByOverlay` reads — this is the same rule the stage-3
    // Manage Visibility dialog relies on, asserted against a real overlay.
    renderHarness();
    enterFocusMode();
    fireEvent.click(screen.getByRole("button", { name: "stl.fullscreen" }));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      useNavigationPrefsStore.getState().focusMode,
      "the overlay owns the key, so the mode must survive",
    ).toBe(true);
  });
});
