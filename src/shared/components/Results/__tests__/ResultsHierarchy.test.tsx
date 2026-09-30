import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import i18n from "@/shared/i18n/i18n";
import { ResultsPanel } from "../ResultsPanel";
import { BREAKPOINT_2XL } from "@/shared/hooks/useMediaQuery";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import type { CalculationResult } from "@/shared/types";

vi.mock("@/shared/components/Calculator/MaterialComparison", () => ({
  MaterialComparison: () => <div data-testid="material-comparison" />,
}));

vi.mock("@/shared/components/Dashboard/RechartsLazy", () => ({
  PieChart: ({ children }: { children?: ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

const result: CalculationResult = {
  materialCost: 10,
  energyCost: 2,
  machineCost: 3,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 20,
  softwareCost: 1,
  failureCost: 4,
  extrasCost: 2,
  postProcessingCost: 0,
  subtotal: 40,
  totalCost: 60,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.1,
  costPerUnit: 60,
  unitWeight: 85,
  estimatedPrintTime: 5,
  targetMarginPercent: 50,
  breakEvenPrice: 60,
  actualMargin: 28.33,
  carbonFootprintGrams: 100,
  profitPerHour: 6,
  totalHoursForProfit: 5,
};

// The global setup (src/shared/test/setup.ts) pins every media query to
// `false`. ResultsPanel now mirrors the `2xl` CSS with useMediaQuery, so this
// suite answers `(min-width: 1536px)` explicitly — defaulting to `true`, which
// is the width the sidebar chart-view assertions below were written against.
// Individual tests flip `at2xl` before rendering; the stub reads it lazily.
let at2xl = true;

function stubMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === BREAKPOINT_2XL ? at2xl : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(async () => {
  at2xl = true;
  stubMatchMedia();
  await i18n.changeLanguage("pt-BR");
  localStorage.clear();
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName: "Peça",
    results: result,
    calculationIssues: [],
    fdmSales: {
      packagingCost: 0,
      shippingCost: 0,
      taxPercent: 10,
      marketplaceFeePercent: 5,
      profitMarginPercent: 50,
      volumeDiscounts: [],
    },
  });
  useFilamentInventory.setState({
    spools: [
      {
        id: "spool-1",
        brand: "Marca",
        material: "PLA",
        color: "Azul",
        colorHex: "#000000",
        weightGrams: 500,
        originalWeightGrams: 500,
        costPerKg: 100,
        diameterMm: 1.75,
        dateAdded: 1,
        notes: "",
        status: "in_stock",
        purchaseStore: "",
      },
    ],
  });
});

describe("ResultsPanel hierarchy", () => {
  it("keeps response, cost, diagnostics and actions in semantic order", () => {
    render(<ResultsPanel variant="sidebar" />);

    const hierarchy = screen.getByTestId("results-hierarchy");
    const order = Array.from(hierarchy.children).map((child) =>
      child.getAttribute("data-testid"),
    );

    expect(order).toEqual([
      "price-hero",
      "profit-summary",
      "cost-distribution-card",
      "diagnostic-details",
      "results-actions",
    ]);
  });

  it("keeps the calculation error as the first hierarchy child", () => {
    useCalculatorStore.setState({
      results: null,
      calculationIssues: [
        {
          path: "fdmMaterial.density",
          reason: "non_finite",
          received: Number.NaN,
        },
      ],
    });

    render(<ResultsPanel variant="sidebar" />);

    const hierarchy = screen.getByTestId("results-hierarchy");
    expect(hierarchy.firstElementChild).toHaveAttribute(
      "data-testid",
      "calculation-error",
    );
  });

  it("keeps compact distribution outside the native granular disclosure", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="sidebar" />);

    const compact = screen.getByTestId("cost-distribution-compact");
    const details = screen.getByTestId("cost-distribution-details");
    const summary = details.querySelector("summary");

    expect(details.contains(compact)).toBe(false);
    // Without an explicit sidebarMode the card is in its bars presentation, so
    // this disclosure carries the `hidden` class — a display:none host. The
    // donut therefore must not be mounted at all here: a ResponsiveContainer
    // inside it measures 0×0 (measured as cause C: bars view at 1920 went from
    // 4 to 6 Recharts warnings). jsdom cannot observe that warning, so the
    // structural invariant is what the assertion pins.
    expect(details.querySelector("[data-testid='pie-chart']")).toBeNull();
    expect(summary).not.toHaveAttribute("role");
    expect(summary).not.toHaveAttribute("tabindex");
    expect(summary).not.toHaveAttribute("aria-expanded");

    summary?.focus();
    expect(summary).toHaveFocus();
    // Native summary activation is browser-owned; jsdom does not implement its
    // default Enter/Space toggle, so the click exercises the same disclosure.
    await user.click(summary as HTMLElement);

    expect(details).toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("keeps compact distribution visible in the sidebar actions tab", () => {
    render(
      <ResultsPanel
        variant="sidebar"
        sidebarMode="tabs"
        sidebarTab="actions"
      />,
    );

    expect(screen.getByTestId("cost-distribution-compact")).toBeInTheDocument();
    expect(screen.getByTestId("results-actions")).toBeInTheDocument();
    expect(screen.getByTestId("action-group-inventory")).toBeInTheDocument();
  });

  it("includes material in the compact bars view", () => {
    render(
      <ResultsPanel
        variant="sidebar"
        sidebarMode="compact"
        compactView="bars"
      />,
    );

    expect(screen.getByTestId("compact-cost-bars")).toBeInTheDocument();
    expect(screen.getByTestId("compact-cost-bar-filament")).toHaveTextContent(
      "Material",
    );
  });

  // ── isSidebar={!showChart}: the donut and the bars are mutually exclusive ──
  // The tag shipped this semantic untested. CostBreakdownCard renders
  // CostDistributionBars itself whenever isSidebar is set, so the sidebar must
  // not also render a second bar list; getByTestId (singular) is the guard.
  it("suppresses the donut and renders exactly one bar list in the bars view", () => {
    render(
      <ResultsPanel
        variant="sidebar"
        sidebarMode="compact"
        compactView="bars"
      />,
    );

    // Single bar list, not one per composition.
    expect(screen.getAllByTestId("compact-cost-bars")).toHaveLength(1);
    // The donut lives inside the disclosure that isSidebar hides.
    expect(screen.getByTestId("cost-distribution-details")).toHaveClass(
      "hidden",
    );
  });

  it("shows the donut disclosure and no bar list in the chart view", () => {
    render(
      <ResultsPanel
        variant="sidebar"
        sidebarMode="compact"
        compactView="chart"
      />,
    );

    expect(screen.queryByTestId("compact-cost-bars")).not.toBeInTheDocument();
    expect(screen.getByTestId("cost-distribution-details")).not.toHaveClass(
      "hidden",
    );
    // The donut is still mounted, just inside the disclosure.
    expect(
      screen
        .getByTestId("cost-distribution-details")
        .querySelector("[data-testid='pie-chart']"),
    ).not.toBeNull();
  });

  // ── The donut must never mount into a host the CSS hides (causes A, B, C) ──
  // jsdom cannot observe the Recharts warning itself: getBoundingClientRect()
  // returns 0×0 for a visible element and for a display:none one alike, so the
  // console warning is untestable here. These three guard the structural
  // invariant that produces it instead — while a surface is CSS-hidden, its
  // ResponsiveContainer must not exist at all.
  it("keeps the donut out of the mobile panel once the 2xl wrapper hides it", () => {
    at2xl = true;
    render(<ResultsPanel variant="mobile" />);

    expect(screen.getByTestId("cost-distribution-details")).toBeInTheDocument();
    expect(screen.queryByTestId("pie-chart")).toBeNull();
  });

  it("keeps the donut out of the sidebar panel below 2xl", () => {
    at2xl = false;
    render(
      <ResultsPanel
        variant="sidebar"
        sidebarMode="compact"
        compactView="chart"
      />,
    );

    expect(screen.getByTestId("cost-distribution-details")).toBeInTheDocument();
    expect(screen.queryByTestId("pie-chart")).toBeNull();
  });

  it("keeps the donut out of the bars view, whose host is display:none", () => {
    render(
      <ResultsPanel
        variant="sidebar"
        sidebarMode="compact"
        compactView="bars"
      />,
    );

    expect(screen.getByTestId("cost-distribution-details")).toHaveClass(
      "hidden",
    );
    expect(screen.queryByTestId("pie-chart")).toBeNull();
  });

  it("sticks the actions to the bottom in dock mode", () => {
    render(<ResultsPanel variant="sidebar" sidebarMode="dock" />);

    // Dock is the only mode that wraps the actions so they stay reachable
    // while the panel scrolls.
    const wrapper = screen.getByTestId("results-actions").parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain("sticky");
    expect(wrapper?.className).toContain("bottom-0");
  });

  it("gives compact and expanded modes their own vertical rhythm", () => {
    const { unmount } = render(
      <ResultsPanel variant="sidebar" sidebarMode="compact" />,
    );
    expect(screen.getByTestId("results-hierarchy")).toHaveClass("space-y-3");
    unmount();

    const expanded = render(
      <ResultsPanel variant="sidebar" sidebarMode="expanded" />,
    );
    expect(screen.getByTestId("results-hierarchy")).toHaveClass("space-y-6");
    expanded.unmount();

    render(<ResultsPanel variant="sidebar" sidebarMode="tabs" />);
    expect(screen.getByTestId("results-hierarchy")).toHaveClass("space-y-4");
  });

  it("keeps non-sidebar surfaces on the donut regardless of the sidebar view", () => {
    render(
      <ResultsPanel
        variant="mobile"
        sidebarMode="compact"
        compactView="bars"
      />,
    );

    expect(screen.queryByTestId("compact-cost-bars")).not.toBeInTheDocument();
    expect(screen.getByTestId("cost-distribution-details")).not.toHaveClass(
      "hidden",
    );
  });

  it("groups actions and describes the isolated stock mutation", () => {
    render(<ResultsPanel variant="sidebar" />);

    expect(
      screen.getByRole("heading", { name: "Salvar e cadastrar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Exportar e compartilhar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Estoque" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("action-group-inventory")).toHaveClass(
      "border-t-4",
    );

    const stockButton = screen.getByRole("button", {
      name: "Deduzir do Estoque",
    });
    expect(stockButton).toHaveTextContent("85.0g");
    expect(stockButton).toHaveAccessibleDescription(/85.0g/);
  });
});
