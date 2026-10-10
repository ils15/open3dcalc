import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketplaceComparison } from "../MarketplaceComparison";
import type { Marketplace } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (value: number) => `R$ ${value.toFixed(2)}`,
  }),
}));

const profiles = [
  {
    id: "direct",
    name: "Venda Direta",
    feePercent: 0,
    feeFixed: 0,
    hasFreeShipping: false,
  },
  {
    id: "my-store",
    name: "Minha Loja",
    feePercent: 8,
    feeFixed: 2,
    hasFreeShipping: false,
    custom: true,
  },
] satisfies Array<Marketplace & { custom?: boolean }>;

describe("MarketplaceComparison", () => {
  it("ranks catalog profiles, identifies the best, and applies a custom profile", () => {
    const onUseMarketplace = vi.fn();
    render(
      <MarketplaceComparison
        totalCost={100}
        marginPercent={30}
        taxPercent={0}
        marketplaces={profiles}
        selectedMarketplaceId="direct"
        onUseMarketplace={onUseMarketplace}
      />,
    );

    const openButton = screen.getByRole("button", {
      name: /calc.marketplaceComparison.open/,
    });
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("calc.marketplaceComparison.best")).toBeVisible();
    expect(screen.getByText("R$ 130.00")).toBeVisible();

    const customRow = screen.getByRole("row", { name: /Minha Loja/ });
    expect(
      within(customRow).getByText("calc.marketplaceComparison.custom"),
    ).toBeVisible();
    fireEvent.click(
      within(customRow).getByRole("button", {
        name: "calc.marketplaceComparison.useLabel",
      }),
    );

    expect(onUseMarketplace).toHaveBeenCalledWith(profiles[1]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "calc.marketplaceComparison.selected",
    );
    expect(
      screen.getByText("calc.marketplaceComparison.assumptions"),
    ).not.toBeVisible();
  });

  it("keeps the comparison keyboard reachable with native controls", () => {
    render(
      <MarketplaceComparison
        totalCost={100}
        marginPercent={30}
        taxPercent={0}
        marketplaces={profiles}
        selectedMarketplaceId="direct"
        onUseMarketplace={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /calc.marketplaceComparison.open/,
    });
    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("button", {
        name: "calc.marketplaceComparison.useLabel",
      }),
    ).toBeEnabled();
  });
});
