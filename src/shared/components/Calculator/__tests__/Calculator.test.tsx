import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CALCULATOR_THREE_REGION_MIN_REM,
  hasCalculatorRailSpace,
} from "../Calculator.layout";

const readRelative = (p: string) =>
  readFileSync(resolve(__dirname, p), "utf-8");

const calculatorSource = readRelative("../Calculator.tsx");
const calculatorCssSource = readRelative("../Calculator.css");
const rendererSource = readRelative("../SectionRenderer.tsx");
const resultsPanelSource = readRelative("../../Results/ResultsPanel.tsx");
const resultsSidebarSource = readRelative("../../Results/ResultsSidebar.tsx");

describe("Calculator — effective-width results layout", () => {
  it("uses content minima rather than a viewport breakpoint", () => {
    expect(CALCULATOR_THREE_REGION_MIN_REM).toBe(58);
    expect(calculatorSource).toContain("new ResizeObserver");
    expect(calculatorSource).toContain("entry.contentRect.width");
    expect(calculatorCssSource).toContain("7rem minmax(32rem, 1fr) 18rem");
    expect(calculatorSource).not.toMatch(/2xl:grid-cols|w-\[336px\]/);
  });

  it("expands the calculator into free desktop width without clipping its left rail", () => {
    expect(calculatorSource).toContain('import "./Calculator.css"');
    expect(calculatorSource).toContain("calculator-viewport-measure");
    expect(calculatorCssSource).toContain("@media (min-width: 90rem)");
    expect(calculatorCssSource).toContain("width: min(144rem, 100%)");
    expect(calculatorCssSource).toContain("margin-inline: auto");
    expect(calculatorCssSource).toContain("max-width: 14ch");
    expect(calculatorCssSource).toContain(
      "grid-template-columns: 7rem minmax(32rem, 1fr) 28rem",
    );
    expect(calculatorCssSource).not.toContain("margin-inline-start: -");
    expect(calculatorCssSource).toContain("7rem minmax(32rem, 1fr) 18rem");
    expect(calculatorCssSource).not.toContain(
      "grid-template-columns: 8.125rem 33.8125rem 20.5625rem",
    );
  });

  it.each([
    { width: 927, rootFontSize: 16, expected: false },
    { width: 928, rootFontSize: 16, expected: true },
    { width: 1025, rootFontSize: 18, expected: false },
    { width: 1044, rootFontSize: 18, expected: true },
    { width: Number.NaN, rootFontSize: 16, expected: false },
  ])(
    "requires the region minimum for $width CSS px at $rootFontSize px/rem",
    ({ width, rootFontSize, expected }) => {
      expect(hasCalculatorRailSpace(width, rootFontSize)).toBe(expected);
    },
  );

  it("renders one results location and drops the hidden-chart media gate", () => {
    expect(calculatorSource.match(/<ResultsSidebar\b/g)).toHaveLength(1);
    expect(calculatorSource).toContain('id="section-results"');
    expect(resultsSidebarSource).toContain('presentation === "inline"');
    expect(rendererSource).not.toContain("ResultsPanel");
    expect(rendererSource).not.toContain("2xl:hidden");
    expect(resultsPanelSource).not.toContain("useMediaQuery");
    expect(resultsPanelSource).not.toContain("2xl:hidden");
  });

  it("preserves section anchors and printer selection wiring", () => {
    for (const id of [
      "section-material",
      "section-print",
      "section-failure",
      "section-machine",
      "section-fixedCost",
      "section-labor",
      "section-hardware",
      "section-ops",
      "section-sales",
    ]) {
      expect(rendererSource).toContain(`id="${id}"`);
    }
    expect(calculatorSource).toContain('id="section-results"');

    const handlerStart = calculatorSource.indexOf("handlePrinterSelect");
    const handlerEnd = calculatorSource.indexOf("handleInput", handlerStart);
    const handler = calculatorSource.slice(handlerStart, handlerEnd);
    expect(handler).toContain("setSelectedPrinter");
    expect(handler).not.toMatch(/setFdmPrintParams|setFdmMachine/);
  });
});
