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

  it("files the More disclosure as a menu, not as a scrim", () => {
    // The last non-scrim occupant of the scrim tier. It cannot reach Focus Mode
    // (the nav chrome is unmounted there), so it is not part of the occlusion
    // bug — but leaving a `z-50` menu in a tier documented as "scrim modals
    // only" is how the next surface repeats this defect. It is an interactive
    // menu the user is operating, so it joins Select at the dropdown step.
    expect(sourceLayers("src/shared/components/AppShell/MoreMenu.tsx")).toEqual(
      ["z-dropdown"],
    );
  });
});

/**
 * The Tooltip is the one surface allowed above the exit, and that exception is
 * asserted rather than assumed.
 *
 * It cannot simply join the passive band: `FilamentInventory` renders
 * `InputGroup` (which hosts a tooltip) INSIDE its `z-50` modal, so demoting
 * the tooltip below the modal tier would put real in-modal help text behind
 * the scrim. It also cannot stay an undocumented `zIndex: 100`, which was the
 * defect — a magic number that outranked everything, including the exit.
 *
 * What makes it safe above the exit is that it is the only surface in the app
 * that cannot intercept a click: `pointer-events-none` on the bubble, and
 * `visibility: hidden` whenever it is closed. So it may overlap the exit
 * visually while a trigger is hovered, and the exit stays operable. These tests
 * hold that line: a named step from the scale, no interception, and a real
 * click on the real exit with the real tooltip mounted.
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
