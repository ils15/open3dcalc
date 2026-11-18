import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudioCalculatorModeSelector } from "./StudioCalculatorModeSelector";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useScenarioComparisonStore } from "@/shared/stores/scenarioComparisonStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";

describe("StudioCalculatorModeSelector v2.0.2 — A/B to Quote", () => {
  beforeEach(() => {
    useCalculatorStore.getState().resetCalculator();
    useCalculatorStore.getState().setQuickStart();
    useScenarioComparisonStore.getState().clearPinnedScenario();
    useQuoteStore.setState({ quotes: [], nextNumber: 1 });
  });

  it("creates a 2-option comparative quote draft in 1 click from the A/B comparator bar", () => {
    render(
      <StudioCalculatorModeSelector mode="classic" onModeChange={() => {}} />,
    );

    // Pin baseline Scenario A
    const pinBtn = screen.getByRole("button", {
      name: /Fixar Cenário Base|Pin Baseline/i,
    });
    fireEvent.click(pinBtn);

    // Create A/B Quote
    const createQuoteBtn = screen.getByRole("button", {
      name: /Gerar Orçamento \(A vs\. B\)|Create A\/B Quote/i,
    });
    fireEvent.click(createQuoteBtn);

    const quotes = useQuoteStore.getState().quotes;
    expect(quotes).toHaveLength(1);
    expect(quotes[0].status).toBe("draft");
    expect(quotes[0].items).toHaveLength(2);
    expect(quotes[0].items[0].historyEntryId).toBe("ab-baseline");
    expect(quotes[0].items[1].historyEntryId).toBe("ab-current");
    expect(quotes[0].title).toContain("Comparativo A/B");
  });
});
