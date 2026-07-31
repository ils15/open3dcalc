import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readRelative = (p: string) =>
  readFileSync(resolve(__dirname, p), "utf-8");

const calculatorSource = readRelative("../Calculator.tsx");
const rendererSource = readRelative("../SectionRenderer.tsx");
const resultsPanelSource = readRelative("../ResultsPanel.tsx");

/**
 * Tailwind v4 default breakpoints (min-width, px):
 * md 768 · lg 1024 · xl 1280 · 2xl 1536
 */
const tailwindBreakpoint = (width: number): string | null => {
  if (width >= 1536) return "2xl";
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  return null;
};

describe("Calculator — Complete-mode layout breakpoints", () => {
  describe("results sidebar only appears when there is enough space (2xl / ≥1536px)", () => {
    it("hides the sidebar below 2xl (hidden 2xl:flex) instead of xl", () => {
      expect(calculatorSource).toMatch(/hidden 2xl:flex/);
      expect(calculatorSource).not.toMatch(/hidden xl:flex/);
    });

    it("renders the results sidebar at the 2xl width (360px) without xl widths", () => {
      expect(calculatorSource).toMatch(/2xl:flex[^"]*w-\[360px\]/);
      expect(calculatorSource).not.toMatch(/xl:w-\[320px\]/);
      expect(calculatorSource).not.toMatch(/w-\[280px\]/);
    });

    it("guarantees the central form never shrinks below 560px in Complete mode", () => {
      expect(calculatorSource).toMatch(
        /flex-1 min-w-0 2xl:min-w-\[560px\] @container/,
      );
    });

    it("keeps the results section (mobile/tablet panel) visible up to 2xl", () => {
      // SectionRenderer wrapper
      expect(rendererSource).toMatch(/id="section-results"[^>]*2xl:hidden/);
      expect(rendererSource).not.toMatch(/scroll-mt-24 xl:hidden/);
      // ResultsPanel mobile variant wrapper
      expect(resultsPanelSource).toMatch(/space-y-4 2xl:hidden/);
      expect(resultsPanelSource).not.toMatch(/space-y-4 lg:hidden/);
    });
  });

  describe("breakpoint matrix (390 → 2000px)", () => {
    const matrix = [
      {
        width: 390,
        breakpoint: null,
        sidebar: "hidden",
        resultsSection: "visible",
      },
      {
        width: 768,
        breakpoint: "md",
        sidebar: "hidden",
        resultsSection: "visible",
      },
      {
        width: 1024,
        breakpoint: "lg",
        sidebar: "hidden",
        resultsSection: "visible",
      },
      {
        width: 1280,
        breakpoint: "xl",
        sidebar: "hidden",
        resultsSection: "visible",
      },
      {
        width: 1440,
        breakpoint: "xl",
        sidebar: "hidden",
        resultsSection: "visible",
      },
      {
        width: 1536,
        breakpoint: "2xl",
        sidebar: "visible",
        resultsSection: "hidden",
      },
      {
        width: 2000,
        breakpoint: "2xl",
        sidebar: "visible",
        resultsSection: "hidden",
      },
    ];

    it.each(matrix)("$width px → $breakpoint", ({ width, breakpoint }) => {
      expect(tailwindBreakpoint(width)).toBe(breakpoint);
    });

    it.each(matrix)(
      "at $width px the sidebar visibility matches the class contract",
      ({ width, sidebar, resultsSection }) => {
        const is2xl = tailwindBreakpoint(width) === "2xl";
        // Sidebar: `hidden` base + `2xl:flex` → visible only ≥1536
        expect(sidebar).toBe(is2xl ? "visible" : "hidden");
        // Inline results section: `2xl:hidden` → hidden only ≥1536
        expect(resultsSection).toBe(is2xl ? "hidden" : "visible");
        // Class-level contract
        expect(calculatorSource).toMatch(/hidden 2xl:flex/);
        expect(rendererSource).toMatch(/section-results[^>]*2xl:hidden/);
        expect(resultsPanelSource).toMatch(/space-y-4 2xl:hidden/);
      },
    );
  });
});
