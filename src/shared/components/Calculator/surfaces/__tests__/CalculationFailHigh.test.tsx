import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import i18n from "@/shared/i18n/i18n";
import { ClassicSurface } from "@/shared/components/Calculator/surfaces/ClassicSurface";
import { BentoSurface } from "@/shared/components/Calculator/surfaces/BentoSurface";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CalculationResult } from "@/shared/types";
import type { CalculationValidationIssue } from "@/shared/stores/calculatorStore.validation";

const finiteResult: CalculationResult = {
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
  profitPerHour: 11.5,
  totalHoursForProfit: 2.6,
};

const invalidIssue: CalculationValidationIssue = {
  path: "fdmMaterial.density",
  reason: "non_finite",
  received: Number.NaN,
};

function setCalculation(
  results: CalculationResult | null,
  calculationIssues: CalculationValidationIssue[] = [],
): void {
  useCalculatorStore.setState({
    results,
    calculationIssues,
    activeTab: "fdm",
    currency: "BRL",
    productName: "Teste de cálculo",
  });
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("pt-BR");
  setCalculation(finiteResult);
});

describe("calculation fail-high surfaces", () => {
  it("ClassicSurface announces invalid results instead of rendering zero currency", () => {
    setCalculation(null, [invalidIssue]);

    render(<ClassicSurface />);

    const notices = screen.getAllByTestId("calculation-error");
    expect(notices.length).toBeGreaterThan(0);
    expect(notices[0]).toHaveTextContent("fdmMaterial.density");
    expect(notices[0]).toHaveTextContent("Dados inválidos");
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("BentoSurface announces the same invalid result state without zero currency", () => {
    setCalculation(null, [invalidIssue]);

    render(<BentoSurface />);

    const notice = screen.getByTestId("calculation-error");
    expect(notice).toHaveTextContent("fdmMaterial.density");
    expect(notice).toHaveTextContent("Dados inválidos");
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("keeps the invalid-state message identical across Classic and Bento", () => {
    setCalculation(null, [invalidIssue]);

    const classic = render(<ClassicSurface />);
    const classicMessage = screen.getAllByTestId("calculation-error")[0]?.textContent;
    classic.unmount();

    render(<BentoSurface />);
    const bentoMessage = screen.getByTestId("calculation-error").textContent;

    expect(classicMessage).toBe(bentoMessage);
  });

  it("shows the issue while retaining finite numbers when results are available", () => {
    setCalculation(finiteResult, [invalidIssue]);

    const classic = render(<ClassicSurface />);
    expect(screen.getAllByTestId("calculation-error")[0]).toBeInTheDocument();
    expect(screen.getAllByText("R$ 105,88").length).toBeGreaterThan(0);
    classic.unmount();

    render(<BentoSurface />);
    expect(screen.getByTestId("calculation-error")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Preço final: R\$ 105,88/).length).toBeGreaterThan(0);
  });

  it.each([
    ["ClassicSurface", <ClassicSurface />],
    ["BentoSurface", <BentoSurface />],
  ] as const)("does not show a false-positive warning for %s when valid", (_name, surface) => {
    render(surface);

    expect(screen.queryByTestId("calculation-error")).not.toBeInTheDocument();
  });

  it("provides an assertive, labelled, focus-managed invalid-state alert", async () => {
    setCalculation(null, [invalidIssue]);

    render(<BentoSurface />);

    const notice = screen.getByTestId("calculation-error");
    expect(notice).toHaveAttribute("role", "alert");
    expect(notice).toHaveAttribute("aria-live", "assertive");
    expect(notice).toHaveAttribute("aria-label", expect.stringContaining("fdmMaterial.density"));
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });

  it.each(["pt-BR", "en-US"] as const)("translates the invalid-state message in %s", async (language) => {
    await i18n.changeLanguage(language);
    setCalculation(null, [invalidIssue]);

    render(<BentoSurface />);

    const notice = screen.getByTestId("calculation-error");
    expect(notice.textContent).not.toContain("calc.");
    expect(notice).toHaveTextContent(
      language === "pt-BR" ? "Dados inválidos" : "Invalid calculation data",
    );
  });
});
