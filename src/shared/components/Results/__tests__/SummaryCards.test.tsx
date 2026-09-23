import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CostSummaryCard } from "../CostSummaryCard";
import { ProfitSummaryCard } from "../ProfitSummaryCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState({ currency: "BRL" });
});

describe("CostSummaryCard", () => {
  it("renders the cost per gram and the failure allowance", () => {
    render(<CostSummaryCard costPerGram={0.71} failureCost={4.5} />);

    expect(screen.getByText("calc.costPerGram")).toBeInTheDocument();
    expect(screen.getByText("breakdown.failure")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,71\/g/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*4,50/)).toBeInTheDocument();
  });

  it("renders placeholders when either value is not applicable", () => {
    render(<CostSummaryCard costPerGram={0} failureCost={0} />);

    expect(screen.getAllByText("---")).toHaveLength(2);
  });
});

describe("ProfitSummaryCard", () => {
  it("renders the total cost and the profit", () => {
    render(
      <ProfitSummaryCard
        totalCost={60}
        profit={30}
        profitPerHour={11.5}
      />,
    );

    expect(screen.getByText("calc.totalCost")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*60,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*30,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*11,50\/h/)).toBeInTheDocument();
  });

  it("exposes the profit-per-hour note with an accessible label", () => {
    render(
      <ProfitSummaryCard
        totalCost={60}
        profit={30}
        profitPerHour={11.5}
      />,
    );

    const note = screen.getByText(/R\$\s*11,50\/h/);
    expect(note).toHaveAttribute("role", "note");
    expect(note).toHaveAttribute("tabIndex", "0");
    expect(note.getAttribute("aria-label")).toContain("calc.profitPerHour");
    expect(note.getAttribute("aria-label")).toContain(
      "calc.profitPerHourTooltip",
    );
  });
});
