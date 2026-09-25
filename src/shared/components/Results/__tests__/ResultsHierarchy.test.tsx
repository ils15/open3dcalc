import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import i18n from "@/shared/i18n/i18n";
import { ResultsPanel } from "../ResultsPanel";
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

beforeEach(async () => {
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
        { path: "fdmMaterial.density", reason: "non_finite", received: Number.NaN },
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
    expect(details.querySelector("[data-testid='pie-chart']")).not.toBeNull();
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
    render(<ResultsPanel variant="sidebar" sidebarMode="tabs" sidebarTab="actions" />);

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

  it("groups actions and describes the isolated stock mutation", () => {
    render(<ResultsPanel variant="sidebar" />);

    expect(screen.getByRole("heading", { name: "Salvar e cadastrar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Exportar e compartilhar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estoque" })).toBeInTheDocument();
    expect(screen.getByTestId("action-group-inventory")).toHaveClass("border-t-4");

    const stockButton = screen.getByRole("button", {
      name: "Deduzir do Estoque",
    });
    expect(stockButton).toHaveTextContent("85.0g");
    expect(stockButton).toHaveAccessibleDescription(/85.0g/);
  });
});
