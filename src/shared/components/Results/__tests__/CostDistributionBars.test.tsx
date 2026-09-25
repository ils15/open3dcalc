import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostDistributionBars } from "../CostDistributionBars";

const chartData = [
  { name: "Material", value: 40, pct: 40, category: "filament" as const },
  { name: "Energia", value: 20, pct: 20, category: "energy" as const },
  { name: "Mão de obra", value: 40, pct: 40, category: "labor" as const },
];

describe("CostDistributionBars", () => {
  it("includes material/filament in the compact bars view", () => {
    render(<CostDistributionBars chartData={chartData} totalCost={100} />);

    const material = screen.getByTestId("compact-cost-bar-filament");

    expect(material).toBeInTheDocument();
    expect(material).toHaveTextContent("Material");
    expect(material).toHaveTextContent("40");
  });
});
