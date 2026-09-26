import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * Phase 7o s4 — the web shell's share of the Focus Mode chrome.
 *
 * The shared AppShell suite proves the sidebars and the exit behave; this file
 * covers what only the WEB App body decides: the header, the mobile bottom bar
 * and the footer. They are stubbed with test ids rather than rendered for real
 * so the assertion is about the App's own conditionals and not about a header
 * full of portals — the same approach App.navigation.test already takes.
 *
 * The mode is driven through the store, which is the single source of truth the
 * App's provider subscribes to, so these tests exercise the real wiring without
 * duplicating the entry control's own suite.
 */

vi.mock("@/shared/components/Header/Header", () => ({
  Header: () => <header data-testid="web-header" />,
}));
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => <div data-testid="demo-indicator" />,
}));
vi.mock("@/shared/components/DemoMode/DemoExportBlockedToast", () => ({
  DemoExportBlockedToast: () => <div data-testid="demo-toast" />,
}));
vi.mock("@/shared/components/ui/PrivacyBanner", () => ({
  PrivacyBanner: () => <div data-testid="privacy-banner" />,
}));
vi.mock("@/shared/components/ui/Tutorial", () => ({
  Tutorial: () => <div data-testid="tutorial" />,
}));
vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/components/AppShell/AppShell", () => ({
  AppShell: ({
    activeTab,
    mainClassName,
    mainFocusClassName,
  }: {
    activeTab: Tab;
    mainClassName: string;
    mainFocusClassName?: string;
  }): React.ReactElement => (
    <main data-testid="app-shell-main">
      <output aria-label="active tab">{activeTab}</output>
      <span data-testid="normal-padding">{mainClassName}</span>
      <span data-testid="focus-padding">{mainFocusClassName ?? ""}</span>
    </main>
  ),
}));
vi.mock("./SecondaryNavigation", () => ({
  SecondaryNavigation: () => null,
}));
vi.mock("./components/MobileNav", () => ({
  MobileNav: () => <nav data-testid="web-mobile-nav" />,
}));
vi.mock("./components/Footer", () => ({
  Footer: () => <footer data-testid="web-footer" />,
}));

import App from "./App";

function renderApp(): void {
  useNavigationPrefsStore.setState({
    ...defaultNavigationPrefs(),
    focusMode: false,
    focusModeReturnTab: null,
  });
  render(<App />);
}

function enterFocusMode(): void {
  act(() => useNavigationPrefsStore.getState().enterFocusMode());
}

describe("web App — Focus Mode chrome", () => {
  it("shows the header, the mobile bar and the footer when the mode is off", () => {
    renderApp();

    expect(screen.getByTestId("web-header")).toBeInTheDocument();
    expect(screen.getByTestId("web-mobile-nav")).toBeInTheDocument();
    expect(screen.getByTestId("web-footer")).toBeInTheDocument();
  });

  it("takes the header, the mobile bar and the footer away when the mode is on", () => {
    renderApp();

    enterFocusMode();

    expect(screen.queryByTestId("web-header")).toBeNull();
    expect(screen.queryByTestId("web-mobile-nav")).toBeNull();
    expect(screen.queryByTestId("web-footer")).toBeNull();
  });

  it("brings all three back when the mode ends", () => {
    renderApp();
    enterFocusMode();

    act(() => useNavigationPrefsStore.getState().exitFocusMode());

    expect(screen.getByTestId("web-header")).toBeInTheDocument();
    expect(screen.getByTestId("web-mobile-nav")).toBeInTheDocument();
    expect(screen.getByTestId("web-footer")).toBeInTheDocument();
  });

  it("keeps the indicators, the consent banner and the tutorial mounted", () => {
    // These are not chrome. A pending consent or an in-progress tour must not
    // be hidden by a focus state, and the tutorial is also the one layer that
    // owns the Escape key Focus Mode deliberately yields to.
    renderApp();

    enterFocusMode();

    expect(screen.getByTestId("demo-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("demo-toast")).toBeInTheDocument();
    expect(screen.getByTestId("privacy-banner")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial")).toBeInTheDocument();
  });

  it("supplies a focus padding that drops the hidden bar's bottom reserve", () => {
    renderApp();
    // The normal padding reserves room for the fixed mobile bar (pb-32) that
    // Focus Mode unmounts; leaving it in place would be a screen of whitespace.
    expect(screen.getByTestId("normal-padding")).toHaveTextContent("pb-32");

    enterFocusMode();

    const focusPadding = screen.getByTestId("focus-padding").textContent ?? "";
    expect(focusPadding).not.toBe("");
    expect(focusPadding).not.toContain("pb-32");
  });
});
