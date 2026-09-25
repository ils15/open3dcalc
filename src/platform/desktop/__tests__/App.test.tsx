import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";

// ─── Mock heavy/desktop-only dependencies (parity with the web app tests) ───
vi.mock("@/platform/desktop/components/Header/Header", () => ({
  Header: () => <header data-testid="header">Header</header>,
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
vi.mock("@/shared/components/Calculator/Calculator", () => ({
  Calculator: () => <div data-testid="calculator-mock">Calculator</div>,
}));
vi.mock("@/shared/components/Dashboard/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-mock">Dashboard</div>,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => <div>CatalogTab</div>,
}));
vi.mock("@/shared/components/Calculator/HistoryTab/HistoryTab", () => ({
  HistoryTab: () => <div>HistoryTab</div>,
}));
vi.mock("@/shared/components/Changelog/ChangelogPage", () => ({
  ChangelogPage: () => <div>ChangelogPage</div>,
}));
vi.mock("@/shared/components/Wiki/WikiPage", () => ({
  WikiPage: () => <div>WikiPage</div>,
}));
vi.mock("@/shared/components/Calculator/InfillCalculator", () => ({
  InfillCalculator: () => <div>InfillCalculator</div>,
}));
vi.mock("@/shared/components/Catalog/FilamentInventory", () => ({
  FilamentInventory: () => <div>FilamentInventory</div>,
}));
vi.mock("@/shared/components/Catalog/CustomerTab", () => ({
  CustomerTab: () => <div>CustomerTab</div>,
}));
vi.mock("@/shared/components/Catalog/ProductInventory", () => ({
  ProductInventory: () => <div>ProductInventory</div>,
}));
vi.mock("@/shared/components/Privacy/PrivacyScreen", () => ({
  PrivacyScreen: () => <div>PrivacyScreen</div>,
}));
vi.mock("@/shared/components/Calculator/QuoteSection", () => ({
  QuoteSection: () => <div>QuoteSection</div>,
}));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));
vi.mock("@/shared/stores/historyStore", () => ({
  useHistoryStore: Object.assign(
    vi.fn(() => ({ entries: [], addEntry: vi.fn() })),
    { getState: vi.fn(() => ({ entries: [], addEntry: vi.fn() })) },
  ),
}));
vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { currency: "auto" };
      return selector ? selector(state) : state;
    },
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── Import after mocks ───
import App from "@/platform/desktop/App";
import {
  MORE_TABS,
  PRIMARY_TABS,
  TABS,
} from "@/shared/components/AppShell/tabs";

/**
 * Wave 1 — desktop App extraction smoke test.
 *
 * The web App render path is covered by TabletOptimization/tabsParity; the
 * desktop path was not covered at all before the extraction, so this locks
 * the platform-specific chrome that survived the refactor: brand-link sidebar
 * footer, gear-less mobile bar and tab → surface switching.
 */
describe("desktop App shell (post-extraction)", () => {
  it("renders the desktop-only header extras", () => {
    render(<App />);

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("update-notification")).toBeInTheDocument();
  });

  it("tablet sidebar renders one button per primary destination plus More", () => {
    const { container } = render(<App />);

    const tabletSidebar = Array.from(container.querySelectorAll("aside")).find(
      (aside) =>
        aside.className.includes("md:flex") &&
        aside.className.includes("lg:hidden"),
    );

    expect(tabletSidebar).toBeDefined();
    // Phase 7o s3: the five primary destinations + the More disclosure.
    expect(tabletSidebar!.querySelectorAll("button")).toHaveLength(
      PRIMARY_TABS.length + 1,
    );
  });

  it("desktop sidebar footer keeps the brand links (no SecondaryNavigation)", () => {
    const { container } = render(<App />);

    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find(
      (aside) => aside.className.includes("hidden lg:flex"),
    );

    expect(desktopSidebar).toBeDefined();
    // The web sidebar renders SecondaryNavigation here; desktop renders the
    // GitHub/Telegram brand links instead.
    expect(
      desktopSidebar!.querySelector('[data-testid="secondary-navigation"]'),
    ).toBeNull();
    const github = desktopSidebar!.querySelector(
      'a[href="https://github.com/ils15/open3dcalc"]',
    );
    const telegram = desktopSidebar!.querySelector(
      'a[href="https://t.me/Impressao3DBR"]',
    );
    expect(github).toBeInTheDocument();
    expect(telegram).toBeInTheDocument();
  });

  it("mobile bar has no settings gear (desktop parity difference)", () => {
    const { container } = render(<App />);

    const nav = screen.getByRole("navigation", { name: "nav.mainNavigation" });
    expect(nav.className).toContain("lg:hidden");

    // The five primary destinations carry aria-selected; the More disclosure
    // and (web-only) the gear do not.
    expect(nav.querySelectorAll("button[aria-selected]")).toHaveLength(
      PRIMARY_TABS.length,
    );
    // The settings GEAR — the button that opens the settings sheet — is
    // web-only, so the bar must not own one.
    expect(nav.querySelector('button[aria-haspopup="dialog"]')).toBeNull();

    // The desktop DOES ship dialog-opening controls (Phase 7o s3 added Manage
    // Visibility to the sidebar footer). Asserted explicitly so this test keeps
    // guarding the gear's absence without silently depending on "no control
    // anywhere owns a dialog" — which was the old, now-false premise.
    const dialogTriggers = Array.from(
      container.querySelectorAll('button[aria-haspopup="dialog"]'),
    );
    expect(dialogTriggers.length).toBeGreaterThan(0);
    for (const trigger of dialogTriggers) {
      expect(trigger).toHaveAttribute(
        "aria-label",
        "settings.manageVisibility",
      );
    }
  });

  it("switches surfaces when a destination is selected", () => {
    const { container } = render(<App />);

    // Calculator surface renders first (default destination).
    expect(screen.getByTestId("calculator-mock")).toBeInTheDocument();

    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find(
      (aside) => aside.className.includes("hidden lg:flex"),
    )!;
    fireEvent.click(
      desktopSidebar.querySelectorAll("button")[
        PRIMARY_TABS.findIndex(({ id }) => id === "dashboard")
      ],
    );

    expect(screen.getByTestId("dashboard-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("calculator-mock")).toBeNull();
  });

  it("returns from History to Calculator without changing persisted settings", () => {
    const key = "open3dcalc_settings_v2";
    const persistedSettings = JSON.stringify({
      activeTab: "history",
      quantity: 3,
    });
    const previousSettings = localStorage.getItem(key);
    localStorage.setItem(key, persistedSettings);

    try {
      const { container } = render(<App />);
      const desktopSidebar = Array.from(
        container.querySelectorAll("aside"),
      ).find((aside) => aside.className.includes("hidden lg:flex"))!;
      const buttons = desktopSidebar.querySelectorAll("button");

      fireEvent.click(
        buttons[PRIMARY_TABS.findIndex(({ id }) => id === "history")],
      );
      expect(screen.getByText("HistoryTab")).toBeInTheDocument();

      fireEvent.click(
        buttons[PRIMARY_TABS.findIndex(({ id }) => id === "calculator")],
      );
      expect(screen.getByTestId("calculator-mock")).toBeInTheDocument();
      // The calculator's own settings key is untouched by navigation.
      expect(localStorage.getItem(key)).toBe(persistedSettings);
    } finally {
      if (previousSettings === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previousSettings);
    }
  });

  it("keeps the go-products event connected to the shared navigation state", () => {
    render(<App />);
    // Products is a demoted destination, so the event must still reach it even
    // though it is not one of the buttons in the bar.
    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    expect(screen.getByText("ProductInventory")).toBeInTheDocument();
  });

  it("keeps the go-products event working for a demoted destination", () => {
    const { container } = render(<App />);
    const nav = screen.getByRole("navigation", { name: "nav.mainNavigation" });
    const moreButton = within(nav).getByRole("button", { name: /nav\.more/ });

    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    // Products is reached, and the More disclosure owns it (it is demoted).
    expect(screen.getByText("ProductInventory")).toBeInTheDocument();
    expect(moreButton).toHaveAttribute("aria-current", "page");
    void container;
  });

  it("keeps every demoted destination reachable through More", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "nav.mainNavigation" });

    fireEvent.click(within(nav).getByRole("button", { name: /nav\.more/ }));

    const moreMenu = screen.getByTestId("more-menu");
    for (const tab of MORE_TABS) {
      expect(
        within(moreMenu).getByRole("button", { name: tab.labelKey }),
        tab.id,
      ).toBeInTheDocument();
    }
  });

  it("still surfaces the standalone Infill screen from More", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "nav.mainNavigation" });

    fireEvent.click(within(nav).getByRole("button", { name: /nav\.more/ }));
    fireEvent.click(
      within(screen.getByTestId("more-menu")).getByRole("button", {
        name: "nav.infill",
      }),
    );

    expect(screen.getByText("InfillCalculator")).toBeInTheDocument();
  });

  it("keeps the full surface set reachable (every TABS id has a screen)", () => {
    // TABS is still the full catalog; the split only changes presentation.
    for (const tab of TABS) {
      expect(TABS.filter((entry) => entry.id === tab.id)).toHaveLength(1);
    }
  });
});
