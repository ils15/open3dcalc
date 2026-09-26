import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import manifestFixture from "../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

/**
 * Phase 7o s4 — the desktop shell's share of the Focus Mode chrome.
 *
 * The web App.focusMode test covers the same three conditionals; what is worth
 * proving separately here is the desktop-specific risk. The desktop App passes
 * its own `SidebarFooter` into the shared shell, and that footer is where the
 * real entry control lives on desktop — so if the mode ever stopped reaching
 * the shell, desktop would lose the only way in while web kept working.
 *
 * Unlike the web file this one does NOT mock `AppShell`: the sidebars (and
 * therefore the sidebar footer) are what the mode removes, so mocking the very
 * component that removes them would make the assertion test the mock. Only the
 * heavy surfaces and the desktop-only header are stubbed.
 */

vi.mock("@/platform/desktop/components/Header/Header", () => ({
  Header: () => <header data-testid="desktop-header" />,
}));
vi.mock(
  "@/platform/desktop/components/UpdateNotification/UpdateNotification",
  () => ({
    UpdateNotification: () => (
      <div data-testid="update-notification">UpdateNotification</div>
    ),
  }),
);
vi.mock("@/platform/desktop/hooks/useUpdaterAutoCheck", () => ({
  useUpdaterAutoCheck: vi.fn(),
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

// The tab → surface switch is not what this file is about.
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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

import App from "@/platform/desktop/App";

/** The sidebar footer's brand link — the desktop-only chrome under test. */
const GITHUB_LINK = 'a[href="https://github.com/ils15/open3dcalc"]';

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
  useNavigationPrefsStore.setState({
    ...defaultNavigationPrefs(),
    focusMode: false,
    focusModeReturnTab: null,
  });
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("desktop App — Focus Mode chrome", () => {
  it("shows the header, the mobile bar, the sidebar footer and the update notice", () => {
    const { container } = render(<App />);

    expect(screen.getByTestId("desktop-header")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "nav.mainNavigation" }),
    ).toBeInTheDocument();
    expect(container.querySelector(GITHUB_LINK)).toBeInTheDocument();
    expect(screen.getByTestId("update-notification")).toBeInTheDocument();
  });

  it("reaches the real entry control the sidebar footer renders", () => {
    // Proves the desktop path into Focus Mode is wired, not just the store:
    // the button under test is the one the desktop footer actually ships.
    render(<App />);

    const entry = screen.getByRole("button", { name: "focusMode.enter" });
    fireEvent.click(entry);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
  });

  it("takes the header, the mobile bar and the sidebar footer away", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));

    expect(screen.queryByTestId("desktop-header")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "nav.mainNavigation" }),
    ).toBeNull();
    // The footer lives inside the desktop sidebar, so no aside at all is the
    // honest way to say it is gone.
    expect(container.querySelectorAll("aside")).toHaveLength(0);
    expect(container.querySelector(GITHUB_LINK)).toBeNull();
  });

  it("keeps the update notice, the indicators, the banner and the tutorial", () => {
    // A pending desktop update must never be hidden by a focus state — same
    // reasoning as the web side, and the reason UpdateNotification stayed
    // outside the conditional in the App.
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));

    expect(screen.getByTestId("update-notification")).toBeInTheDocument();
    expect(screen.getByTestId("demo-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("demo-toast")).toBeInTheDocument();
    expect(screen.getByTestId("privacy-banner")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial")).toBeInTheDocument();
  });

  it("leaves the calculator on screen and the exit bar reachable", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));

    expect(screen.getByTestId("surface-calculator")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "focusMode.exit" }),
    ).toBeInTheDocument();
  });

  it("brings the chrome back when the mode ends", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));
    fireEvent.click(screen.getByRole("button", { name: "focusMode.exit" }));

    expect(screen.getByTestId("desktop-header")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "nav.mainNavigation" }),
    ).toBeInTheDocument();
    expect(container.querySelector(GITHUB_LINK)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "focusMode.exit" })).toBeNull();
  });

  it("supplies a focus padding that drops the hidden bar's bottom reserve", () => {
    const { container } = render(<App />);
    const main = (): HTMLElement => container.querySelector("main")!;
    // pb-32 reserves room for the fixed mobile bar the mode unmounts.
    expect(main().className).toContain("pb-32");

    fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));

    expect(main().className).not.toContain("pb-32");
  });
});
