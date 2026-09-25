import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

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
import { TABS } from "@/shared/components/AppShell/tabs";

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

  it("tablet sidebar renders one button per primary tab", () => {
    const { container } = render(<App />);

    const tabletSidebar = Array.from(container.querySelectorAll("aside")).find(
      (aside) =>
        aside.className.includes("md:flex") &&
        aside.className.includes("lg:hidden"),
    );

    expect(tabletSidebar).toBeDefined();
    expect(tabletSidebar!.querySelectorAll("button")).toHaveLength(TABS.length);
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

    expect(nav.querySelectorAll("button[aria-selected]")).toHaveLength(
      TABS.length,
    );
    // The gear (aria-haspopup="dialog") is web-only.
    expect(
      container.querySelector('button[aria-haspopup="dialog"]'),
    ).toBeNull();
  });

  it("switches surfaces when a tab is selected", () => {
    const { container } = render(<App />);

    // Calculator surface renders first (default tab).
    expect(screen.getByTestId("calculator-mock")).toBeInTheDocument();

    const desktopSidebar = Array.from(container.querySelectorAll("aside")).find(
      (aside) => aside.className.includes("hidden lg:flex"),
    )!;
    fireEvent.click(
      desktopSidebar.querySelectorAll("button")[1], // dashboard
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

      fireEvent.click(buttons[TABS.findIndex(({ id }) => id === "history")]);
      expect(screen.getByText("HistoryTab")).toBeInTheDocument();

      fireEvent.click(buttons[TABS.findIndex(({ id }) => id === "calculator")]);
      expect(screen.getByTestId("calculator-mock")).toBeInTheDocument();
      expect(localStorage.getItem(key)).toBe(persistedSettings);
    } finally {
      if (previousSettings === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previousSettings);
    }
  });

  it("keeps the go-products event connected to the shared navigation state", () => {
    render(<App />);
    const mainNavigation = screen.getByRole("navigation", {
      name: "nav.mainNavigation",
    });
    const productsButton =
      mainNavigation.querySelectorAll("button")[
        TABS.findIndex(({ id }) => id === "products")
      ];

    act(() => {
      window.dispatchEvent(new Event("open3dcalc:go-products"));
    });

    expect(productsButton).toHaveAttribute("aria-selected", "true");
  });
});
