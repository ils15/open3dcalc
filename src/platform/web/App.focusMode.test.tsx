import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";

/**
 * The web shell's share of the Focus Mode chrome — after the Studio layout
 * refactor (#260).
 *
 * The shared AppShell suites prove the *desktop* sidebars and their exit
 * control; this file covers the web App, which since #260 is `StudioLayout`.
 * The Studio owns its own `focusMode` state — it no longer reads
 * `navigationPrefsStore`, and the store-driven `enterFocusMode` /
 * `exitFocusMode` calls the old spec used are now inert. The mode is driven
 * here through the triggers the Studio actually binds: the `f` key, `Escape`,
 * and the two on-screen toggles.
 *
 * What changed in the chrome set, and why the old expectations are gone:
 *   - `Header`, `MobileNav` and `Footer` are not in the Studio tree at all.
 *     They were unmounted by #260, so "the footer disappears in Focus Mode"
 *     was vacuous — there is no footer to begin with. Their replacements are
 *     `StudioHeader`, the sub-header rail, `StudioSidebar` and the floating
 *     `StudioCockpitDock`, and those are what this file tracks.
 *   - There IS a `Tutorial` layer on web again — `App.tsx` mounts it behind
 *     `layoutMode === "classic"`, mirroring the desktop shell, because
 *     `useAppInit` auto-starts the first-run tour on web and a tour that
 *     "activates" without rendering is worse than no tour. `useAppInit` is
 *     stubbed below, so the timer never fires here and the Tutorial stays
 *     inert; this file is about which chrome a focus state takes away, and
 *     the tour is not chrome. There is still no `ConsentModal`; first run is
 *     `PrivacyOnboarding` + `PiiLockedShell`.
 *   - `<main>` no longer reserves `pb-32` for a fixed mobile bar. The Studio
 *     has no such bar, so the reserve it asserted was a page of whitespace
 *     that Focus Mode was, in fact, right to drop. What Focus Mode really
 *     does to `<main>` now is centre it, which is what the padding spec below
 *     checks.
 *
 * The chrome is rendered for real and the destination views are stubbed,
 * mirroring `StudioLayout.exportGuard.test.tsx` for the same component. The
 * calculator view is the one exception: it renders for real, because it is the
 * default destination and stubbing it would drop the whole calculator subtree
 * out of the suite's reach for no gain — nothing here asserts on it.
 */

vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

// Destination views that are NOT the default one are stubbed so a click does
// not mount a whole screen. The destinations reachable only by navigation are
// deliberately left real and unmocked: with the workspace opening on the
// calculator they never render, so they cost nothing here.
vi.mock("./components/studio/StudioDashboardView", () => ({
  StudioDashboardView: () => null,
}));
vi.mock("./components/studio/StudioSpoolView", () => ({
  StudioSpoolView: () => null,
}));
vi.mock("./components/studio/StudioHistoryView", () => ({
  StudioHistoryView: () => null,
}));
vi.mock("./components/studio/StudioCustomerView", () => ({
  StudioCustomerView: () => null,
}));
vi.mock("./components/studio/StudioQuotesView", () => ({
  StudioQuotesView: () => null,
}));
vi.mock("./components/studio/StudioProductsView", () => ({
  StudioProductsView: () => null,
}));
vi.mock("./components/studio/StudioMiniDashOverlay", () => ({
  StudioMiniDashOverlay: () => null,
}));
vi.mock("./components/studio/StudioCopilotModal", () => ({
  StudioCopilotModal: () => null,
}));
vi.mock("./components/studio/StudioShortcutsModal", () => ({
  StudioShortcutsModal: () => null,
}));
vi.mock("./components/studio/StudioQuoteModal", () => ({
  StudioQuoteModal: () => null,
}));

// Test ids rather than `null`, so "unmounted" is distinguishable from
// "rendered empty" for the surfaces this file reasons about.
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => <div data-testid="demo-indicator" />,
}));
vi.mock("@/shared/components/DemoMode/DemoExportBlockedToast", () => ({
  DemoExportBlockedToast: () => <div data-testid="demo-toast" />,
}));
vi.mock("@/shared/components/Privacy/PrivacyOnboarding", () => ({
  PrivacyOnboarding: () => <div data-testid="privacy-onboarding" />,
}));
vi.mock("@/shared/components/Privacy/LegacyMigrationPrompt", () => ({
  LegacyMigrationPrompt: () => <div data-testid="legacy-migration-prompt" />,
}));
vi.mock("@/shared/components/Privacy/PiiLockedShell", () => ({
  PiiLockedShell: () => <div data-testid="pii-locked-shell" />,
}));

import App from "./App";

/** The four pieces of chrome Focus Mode is supposed to take away. */
interface Chrome {
  header: Element | null;
  subHeader: Element | null;
  sidebar: Element | null;
  dock: HTMLElement | null;
}

function chrome(container: HTMLElement): Chrome {
  const header = container.querySelector("header");
  return {
    header,
    // `StudioSubHeader` is rendered immediately after `StudioHeader`.
    subHeader: header?.nextElementSibling ?? null,
    sidebar: container.querySelector("aside"),
    // The dock's focus pill; the sub-header's twin is titled
    // "Alternar Modo Foco", so an exact title match cannot hit both.
    dock: screen.queryByTitle("Modo Foco"),
  };
}

function renderApp(): HTMLElement {
  const { container } = render((<App />) as ReactElement);
  return container;
}

function enterFocusMode(): void {
  fireEvent.keyDown(window, { key: "f" });
}

afterEach(() => {
  useNavigationPrefsStore.setState(defaultNavigationPrefs());
});

describe("web App — Focus Mode chrome", () => {
  it("shows the Studio header, sub-header, sidebar and dock when the mode is off", () => {
    const container = renderApp();
    const { header, subHeader, sidebar, dock } = chrome(container);

    expect(header).not.toBeNull();
    expect(subHeader).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(dock).not.toBeNull();
  });

  it("takes all four away when the mode is on", () => {
    const container = renderApp();

    enterFocusMode();

    const after = chrome(container);
    expect(after.header).toBeNull();
    expect(after.subHeader).toBeNull();
    expect(after.sidebar).toBeNull();
    expect(after.dock).toBeNull();
  });

  it("brings all four back when the mode ends", () => {
    const container = renderApp();
    enterFocusMode();

    fireEvent.keyDown(window, { key: "Escape" });

    const after = chrome(container);
    expect(after.header).not.toBeNull();
    expect(after.subHeader).not.toBeNull();
    expect(after.sidebar).not.toBeNull();
    expect(after.dock).not.toBeNull();
  });

  it("round-trips through the dock's own toggle", () => {
    // The dock is the only chrome that stays reachable once the mode is on via
    // its sibling trigger, so the on-screen control has to work too — not just
    // the keyboard.
    const container = renderApp();
    fireEvent.click(screen.getByTitle("Modo Foco"));
    expect(chrome(container).dock).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Modo Foco/ }));
    expect(chrome(container).dock).not.toBeNull();
  });

  it("keeps the demo export toast alive while taking the rest of the chrome block", () => {
    renderApp();

    enterFocusMode();

    // Everything the Studio mounts inside `{!focusMode && …}` goes with it: the
    // demo indicator and the three privacy surfaces are siblings of the header
    // in that block, not chrome that survives it.
    //
    // `DemoExportBlockedToast` is the one deliberate exception, and the
    // assertion below is the guarantee THIS PR (#262) delivers: the toast is
    // mounted OUTSIDE the `{!focusMode && …}` block in `StudioLayout`, so a
    // blocked export stays announced after the interface is stripped. Before
    // #262 the toast was chrome like its neighbours and this row could not
    // exist; #263 (the repair this branch is rebased onto) had to re-scope the
    // row for a tree where #262 was absent, which is why the assertion was
    // parked there. With #262 back on top it is valid again, so it is restored
    // rather than left to `StudioLayout.exportGuard.test.tsx` alone — that spec
    // covers it from the component side, this one from the chrome side.
    expect(screen.getByTestId("demo-toast")).toBeInTheDocument();
    expect(screen.queryByTestId("demo-indicator")).toBeNull();
    expect(screen.queryByTestId("privacy-onboarding")).toBeNull();
    expect(screen.queryByTestId("legacy-migration-prompt")).toBeNull();
    expect(screen.queryByTestId("pii-locked-shell")).toBeNull();
  });

  it("centres the workspace while the mode is on and drops the centring after", () => {
    const container = renderApp();
    const main = container.querySelector("main");

    expect(main).not.toBeNull();
    expect(main!.className).not.toContain("max-w-7xl");

    enterFocusMode();

    expect(main!.className).toContain("max-w-7xl");
    expect(main!.className).toContain("mx-auto");
  });

  it("offers a visible way out of the mode", () => {
    renderApp();
    enterFocusMode();

    // Escape is not discoverable; the banner's button is the affordance.
    fireEvent.click(screen.getByRole("button", { name: /Sair do Modo Foco/ }));
    expect(screen.queryByText(/Modo Foco Ativo/)).toBeNull();
  });

  it("keeps the mode out of the shared navigation store, in both directions", () => {
    // #260 gave the Studio its own focus state, which means the web App and
    // the shared preference store now disagree by design: `NavigationProvider`
    // is still mounted above the layout and still reads the store, but the
    // Studio does not. Both halves are asserted here so the divergence stays
    // deliberate — a future refactor that re-wires the Studio to the store has
    // to update this test rather than discover it in the UI.
    const container = renderApp();

    // Store on, Studio off: entering through the store changes nothing here.
    act(() => useNavigationPrefsStore.getState().enterFocusMode());
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    expect(chrome(container).sidebar).not.toBeNull();
    expect(screen.queryByText(/Modo Foco Ativo/)).toBeNull();

    // Studio on, then store off: leaving through the store does not put the
    // Studio's chrome back, because the Studio never joined the store.
    enterFocusMode();
    expect(screen.getByText(/Modo Foco Ativo/)).toBeInTheDocument();
    act(() => useNavigationPrefsStore.getState().exitFocusMode());
    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(screen.getByText(/Modo Foco Ativo/)).toBeInTheDocument();
  });
});
