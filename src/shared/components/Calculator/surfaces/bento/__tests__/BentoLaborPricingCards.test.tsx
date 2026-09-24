import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import i18n from "@/shared/i18n/i18n";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CalculationResult } from "@/shared/types";
import { BentoLaborCard } from "../BentoLaborCard";
import { BentoPricingCard } from "../BentoPricingCard";

const result: CalculationResult = {
  materialCost: 12.34,
  energyCost: 2.5,
  machineCost: 8.75,
  hardwareCost: 1.2,
  consumablesCost: 0.8,
  laborCost: 20,
  softwareCost: 0,
  failureCost: 4.5,
  extrasCost: 3.25,
  postProcessingCost: 5,
  subtotal: 58.34,
  totalCost: 58.34,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.12,
  costPerUnit: 58.34,
  unitWeight: 102.8,
  estimatedPrintTime: 150,
  targetMarginPercent: 30,
  breakEvenPrice: 70,
  actualMargin: 28.33,
  carbonFootprintGrams: 420,
};

const ADVANCED_LABOR_FIELDS = [
  "Setup (Fatiamento)",
  "Pós-Processamento",
  "Valor Hora",
  "Peças e Extras",
  "Embalagem",
] as const;

const ADVANCED_PRICING_FIELDS = [
  "Taxa do marketplace",
  "Imposto",
  "Taxa de falha",
  "Quantidade",
  "Margem alvo",
  "Preenchimento (Infill)",
  "Frete",
] as const;

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
  useCalculatorStore.getState().resetCalculator();
  useCalculatorStore.setState({
    activeTab: "fdm",
    calcLevel: "advanced",
    hiddenFields: [],
    quantity: 3,
    infillPercent: 20,
    results: result,
  });
});

function renderCards(): {
  readonly laborCard: HTMLElement;
  readonly pricingCard: HTMLElement;
} {
  const state = useCalculatorStore.getState();
  const labor = state.activeTab === "fdm" ? state.fdmLabor : state.resinLabor;
  const extrasCost =
    state.activeTab === "fdm"
      ? state.fdmExtras.extrasCost
      : state.resinExtras.extrasCost;
  const sales = state.activeTab === "fdm" ? state.fdmSales : state.resinSales;

  render(
    <>
      <BentoLaborCard labor={labor} laborCost={20} extrasCost={extrasCost} />
      <BentoPricingCard
        result={result}
        sales={sales}
        quantity={state.quantity}
        breakEvenPrice={70}
        profit={30}
      />
    </>,
  );

  return {
    laborCard: screen.getByRole("article", { name: i18n.t("bento.cards.labor") }),
    pricingCard: screen.getByRole("article", { name: i18n.t("bento.cards.pricing") }),
  };
}

function changeField(card: HTMLElement, name: string, value: string): void {
  fireEvent.change(within(card).getByRole("spinbutton", { name }), {
    target: { value },
  });
}

describe("editable labor and pricing cards", () => {
  it("matches the Classic labor and pricing coverage in advanced mode", () => {
    const { laborCard, pricingCard } = renderCards();

    expect(within(laborCard).getAllByRole("spinbutton")).toHaveLength(
      ADVANCED_LABOR_FIELDS.length,
    );
    for (const name of ADVANCED_LABOR_FIELDS) {
      expect(within(laborCard).getByRole("spinbutton", { name })).toBeVisible();
    }

    expect(within(pricingCard).getAllByRole("spinbutton")).toHaveLength(
      ADVANCED_PRICING_FIELDS.length,
    );
    for (const name of ADVANCED_PRICING_FIELDS) {
      expect(within(pricingCard).getByRole("spinbutton", { name })).toBeVisible();
    }
  });

  it.each([
    ["basic", ["Embalagem"], ["Taxa de falha", "Quantidade", "Margem alvo"]],
    [
      "intermediate",
      ["Peças e Extras", "Embalagem"],
      ["Preenchimento (Infill)", "Frete", "Taxa do marketplace", "Imposto", "Taxa de falha", "Quantidade", "Margem alvo"],
    ],
    ["advanced", ADVANCED_LABOR_FIELDS, ADVANCED_PRICING_FIELDS],
  ] as const)("uses the Classic level contract in %s mode", (level, laborFields, pricingFields) => {
    useCalculatorStore.setState({ calcLevel: level });
    const { laborCard, pricingCard } = renderCards();

    expect(within(laborCard).getAllByRole("spinbutton")).toHaveLength(laborFields.length);
    for (const name of laborFields) {
      expect(within(laborCard).getByRole("spinbutton", { name })).toBeVisible();
    }

    expect(within(pricingCard).getAllByRole("spinbutton")).toHaveLength(pricingFields.length);
    for (const name of pricingFields) {
      expect(within(pricingCard).getByRole("spinbutton", { name })).toBeVisible();
    }
  });

  it("honors advanced disclosure with the exact Classic section ids", () => {
    useCalculatorStore.setState({
      hiddenFields: [
        "labor.setupTimeMinutes",
        "labor.postProcessingTimeMinutes",
        "labor.hourlyRate",
        "sales.extrasCost",
        "sales.packagingCost",
        "sales.marketplace",
        "sales.taxPercent",
        "failure.failureValue",
        "sales.quantity",
        "sales.profitMarginPercent",
        "sales.infillPercent",
        "sales.shippingCost",
      ],
    });
    const { laborCard, pricingCard } = renderCards();

    expect(within(laborCard).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(within(pricingCard).queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("writes every FDM field through public calculator-store setters", () => {
    const { laborCard, pricingCard } = renderCards();

    changeField(laborCard, "Setup (Fatiamento)", "18");
    changeField(laborCard, "Pós-Processamento", "32");
    changeField(laborCard, "Valor Hora", "72.5");
    changeField(laborCard, "Peças e Extras", "14");
    changeField(laborCard, "Embalagem", "6");
    changeField(pricingCard, "Taxa do marketplace", "8.5");
    changeField(pricingCard, "Imposto", "12");
    changeField(pricingCard, "Taxa de falha", "7.5");
    changeField(pricingCard, "Quantidade", "6");
    changeField(pricingCard, "Margem alvo", "65");
    changeField(pricingCard, "Preenchimento (Infill)", "45");
    changeField(pricingCard, "Frete", "18");

    const state = useCalculatorStore.getState();
    expect(state.fdmLabor).toMatchObject({
      setupTimeMinutes: 18,
      postProcessingTimeMinutes: 32,
      hourlyRate: 72.5,
    });
    expect(state.fdmExtras.extrasCost).toBe(14);
    expect(state.fdmSales).toMatchObject({
      packagingCost: 6,
      marketplaceFeePercent: 8.5,
      taxPercent: 12,
      profitMarginPercent: 65,
      shippingCost: 18,
    });
    expect(state.fdmPrintParams.failureValue).toBe(7.5);
    expect(state.quantity).toBe(6);
    expect(state.infillPercent).toBe(45);
  });

  it("writes resin premises without mutating the FDM premises", () => {
    useCalculatorStore.setState({ activeTab: "resin" });
    const fdmSalesBefore = useCalculatorStore.getState().fdmSales;
    const fdmExtrasBefore = useCalculatorStore.getState().fdmExtras;
    const { laborCard, pricingCard } = renderCards();

    changeField(laborCard, "Setup (Fatiamento)", "11");
    changeField(laborCard, "Peças e Extras", "5");
    changeField(laborCard, "Embalagem", "7");
    changeField(pricingCard, "Taxa do marketplace", "4.5");
    changeField(pricingCard, "Taxa de falha", "9");

    const state = useCalculatorStore.getState();
    expect(state.resinLabor.setupTimeMinutes).toBe(11);
    expect(state.resinExtras.extrasCost).toBe(5);
    expect(state.resinSales).toMatchObject({
      packagingCost: 7,
      marketplaceFeePercent: 4.5,
    });
    expect(state.resinPrintParams.failureValue).toBe(9);
    expect(state.fdmSales).toEqual(fdmSalesBefore);
    expect(state.fdmExtras).toEqual(fdmExtrasBefore);
  });

  it("keeps cost, current margin, break-even, failure, and profit derived", () => {
    const { laborCard, pricingCard } = renderCards();

    expect(within(laborCard).getByLabelText("Custo de mão de obra: R$ 20,00")).toBeVisible();
    expect(within(pricingCard).getByLabelText("Margem atual: 28,33%")).toBeVisible();
    expect(within(pricingCard).getByLabelText("Falha: R$ 4,50")).toBeVisible();
    expect(within(pricingCard).getByLabelText("Break-even: R$ 70,00")).toBeVisible();
    expect(within(pricingCard).getByLabelText("Lucro: R$ 30,00")).toBeVisible();
    expect(within(pricingCard).queryByRole("spinbutton", { name: "Margem atual" })).not.toBeInTheDocument();
    expect(within(pricingCard).queryByRole("spinbutton", { name: "Break-even" })).not.toBeInTheDocument();
  });

  it("exposes visible units and helper text through accessible descriptions", () => {
    const { laborCard, pricingCard } = renderCards();
    const setup = within(laborCard).getByRole("spinbutton", { name: "Setup (Fatiamento)" });
    const fee = within(pricingCard).getByRole("spinbutton", { name: "Taxa do marketplace" });

    expect(setup).toHaveAccessibleDescription(
      "Tempo gasto preparando o arquivo, fatiando e configurando a impressora.",
    );
    expect(setup).toHaveAttribute("aria-describedby", `${setup.id}-helper`);
    expect(within(laborCard).getAllByText("min")).toHaveLength(2);
    expect(within(laborCard).getByText("/h")).toBeVisible();
    expect(within(laborCard).getAllByText("R$")).toHaveLength(3);
    expect(fee).toHaveAccessibleDescription(
      "Percentual cobrado pelo marketplace sobre o valor de venda.",
    );
    expect(within(pricingCard).getByText("un")).toBeVisible();
  });

  it("keeps English labels, helpers, and units in parity", async () => {
    await i18n.changeLanguage("en-US");
    const { laborCard, pricingCard } = renderCards();

    for (const name of ["Setup (Slicing)", "Post-Processing", "Hourly Rate", "Parts & Extras", "Packaging"]) {
      expect(within(laborCard).getByRole("spinbutton", { name })).toBeVisible();
    }
    for (const name of ["Marketplace fee", "Tax", "Failure rate", "Quantity", "Target margin", "Infill Percentage", "Shipping"]) {
      expect(within(pricingCard).getByRole("spinbutton", { name })).toBeVisible();
    }
    expect(within(pricingCard).getByText("units")).toBeVisible();
    expect(
      within(pricingCard).getByRole("spinbutton", { name: "Marketplace fee" }),
    ).toHaveAccessibleDescription(
      "Percentage charged by the marketplace on the sale value.",
    );
  });
});
