import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

// ─── Mock all heavy dependencies ───
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
  Calculator: () => <div data-testid="calculator-mock">Calculator</div>,
}));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));
// Applies the selector, like the calculatorStore mock below. Returning the bare
// store object made `useHistoryStore(s => s.entries)` yield the store rather than
// the array, so consumers calling `entries.reduce(...)` threw.
vi.mock("@/shared/stores/historyStore", () => {
  const state = { entries: [], addEntry: vi.fn() };
  return {
    useHistoryStore: Object.assign(
      vi.fn((selector?: (s: typeof state) => unknown) =>
        selector ? selector(state) : state,
      ),
      { getState: vi.fn(() => state) },
    ),
  };
});
vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: vi.fn(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        activeTab: "fdm",
        currency: "auto",
        fdmMaterial: {},
        fdmPrintParams: {},
        fdmMachine: {},
        fdmHardware: {},
        fdmFinishing: {},
        fdmLabor: {},
        fdmExtras: {},
        fdmSales: {},
        fdmOps: {},
        fdmSoft: {},
        resinMaterial: {},
        resinPrintParams: {},
        resinPostProcess: {},
        resinMachine: {},
        resinHardware: {},
        resinLabor: {},
        resinExtras: {},
        resinSales: {},
        resinOps: {},
        resinSoft: {},
        selectedPrinter: {},
        selectedMarketplace: {},
        fdmAmsEnabled: false,
        fdmAmsSlots: [],
        productName: "",
        quantity: 1,
        infillPercent: 20,
        targetMarginMode: "manual",
        enabledSections: {},
      };
      return selector ? selector(state) : state;
    },
  ),
}));

// ─── Import after mocks ───
import App from "../App";
import { TABS } from "@/platform/web/App";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * The web App's sidebar, after the Studio layout refactor (#260).
 *
 * `App.tsx` now renders `StudioLayout` alone, so the `<aside hidden
 * md:flex lg:hidden>` that this suite used to find no longer exists in the web
 * tree: that breakpoint ladder is `AppShell`'s `TabletSidebar`, which #260 left
 * on the desktop shell only and which is already covered where it lives —
 * `AppShell/__tests__/sidebarGroups.test.tsx` (icon-only, `w-16`),
 * `primaryNavigation.test.tsx` (button count, accessible names) and
 * `sidebarLandmarks.test.tsx` (landmark names).
 *
 * The web App kept a compact icon rail under a new rule: `StudioSidebar`
 * collapses below 1280px instead of swapping in a third sidebar at `md`. That
 * is what 2.1 now verifies — an icon-only rail that stays nameable, and the
 * resources hub that 2.3 used to assert against the removed
 * `SecondaryNavigation`.
 */

const DEFAULT_WIDTH = 1024;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

afterEach(() => {
  setViewportWidth(DEFAULT_WIDTH);
});

/** The rail, and its two navs: the module destinations, then the resources. */
function rail(container: HTMLElement): {
  aside: Element;
  modules: HTMLElement;
  resources: HTMLElement;
} {
  const aside = container.querySelector("aside");
  if (!aside) throw new Error("the web App rendered no sidebar <aside>");
  const [modules, resources] = Array.from(aside.querySelectorAll("nav"));
  if (!modules || !resources) {
    throw new Error("the rail is missing its modules or resources nav");
  }
  return { aside, modules, resources };
}

describe("Phase 2 — Tablet Optimization", () => {
  describe("2.1 Compact icon rail in the web App", () => {
    it("collapses the sidebar to an icon-only rail below 1280px", () => {
      setViewportWidth(DEFAULT_WIDTH); // 1024 < 1280
      const { container } = render(<App />);

      const { aside, modules } = rail(container);
      // Width is pinned by layout, so the module labels cannot survive here.
      expect(aside.className).toContain("w-16");
      expect(modules.textContent).not.toContain("Calculadora");
    });

    it("keeps every rail destination reachable by its accessible name", () => {
      setViewportWidth(DEFAULT_WIDTH);
      const { container } = render(<App />);

      // The icon-only rail carries no text, so `title` is what names each
      // button for a screen reader and for a pointer user.
      const { modules } = rail(container);
      const buttons = Array.from(modules.querySelectorAll("button"));
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute("title");
      });
    });

    it("renders one rail destination per shared tab contract entry", () => {
      setViewportWidth(DEFAULT_WIDTH);
      const { container } = render(<App />);

      const { modules } = rail(container);
      // The rail is the Studio's own presentation of the shared catalog: a
      // destination that is missing here is a destination with no entry point.
      expect(modules.querySelectorAll("button")).toHaveLength(TABS.length);
    });

    it("routes the Marketplace sidebar destination to the browse-only catalog", async () => {
      setViewportWidth(DEFAULT_WIDTH);
      const { container } = render(<App />);
      const marketplaceButton = container.querySelector<HTMLButtonElement>(
        'button[title="Marketplace"]',
      );

      expect(marketplaceButton).not.toBeNull();
      fireEvent.click(marketplaceButton!);
      await waitFor(() =>
        expect(
          container.querySelector("#marketplace-printers-heading"),
        ).not.toBeNull(),
      );
    });

    it("expands to the labelled rail on wide screens", () => {
      setViewportWidth(1600);
      const { container } = render(<App />);

      const { aside, modules } = rail(container);
      expect(aside.className).toContain("w-56");
      expect(modules.textContent).toContain("Calculadora");
    });

    it("collapses again when the window shrinks past the breakpoint", () => {
      setViewportWidth(1600);
      const { container } = render(<App />);
      expect(rail(container).aside.className).toContain("w-56");

      setViewportWidth(DEFAULT_WIDTH);
      fireEvent(window, new Event("resize"));

      expect(rail(container).aside.className).toContain("w-16");
    });
  });

  describe("2.3 Secondary navigation links", () => {
    it("keeps the resource destinations in one hub inside the rail", () => {
      setViewportWidth(DEFAULT_WIDTH);
      const { container } = render(<App />);

      const { resources } = rail(container);
      for (const label of [
        "Documentação / Wiki",
        "Notas de Versão",
        "Código no GitHub",
        "Comunidade Telegram",
      ]) {
        expect(resources.querySelector(`[title="${label}"]`)).not.toBeNull();
      }
    });

    it("splits the hub into internal destinations and external links", () => {
      setViewportWidth(DEFAULT_WIDTH);
      const { container } = render(<App />);

      const { resources } = rail(container);
      // Wiki and Novidades stay inside the app; the community links leave it.
      expect(resources.querySelectorAll("button")).toHaveLength(2);
      expect(resources.querySelectorAll("a")).toHaveLength(2);
    });

    it("opens the external links in a new tab without leaking the opener", () => {
      setViewportWidth(DEFAULT_WIDTH);
      const { container } = render(<App />);

      const { resources } = rail(container);
      const externalLinks = resources.querySelectorAll('a[target="_blank"]');
      expect(externalLinks).toHaveLength(2);
      externalLinks.forEach((link) => {
        // `noreferrer` is the rail's contract here; it implies `noopener`, so
        // the new tab cannot reach back through `window.opener`.
        expect(link).toHaveAttribute("rel", "noreferrer");
      });
    });

    it("does not put secondary surfaces back in the primary tab array", () => {
      expect(TABS).toHaveLength(11);
      expect(TABS.map((tab) => tab.id)).not.toEqual(
        expect.arrayContaining(["wiki", "changelog"]),
      );
    });
  });

  describe("2.2 Responsive typography in index.css", () => {
    it("body font-size uses clamp() for fluid scaling", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const cssPath = path.resolve(__dirname, "../index.css");
      const css = await fs.readFile(cssPath, "utf-8");

      // Find the body rule and check for clamp
      expect(css).toMatch(/body\s*\{[^}]*font-size:\s*clamp\(/);
    });

    it("body font-size clamp starts at 0.9375rem (15px)", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const cssPath = path.resolve(__dirname, "../index.css");
      const css = await fs.readFile(cssPath, "utf-8");

      expect(css).toContain("clamp(0.9375rem");
    });

    it("body font-size clamp ends at 1.0625rem (17px)", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const cssPath = path.resolve(__dirname, "../index.css");
      const css = await fs.readFile(cssPath, "utf-8");

      expect(css).toContain("1.0625rem)");
    });
  });
});
