import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import i18n from "@/shared/i18n/i18n";
import { BentoSummaryCard } from "../BentoSummaryCard";

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (value: number) => `R$ ${value.toFixed(2)}`,
  }),
}));

const defaultProps = {
  sellPrice: 100,
  totalCost: 60,
  taxAmount: 10,
  marketplaceFee: 5,
  totalFees: 15,
  profit: 25,
  hasResult: true,
  onSave: vi.fn(),
};

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
  vi.clearAllMocks();
});

describe("BentoSummaryCard", () => {
  it("renders every financial total with a textual label and value", () => {
    render(<BentoSummaryCard {...defaultProps} />);

    for (const label of [
      "Custo total",
      "Imposto calculado",
      "Taxa calculada",
      "Total de taxas",
      "Lucro líquido",
      "Margem real",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }

    expect(
      screen.getByLabelText("Preço de venda: R$ 100.00"),
    ).toBeVisible();
    expect(screen.getByLabelText("Margem real: 25%")).toBeVisible();
  });

  it("uses the semantic margin token for a positive real margin", () => {
    render(<BentoSummaryCard {...defaultProps} />);

    expect(screen.getByLabelText("Margem real: 25%").className).toContain(
      "var(--margin)",
    );
  });

  it("uses the negative semantic token for a negative real margin", () => {
    render(<BentoSummaryCard {...defaultProps} profit={-20} />);

    expect(screen.getByLabelText("Margem real: -20%").className).toContain(
      "var(--margin-negative)",
    );
  });

  it("shows a safe placeholder when the sell price is zero or invalid", () => {
    render(<BentoSummaryCard {...defaultProps} sellPrice={0} profit={25} />);

    expect(screen.getByLabelText("Margem real: —")).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();

    render(<BentoSummaryCard {...defaultProps} sellPrice={Number.NaN} />);
    expect(screen.getAllByLabelText("Margem real: —")).toHaveLength(2);
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
});
