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
vi.mock("@/shared/components/SpoolShelf/SpoolShelf", () => ({
  SpoolShelf: () => <div>SpoolShelf</div>,
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
import {
  MORE_TABS,
  PRIMARY_TABS,
  holdsDemotedSurface,
} from "@/shared/components/AppShell/tabs";
import { MORE_TAB_IDS, PRIMARY_TAB_IDS } from "@/shared/lib/navigationPrefs";

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
  it("keeps all ten navigation surfaces in the tab contract", () => {
    expect(WEB_TABS.map((tab) => tab.id)).toEqual([
      "calculator",
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
    ]);
  });

  it("web TABS deep-equals desktop TABS (by id)", () => {
    expect(WEB_TABS.map(tabShape)).toEqual(DESKTOP_TABS.map(tabShape));
  });

  it("TABS deep-equals TUTORIAL_TABS", () => {
    const tutorialIds = [...TUTORIAL_TABS];

    expect(WEB_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
    expect(DESKTOP_TABS.map((tab) => tab.id)).toEqual(tutorialIds);
  });
});

/**
 * Phase 7o s3 — the primary/demoted split is part of the same contract, so it
 * is locked here too: both platforms must agree on WHICH surfaces are primary,
 * not merely on the full set. A drift here would give the two shells different
 * navigation bars, which is the regression the whole lock exists to prevent.
 */
describe("primary vs demoted parity", () => {
  it("splits into exactly the five primary destinations and five demoted", () => {
    expect(PRIMARY_TABS.map((tab) => tab.id)).toEqual([...PRIMARY_TAB_IDS]);
    expect(MORE_TABS.map((tab) => tab.id)).toEqual([...MORE_TAB_IDS]);
  });

  it("primary and demoted together reconstruct TABS exactly", () => {
    expect([...PRIMARY_TABS, ...MORE_TABS].map((tab) => tab.id)).toEqual(
      WEB_TABS.map((tab) => tab.id),
    );
  });

  it("agrees between web and desktop (the split is derived from shared TABS)", () => {
    const webIds = new Set(WEB_TABS.map((tab) => tab.id));
    const desktopIds = new Set(DESKTOP_TABS.map((tab) => tab.id));

    for (const id of PRIMARY_TAB_IDS) {
      expect(webIds.has(id), `primary ${id} on web`).toBe(true);
      expect(desktopIds.has(id), `primary ${id} on desktop`).toBe(true);
    }
    for (const id of MORE_TAB_IDS) {
      expect(webIds.has(id), `demoted ${id} on web`).toBe(true);
      expect(desktopIds.has(id), `demoted ${id} on desktop`).toBe(true);
    }
  });

  it("demotes Infill while keeping it in the surface set", () => {
    expect(holdsDemotedSurface("infill")).toBe(true);
    expect(MORE_TABS.some((tab) => tab.id === "infill")).toBe(true);
  });

  it("keeps every primary destination out of the demoted set", () => {
    for (const id of PRIMARY_TAB_IDS) {
      expect(holdsDemotedSurface(id), id).toBe(false);
    }
  });
});

describe("mobile bottom navigation", () => {
  it("renders the five primary destinations plus a More trigger", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "nav.mainNavigation",
    });
    // Destination buttons carry aria-selected; the settings gear and the More
    // disclosure do not.
    const destinationButtons = nav.querySelectorAll("button[aria-selected]");

    expect(destinationButtons).toHaveLength(PRIMARY_TABS.length);
    for (const tab of PRIMARY_TABS) {
      expect(nav.textContent).toContain(tab.labelKey);
    }

    const more = within(nav).getByRole("button", { name: /nav\.more/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps every demoted destination — including Infill — behind More", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "nav.mainNavigation",
    });
    for (const tab of MORE_TABS) {
      expect(nav.textContent, tab.id).not.toContain(tab.labelKey);
    }

    fireEvent.click(within(nav).getByRole("button", { name: /nav\.more/ }));

    for (const tab of MORE_TABS) {
      expect(
        within(screen.getByTestId("more-menu")).getByRole("button", {
          name: tab.labelKey,
        }),
        tab.id,
      ).toBeInTheDocument();
    }
  });

  it("keeps Wiki and Novidades in the footer hub", () => {
    render(<App />);

    const footer = screen.getByRole("navigation", {
      name: "footer.navigation",
    });
    expect(
      within(footer).getByRole("button", { name: "nav.wiki" }),
    ).toBeInTheDocument();
    expect(
      within(footer).getByRole("button", { name: "nav.changelog" }),
    ).toBeInTheDocument();
    expect(
      within(footer).getByRole("link", { name: "footer.github" }),
    ).toHaveAttribute("target", "_blank");
    expect(
      within(footer).getByRole("link", { name: "footer.telegram" }),
    ).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(within(footer).getByRole("button", { name: "nav.wiki" }));
    expect(screen.getByText("WikiPage")).toBeInTheDocument();

    fireEvent.click(
      within(footer).getByRole("button", { name: "nav.changelog" }),
    );
    expect(screen.getByText("ChangelogPage")).toBeInTheDocument();
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

    // …and no destination does.
    for (const tab of PRIMARY_TABS) {
      expect(within(sheet).queryByText(tab.labelKey)).toBeNull();
    }
  });
});
