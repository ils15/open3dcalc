import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CostBreakdownCard } from "../CostBreakdownCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CostSegment } from "@/shared/hooks/useFinancialBreakdown";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

vi.mock("@/shared/components/Dashboard/RechartsLazy", () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

const segments: CostSegment[] = [
  { name: "Material", value: 10, color: "#38bdf8", pct: 33.33 },
  { name: "Energia", value: 20, color: "#facc15", pct: 66.67 },
];

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState({ currency: "BRL" });
});

describe("CostBreakdownCard", () => {
  it("renders nothing when there are no segments", () => {
    const { container } = render(
      <CostBreakdownCard chartData={[]} totalCost={30} isSidebar={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("labels every segment with its formatted value", () => {
    render(
      <CostBreakdownCard
        chartData={segments}
        totalCost={30}
        isSidebar={false}
      />,
    );

    expect(screen.getByText("calc.costDistribution")).toBeInTheDocument();
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*10,00/)).toBeInTheDocument();
    expect(screen.getByText("Energia")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*20,00/)).toBeInTheDocument();
  });

  it("scales each bar to its share of the total cost", () => {
    render(
      <CostBreakdownCard
        chartData={segments}
        totalCost={30}
        isSidebar={false}
      />,
    );

    const bars = document.querySelectorAll(".h-full.rounded-full");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveStyle({ width: "33.33%", backgroundColor: "#38bdf8" });
    expect(bars[1]).toHaveStyle({ width: "66.67%", backgroundColor: "#facc15" });
  });

  it("renders the donut in the non-sidebar variant", () => {
    render(
      <CostBreakdownCard
        chartData={segments}
        totalCost={30}
        isSidebar={false}
      />,
    );

    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("hides the donut in the sidebar variant", () => {
    render(
      <CostBreakdownCard
        chartData={segments}
        totalCost={30}
        isSidebar={true}
      />,
    );

    // CSS-hidden, so the chart stays in the DOM but is not displayed.
    const wrapper = document.querySelector(".mt-4.w-full");
    expect(wrapper?.className).toContain("hidden");
    expect(screen.getByText("Material")).toBeInTheDocument();
  });
});
