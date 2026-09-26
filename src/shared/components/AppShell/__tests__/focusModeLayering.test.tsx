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
