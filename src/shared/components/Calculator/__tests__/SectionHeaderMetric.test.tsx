import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import i18n from "@/shared/i18n/i18n";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { createDefaultComputeInput } from "@/shared/stores/calculatorStore.validation";
import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";

vi.mock("@/shared/components/Results/ResultsPanel", () => ({
  ResultsPanel: () => <div data-testid="results-panel" />,
}));

import { SectionRenderer } from "../SectionRenderer";

const rendererProps = {
  t: (key: string) => i18n.t(key),
  currencySymbol: "R$",
  handleInput: vi.fn(),
  isFDM: true,
  showSpoolSelector: false,
  setShowSpoolSelector: vi.fn(),
  inventorySpools: [],
  catalogMaterials: [],
  catalogPrinters: [],
  handlePrinterSelect: vi.fn(),
};

/** Real calculation with a chosen print time / extras cost. */
function resultWith(overrides: {
  printTimeHours?: number;
  extrasCost?: number;
}) {
  const input = createDefaultComputeInput();
  input.fdmPrintParams = {
    ...input.fdmPrintParams,
    printTimeHours: overrides.printTimeHours ?? 5,
  };
  input.fdmExtras = {
    ...input.fdmExtras,
    extrasCost: overrides.extrasCost ?? 0,
  };
  // The compute input ships every section OFF while the live store defaults
  // them ON (calculatorStore.ts `enabledSections`); without this the filter in
  // computeStoreResults zeroes `extrasCost` and the fixture measures nothing.
  input.enabledSections = { ...input.enabledSections, extras: true };
  return computeStoreResults(input);
}

/** Every bordered heading row that carries a metric slot. */
function metricRows(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("div.border-b")).filter(
    (row) => row.querySelector("h2") && row.querySelector(".justify-between"),
  );
}

function headingRow(titleKey: string): Element | null | undefined {
  return screen
    .getByRole("heading", { level: 2, name: i18n.t(titleKey) })
    .closest("div.border-b");
}

/**
 * Anchored pattern for a rendered metric ("<label>: <value>"). The bare label
 * never appears alone (the metric is a single text node), and `exact: false`
 * is case-insensitive — it would sweep in the print-time tooltip ("Total time
 * the print takes…"), so the anchor on "<label>:" is what makes the count a
 * real guard.
 */
function metricPattern(key: "totalTime" | "totalExtras"): RegExp {
  return new RegExp(`^${i18n.t(`calc.sectionMetric.${key}`)}:`);
}

beforeEach(() => {
  useCalculatorStore.setState({
    calcLevel: "advanced",
    hiddenFields: [],
    results: null,
  });
});

describe("section header metrics (Example parity)", () => {
  it("shows the print-time total beside the print section title", () => {
    useCalculatorStore.setState({ results: resultWith({ printTimeHours: 5 }) });

    render(<SectionRenderer {...rendererProps} />);

    // Hours in, hours out: `estimatedPrintTime` is already in hours, so a
    // five-hour job reads 5.0 h rather than 5/60.
    expect(
      screen.getByText(`${i18n.t("calc.sectionMetric.totalTime")}: 5.0 h`),
    ).toBeInTheDocument();

    const printRow = headingRow("calc.printParams");
    expect(printRow?.querySelector(".justify-between")).toBeTruthy();
    expect(printRow).toHaveTextContent(
      `${i18n.t("calc.sectionMetric.totalTime")}: 5.0 h`,
    );
  });

  it("shows the extras total beside the sales section title", () => {
    useCalculatorStore.setState({
      results: resultWith({ printTimeHours: 5, extrasCost: 12 }),
    });

    render(<SectionRenderer {...rendererProps} />);

    const salesRow = headingRow("calc.sales");
    // The label comes from i18n; the amount is asserted as its digits because
    // jsdom resolves the language to en-US, so the shared formatter renders
    // "$12.00" here and "R$ 12.00" in the pt-BR UI (SalesSection.test covers
    // the symbol against a stubbed useCurrency).
    expect(salesRow).toHaveTextContent(
      `${i18n.t("calc.sectionMetric.totalExtras")}:`,
    );
    expect(salesRow).toHaveTextContent(/12\.00/);
  });

  it("keeps metrics off every other section", () => {
    useCalculatorStore.setState({
      results: resultWith({ printTimeHours: 5, extrasCost: 12 }),
    });

    const { container } = render(<SectionRenderer {...rendererProps} />);

    // Print (time) + sales (extras): exactly two of the ten sections.
    expect(metricRows(container)).toHaveLength(2);
    // The metric is one text node ("Total Time: 5.0 h"), so an exact match on
    // the bare label finds nothing while `exact: false` goes case-insensitive
    // and sweeps in the print-time tooltip ("Total time the print takes…").
    // Anchoring on "<label>:" selects the metric node only, in any locale.
    expect(screen.getAllByText(metricPattern("totalTime"))).toHaveLength(1);
    expect(screen.getAllByText(metricPattern("totalExtras"))).toHaveLength(1);
    for (const key of [
      "calc.material",
      "calc.machine",
      "calc.labor",
      "calc.opsSoftware",
      "calc.fixedCost.title",
      "calc.failure.title",
      "calc.fdmHardware",
    ]) {
      const row = headingRow(key);
      expect(row?.querySelector(".justify-between"), key).toBeFalsy();
    }
  });

  it("shows no metric before a result exists", () => {
    const { container } = render(<SectionRenderer {...rendererProps} />);

    // Anchored (see metricPattern): a bare-label query here would pass even
    // if a metric were rendered, because the label never stands alone.
    expect(
      screen.queryByText(metricPattern("totalTime")),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(metricPattern("totalExtras")),
    ).not.toBeInTheDocument();
    expect(metricRows(container)).toHaveLength(0);
  });
});
