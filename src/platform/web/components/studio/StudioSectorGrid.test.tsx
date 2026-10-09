import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import App from "../../App";
import { useConsentStore } from "@/shared/stores/consentStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";

/**
 * Sector-grid lock for the Studio (PR #280, final iteration).
 *
 * The owner spec centralises the sector content grid like the Example
 * (`Example/src/components/BentoLayout.tsx:63` — `max-w-7xl mx-auto`):
 * every Studio view root carries margin-auto + max-width instead of an
 * unbounded `max-w-full`, so 1440px centres the column and 390px stays
 * fluid with no overflow. `BentoSurface` and `GuidedWizard` already follow
 * this rhythm (their own `mx-auto` containers); the eight Studio views and
 * the two inline StudioLayout wrappers (catalog, infill) were the outliers.
 *
 * Source-text assertions (not snapshots): they pin the layout contract the
 * way `studioShellTheme.test.ts` pins the colour contract. Behaviour tests
 * only — no snapshots.
 */
const srcRoot = resolve(__dirname, "../../../..");
const read = (p: string) => readFileSync(resolve(srcRoot, p), "utf-8");

/** Every Studio view whose root must follow the Example rhythm. */
const CENTERED_VIEWS: ReadonlyArray<string> = [
  "platform/web/components/studio/StudioDashboardView.tsx",
  "platform/web/components/studio/StudioSpoolView.tsx",
  "platform/web/components/studio/StudioHistoryView.tsx",
  "platform/web/components/studio/StudioCustomerView.tsx",
  "platform/web/components/studio/StudioQuotesView.tsx",
  "platform/web/components/studio/StudioProductsView.tsx",
  "platform/web/components/studio/StudioPrinterView.tsx",
  "platform/web/components/studio/StudioCalculatorView.tsx",
];

describe("Studio sector grid — centered like the Example", () => {
  it.each(CENTERED_VIEWS)(
    "%s centers its content grid (margin auto + max width)",
    (file) => {
      const source = read(file);
      expect(source).toMatch(/mx-auto/);
      expect(source).toMatch(/max-w-7xl/);
    },
  );

  it.each(CENTERED_VIEWS)("%s carries no unbounded max-w-full root", (file) => {
    expect(read(file)).not.toMatch(/max-w-full/);
  });

  it("StudioLayout centers the inline catalog and infill wrappers", () => {
    const layout = read("platform/web/components/studio/StudioLayout.tsx");
    expect(layout).toMatch(/max-w-7xl/);
    expect(layout).not.toMatch(/max-w-full/);
  });

  it("GuidedWizard h1 unifies with the views (text-xl, not text-2xl)", () => {
    const wizard = read("shared/components/Wizard/GuidedWizard.tsx");
    expect(wizard).not.toMatch(/text-2xl/);
    expect(wizard).toMatch(/text-xl/);
  });

  it("fonts.css carries no dead type tokens", () => {
    const fonts = read("styles/fonts.css");
    expect(fonts).not.toMatch(/--type-card-title/);
    expect(fonts).not.toMatch(/--type-section-title/);
  });

  describe("rendered calculator layout", () => {
    beforeEach(async () => {
      localStorage.clear();
      useLayoutStore.setState({ layoutMode: "classic" });
      await useConsentStore.getState().giveConsent();
    });

    it.each([390, 1440])(
      "renders a fluid, centered calculator grid at %i px",
      (width) => {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: width,
        });
        render(<App />);

        const title = screen.getByRole("heading", {
          name: "1. INSUMO & CONSUMO DE MATERIAL",
        });
        let grid: HTMLElement | null = title;
        while (
          grid &&
          !(
            grid.classList.contains("mx-auto") &&
            grid.classList.contains("max-w-7xl") &&
            grid.classList.contains("w-full")
          )
        ) {
          grid = grid.parentElement;
        }

        expect(grid).not.toBeNull();
        expect(grid).toHaveClass("mx-auto", "max-w-7xl", "w-full");
      },
    );
  });
});
