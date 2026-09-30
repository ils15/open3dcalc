import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { CostDistributionBars } from "../CostDistributionBars";
import type { CostSegment } from "@/shared/hooks/useFinancialBreakdown";

const chartData: CostSegment[] = [
  { name: "Material", value: 40, category: "filament", pct: 40 },
  { name: "Energia", value: 20, category: "energy", pct: 20 },
  { name: "Mão de obra", value: 40, category: "labor", pct: 40 },
];

describe("CostDistributionBars", () => {
  it("includes material/filament in the compact bars view", () => {
    render(<CostDistributionBars chartData={chartData} totalCost={100} />);

    const material = screen.getByTestId("compact-cost-bar-filament");

    expect(material).toBeInTheDocument();
    expect(material).toHaveTextContent("Material");
    expect(material).toHaveTextContent("40");
  });

  it("renders one legible row per segment, not just the largest ones", () => {
    render(<CostDistributionBars chartData={chartData} totalCost={100} />);

    const bars = screen.getByTestId("compact-cost-bars");
    for (const category of ["filament", "energy", "labor"]) {
      expect(
        within(bars).getByTestId(`compact-cost-bar-${category}`),
      ).toBeInTheDocument();
    }
    expect(
      bars.querySelectorAll('[data-testid^="compact-cost-bar-"]'),
    ).toHaveLength(3);
  });

  it("maps each category to its cost token and scales the bar to the share", () => {
    render(<CostDistributionBars chartData={chartData} totalCost={100} />);

    const bar = within(
      screen.getByTestId("compact-cost-bar-filament"),
    ).getByRole("img");
    expect(bar).toHaveAttribute(
      "style",
      "width: 40%; background-color: var(--cost-filament);",
    );
  });

  it("announces the percentage of each bar for assistive technology", () => {
    render(<CostDistributionBars chartData={chartData} totalCost={100} />);

    expect(
      screen.getByRole("img", { name: "Energia: 20.0%" }),
    ).toBeInTheDocument();
  });

  it("clamps a share above 100 so the bar cannot overflow its track", () => {
    render(
      <CostDistributionBars
        chartData={[
          { name: "Material", value: 40, category: "filament", pct: 140 },
        ]}
        totalCost={100}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Material: 140.0%" }),
    ).toHaveAttribute(
      "style",
      "width: 100%; background-color: var(--cost-filament);",
    );
  });

  it("renders nothing when there are no segments", () => {
    const { container } = render(
      <CostDistributionBars chartData={[]} totalCost={0} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("zeroes every bar when the total cost is zero", () => {
    render(<CostDistributionBars chartData={chartData} totalCost={0} />);

    expect(
      screen.getByRole("img", { name: "Material: 40.0%" }),
    ).toHaveAttribute(
      "style",
      "width: 0%; background-color: var(--cost-filament);",
    );
  });
});
