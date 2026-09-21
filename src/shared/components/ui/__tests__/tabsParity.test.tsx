import { describe, it, expect, vi } from "vitest";
import type { ReactNode, ReactElement } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

// ─── Mock all heavy dependencies (same surface as TabletOptimization.test) ───
vi.mock("@/shared/components/Header/Header", () => ({
  Header: () => <header data-testid="header">Header</header>,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => <div>CatalogTab</div>,
}));
vi.mock("@/shared/components/Calculator/HistoryTab/HistoryTab", () => ({
  HistoryTab: () => <div>HistoryTab</div>,
}));
vi.mock("@/shared/components/Dashboard/Dashboard", () => ({
  Dashboard: () => <div>Dashboard</div>,
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
vi.mock("@/shared/components/Calculator/Calculator", () => ({
  Calculator: () => <div>Calculator</div>,
}));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));
vi.mock("@/shared/stores/historyStore", () => ({
  useHistoryStore: Object.assign(
    vi.fn(() => ({
      entries: [],
      addEntry: vi.fn(),
    })),
    {
      getState: vi.fn(() => ({
        entries: [],
        addEntry: vi.fn(),
      })),
    },
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

// Mock i18next — keys pass through so assertions can match on labelKey strings.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

// ─── Import after mocks ───
import { TABS as WEB_TABS } from "@/platform/web/App";
import App from "@/platform/web/App";
import { TABS as DESKTOP_TABS } from "@/platform/desktop/App";
import { TUTORIAL_TABS } from "@/shared/components/ui/tutorialTours";

type TabEntry = {
  id: string;
  icon: ReactNode;
  labelKey: string;
  label: string;
};

/**
 * Structural shape of a tab entry: id, i18n key, pt-BR fallback label and the
 * icon identity (lucide component reference + size class). Two TABS arrays that
 * agree on this shape render an identical navigation surface on both platforms.
 */
function tabShape(tab: TabEntry) {
  const icon = tab.icon as ReactElement<{ className?: string }>;
  return {
    id: tab.id,
    labelKey: tab.labelKey,
    label: tab.label,
    iconType: icon.type,
    iconClassName: icon.props.className,
  };
}

describe("tabs parity", () => {
  it("web TABS deep-equals desktop TABS (by id)", () => {
    expect(WEB_TABS.map(tabShape)).toEqual(DESKTOP_TABS.map(tabShape));
  });

  it("TABS deep-equals TUTORIAL_TABS", () => {
    const tutorialIds = [...TUTORIAL_TABS];

    expect(WEB_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
    expect(DESKTOP_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
  });
});

describe("mobile bottom navigation", () => {
  it("renders every tab by horizontal scroll — none buried behind a More menu", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "nav.mainNavigation",
    });
    // Tab buttons carry aria-selected; the settings gear does not.
    const tabButtons = nav.querySelectorAll("button[aria-selected]");

    expect(tabButtons).toHaveLength(WEB_TABS.length);
    for (const tab of WEB_TABS) {
      expect(nav.textContent).toContain(tab.labelKey);
    }
  });

  it("settings gear opens a sheet that holds settings only (no tabs)", () => {
    render(<App />);

    const gear = screen.getByRole("button", { name: "nav.settings" });
    expect(gear).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(gear);
    expect(gear).toHaveAttribute("aria-expanded", "true");

    const sheet = screen
      .getAllByRole("dialog")
      .find((dialog) => dialog.textContent?.includes("nav.tutorial"));
    expect(sheet).toBeDefined();
    if (!sheet) return;

    // Settings items live here…
    expect(within(sheet).getByText("nav.tutorial")).toBeInTheDocument();
    expect(within(sheet).getByText("settings.currency")).toBeInTheDocument();
    expect(within(sheet).getByText("nav.language")).toBeInTheDocument();

    // …and no tab does.
    for (const tab of WEB_TABS) {
      expect(within(sheet).queryByText(tab.labelKey)).toBeNull();
    }
  });
});
