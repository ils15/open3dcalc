import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import i18n from "@/shared/i18n/i18n";
import type { SuggestedPriceScenario } from "@/shared/lib/suggestedPrice";
import { SuggestedPriceTool } from "../SuggestedPriceTool";

const onApply = vi.fn<(scenario: SuggestedPriceScenario) => void>();

function renderTool(): void {
  render(
    <SuggestedPriceTool
      totalCost={100}
      taxPercent={10}
      marketplaceFeePercent={10}
      marketplaceFeeFixed={5}
      quantity={1}
      volumeDiscounts={[]}
      initialMarginPercent={30}
      initialProfit={50}
      initialSellPrice={200}
      onApply={onApply}
    />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
  onApply.mockClear();
});

describe("SuggestedPriceTool", () => {
  it("uses the current fixed marketplace fee and applies the chosen scenario", async () => {
    const user = userEvent.setup();
    renderTool();

    await user.click(
      screen.getByRole("button", { name: i18n.t("calc.suggestedPrice.open") }),
    );

    const panel = screen.getByTestId("suggested-price-panel");
    expect(panel).toHaveTextContent("5,00");
    expect(panel).toHaveTextContent("210,00");
    expect(panel).toHaveTextContent("63,00");
    expect(panel).toHaveTextContent("markup equivalente");

    await user.click(
      within(panel).getByRole("button", {
        name: i18n.t("calc.suggestedPrice.apply"),
      }),
    );

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ sellPrice: 210, profit: 63, feasible: true }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("210,00");
  });

  it("explains an unreachable target and prevents applying it", async () => {
    const user = userEvent.setup();
    renderTool();
    await user.click(
      screen.getByRole("button", { name: i18n.t("calc.suggestedPrice.open") }),
    );

    const input = screen.getByLabelText(
      i18n.t("calc.suggestedPrice.targetMargin"),
    );
    await user.clear(input);
    await user.type(input, "90");

    const panel = screen.getByTestId("suggested-price-panel");
    expect(panel).toHaveTextContent(
      i18n.t("calc.suggestedPrice.notes.marginTargetUnreachable"),
    );
    expect(
      within(panel).getByRole("button", {
        name: i18n.t("calc.suggestedPrice.apply"),
      }),
    ).toBeDisabled();
  });

  it("exposes the profit, monthly, break-even, and competitor goals", async () => {
    const user = userEvent.setup();
    renderTool();
    await user.click(
      screen.getByRole("button", { name: i18n.t("calc.suggestedPrice.open") }),
    );
    const panel = screen.getByTestId("suggested-price-panel");
    const goal = within(panel).getByLabelText(
      i18n.t("calc.suggestedPrice.goal"),
    );

    await user.selectOptions(goal, "profit_per_part");
    expect(
      within(panel).getByLabelText(
        i18n.t("calc.suggestedPrice.profitPerPart", { currency: "R$" }),
      ),
    ).toBeInTheDocument();

    await user.selectOptions(goal, "monthly_profit");
    expect(
      within(panel).getByLabelText(
        i18n.t("calc.suggestedPrice.monthlyProfit", { currency: "R$" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(panel).getByLabelText(i18n.t("calc.suggestedPrice.unitsPerMonth")),
    ).toBeInTheDocument();

    await user.selectOptions(goal, "competitor");
    expect(
      within(panel).getByLabelText(
        i18n.t("calc.suggestedPrice.competitorPrice", { currency: "R$" }),
      ),
    ).toBeInTheDocument();
    expect(panel).toHaveTextContent(
      i18n.t("calc.suggestedPrice.scenarios.competitor_undercut"),
    );

    await user.selectOptions(goal, "break_even");
    expect(panel).toHaveTextContent(
      i18n.t("calc.suggestedPrice.scenarios.break_even"),
    );
  });

  it("provides a translated English interface", async () => {
    await i18n.changeLanguage("en-US");
    const user = userEvent.setup();
    renderTool();

    await user.click(
      screen.getByRole("button", { name: i18n.t("calc.suggestedPrice.open") }),
    );

    expect(
      screen.getByLabelText(i18n.t("calc.suggestedPrice.goal")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t("calc.suggestedPrice.notes.marginMarkup", { markup: 63 }),
      ),
    ).toBeInTheDocument();
  });

  it("keeps the goal selector and apply action in keyboard tab order", async () => {
    const user = userEvent.setup();
    renderTool();

    const disclosure = screen.getByRole("button", {
      name: i18n.t("calc.suggestedPrice.open"),
    });
    disclosure.focus();
    await user.keyboard("{Enter}");

    const goal = screen.getByLabelText(i18n.t("calc.suggestedPrice.goal"));
    await user.tab();
    expect(goal).toHaveFocus();
    await user.selectOptions(goal, "break_even");
    expect(goal).toHaveValue("break_even");

    const apply = screen.getByRole("button", {
      name: i18n.t("calc.suggestedPrice.apply"),
    });
    await user.tab();
    expect(apply).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ key: "break_even", feasible: true }),
    );
  });
});
