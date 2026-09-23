import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PriceHeroCard } from "../PriceHeroCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { reverseFromSellPrice } from "@/shared/lib/sellPriceOverride";
import type { FinancialBreakdown } from "@/shared/hooks/useFinancialBreakdown";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

function makeBreakdown(
  overrides: Partial<FinancialBreakdown> = {},
): FinancialBreakdown {
  return {
    chartData: [],
    overrideCalc: null,
    displaySellPrice: 105.88,
    displayProfit: 30,
    breakEvenPrice: 70,
    fees: { taxAmount: 10.59, marketplaceFee: 5.29, total: 15.88, hasFees: true },
    time: { estimatedHours: 2.5, billableHours: 2.6, profitPerHour: 11.5 },
    isFDM: true,
    ...overrides,
  };
}

function renderCard(breakdown = makeBreakdown()) {
  const onSellOverrideChange = vi.fn();
  render(
    <PriceHeroCard
      breakdown={breakdown}
      onSellOverrideChange={onSellOverrideChange}
    />,
  );
  return { onSellOverrideChange };
}

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState({ currency: "BRL" });
});

describe("PriceHeroCard — display", () => {
  it("shows the sell price and an edit affordance", () => {
    renderCard();

    expect(screen.getByText("calc.sellPrice")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    ).toBeInTheDocument();
  });

  it("shows the taxes/marketplace footnote when the result carries fees", () => {
    renderCard();

    expect(screen.getByText("calc.taxesAndFeesIncluded")).toBeInTheDocument();
  });

  it("hides the fee footnote when there are no fees", () => {
    renderCard(
      makeBreakdown({
        fees: { taxAmount: 0, marketplaceFee: 0, total: 0, hasFees: false },
      }),
    );

    expect(screen.queryByText("calc.taxesAndFeesIncluded")).not.toBeInTheDocument();
  });
});

describe("PriceHeroCard — override editor", () => {
  it("confirms a valid override and reports the re-derived metrics", async () => {
    const user = userEvent.setup();
    const { onSellOverrideChange } = renderCard();

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    const input = screen.getByLabelText("calc.sellPriceInputLabel");
    expect(input).toHaveValue(105.88);
    await user.clear(input);
    await user.type(input, "120");
    await user.click(screen.getByRole("button", { name: "calc.sellPriceConfirm" }));

    expect(onSellOverrideChange).toHaveBeenCalledTimes(1);
    expect(onSellOverrideChange).toHaveBeenCalledWith(120);
  });

  it("rejects a non-positive price, warns, and keeps editing", async () => {
    const user = userEvent.setup();
    const { onSellOverrideChange } = renderCard();

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    const input = screen.getByLabelText("calc.sellPriceInputLabel");
    await user.clear(input);
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "calc.sellPriceConfirm" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "calc.sellPriceInvalid",
    );
    expect(onSellOverrideChange).not.toHaveBeenCalled();
  });

  it("cancels editing without changing the price", async () => {
    const user = userEvent.setup();
    const { onSellOverrideChange } = renderCard();

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.click(screen.getByRole("button", { name: "calc.sellPriceCancel" }));

    expect(
      screen.queryByLabelText("calc.sellPriceInputLabel"),
    ).not.toBeInTheDocument();
    expect(onSellOverrideChange).not.toHaveBeenCalled();
  });

});

describe("PriceHeroCard — active override", () => {
  function makeOverride(sellPrice: number) {
    const overrideCalc = reverseFromSellPrice(sellPrice, 70, 10, 5);
    return makeBreakdown({
      overrideCalc,
      displaySellPrice: overrideCalc.sellPrice,
      displayProfit: overrideCalc.profit,
    });
  }

  it("renders the custom badge, reset button and recalculated metrics", () => {
    renderCard(makeOverride(120));

    expect(screen.getByText("calc.sellPriceCustom")).toBeInTheDocument();
    expect(screen.getByText("calc.sellPriceReset")).toBeInTheDocument();
    expect(screen.getByText(/calc\.actualMargin/)).toBeInTheDocument();
    expect(screen.getByText(/calc\.effectiveMarkup/)).toBeInTheDocument();
  });

  it("hides the fee footnote while an override is active", () => {
    renderCard(makeOverride(120));

    expect(screen.queryByText("calc.taxesAndFeesIncluded")).not.toBeInTheDocument();
  });

  it("warns when the override is below break-even", () => {
    renderCard(makeOverride(60));

    expect(screen.getByRole("alert")).toHaveTextContent("calc.belowBreakEven");
  });

  it("resets the override back to the calculated price", async () => {
    const user = userEvent.setup();
    const { onSellOverrideChange } = renderCard(makeOverride(120));

    await user.click(screen.getByText("calc.sellPriceReset"));

    expect(onSellOverrideChange).toHaveBeenCalledWith(null);
  });

  it("hides the edit pencil while an override is active", () => {
    renderCard(makeOverride(120));

    expect(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    ).toBeInTheDocument();
  });
});
