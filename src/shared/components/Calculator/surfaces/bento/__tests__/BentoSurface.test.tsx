import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import i18n from "@/shared/i18n/i18n";
import { LayoutSwitcher } from "@/shared/components/Header/LayoutSwitcher";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useSpoolStore, type FilamentSpool } from "@/shared/stores/spoolStore";
import type { CalculationResult } from "@/shared/types";
import { CalculatorSurface } from "../../CalculatorSurface";

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
  profitPerHour: 11.5,
  totalHoursForProfit: 2.6,
};

const spool: FilamentSpool = {
  id: "spool-bento",
  brand: "Open3D",
  material: "PLA",
  color: "Azul",
  colorHex: "#000000",
  weightGrams: 700,
  originalWeightGrams: 1000,
  costPerKg: 90,
  diameterMm: 1.75,
  dateAdded: 1,
  notes: "",
  status: "in_stock",
  purchaseStore: "",
  tareGrams: 200,
};

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("pt-BR");
  useLayoutStore.setState({ layoutMode: "classic" });
  useSpoolStore.setState({ spools: [] });
  useCalculatorStore.setState({
    activeTab: "fdm",
    calcLevel: "basic",
    hiddenFields: [],
    results: result,
    productName: "Suporte de câmera",
    quantity: 3,
    selectedSpoolId: null,
    currency: "BRL",
    fdmMaterial: {
      type: "PLA",
      weightUsed: 102.8,
      purgeWeight: 0,
      costPerKg: 90,
      density: 1.24,
      spoolEfficiency: 0.95,
    },
    fdmPrintParams: {
      printTimeHours: 2.5,
      printerPowerWatts: 120,
      energyCostPerKwh: 0.9,
      failureMode: "percent",
      failureValue: 5,
      riskMultiplier: 1,
      heatUpTimeMinutes: 10,
      heatUpPowerPercent: 20,
    },
    fdmMachine: {
      enabled: true,
      machineCost: 2500,
      depreciationMonths: 36,
      hoursPerMonth: 80,
      maintenanceEnabled: true,
      maintenanceCost: 75,
    },
    fdmLabor: {
      enabled: true,
      setupTimeMinutes: 15,
      postProcessingTimeMinutes: 20,
      hourlyRate: 60,
    },
    fdmExtras: { extrasCost: 3.25 },
    fdmSales: {
      packagingCost: 0,
      shippingCost: 0,
      taxPercent: 10,
      marketplaceFeePercent: 5,
      profitMarginPercent: 30,
      volumeDiscounts: [],
    },
  });
});

describe("BentoSurface", () => {
  it("renders the shared response and four input cards with values from CalculationResult", async () => {
    useLayoutStore.setState({ layoutMode: "bento" });

    render(<CalculatorSurface />);

    const headings = [
      "Material",
      "Máquina e energia",
      "Mão de obra e extras",
      "Precificação",
      "Resumo financeiro",
    ];
    for (const heading of headings) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    expect(screen.getByLabelText("Projeto / cliente: Suporte de câmera")).toBeInTheDocument();
    expect(screen.getByTestId("price-hero")).toHaveTextContent(/R\$\s*105,88/);
    expect(screen.getAllByLabelText(/Preço final: R\$ 105,88/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Custo total: R\$ 58,34/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Lucro líquido: R\$ 30,00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2,5 h").length).toBeGreaterThan(0);
    expect(screen.getByRole("spinbutton", { name: "Quantidade" })).toHaveValue(3);
  });

  it("derives the spool gauge from the selected inventory spool", async () => {
    useLayoutStore.setState({ layoutMode: "bento" });
    useCalculatorStore.setState({ selectedSpoolId: spool.id });
    useSpoolStore.setState({ spools: [spool] });

    render(<CalculatorSurface />);

    const materialCard = screen.getByRole("article", { name: "Material" });
    const gauge = within(materialCard).getByRole("progressbar", {
      name: "Carretel Open3D PLA Azul",
    });
    expect(gauge).toHaveAttribute("aria-valuenow", "63");
    expect(gauge).toHaveAttribute(
      "aria-valuetext",
      "500 g de 800 g disponíveis (63%)",
    );
    expect(within(materialCard).getByText("500 g restantes")).toBeInTheDocument();
  });

  it("switches from the layout selector to BentoSurface", async () => {
    const user = userEvent.setup();

    render(
      <>
        <LayoutSwitcher />
        <CalculatorSurface />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Bento Grid" }));

    expect(screen.getByRole("region", { name: "Calculadora em Bento Grid" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(
      screen.queryByRole("article", { name: "Resumo financeiro" }),
    ).not.toBeInTheDocument();
  });

  it("exposes keyboard focus for every card", async () => {
    const user = userEvent.setup();
    useLayoutStore.setState({ layoutMode: "bento" });

    render(<CalculatorSurface />);

    const firstCard = screen.getByRole("article", { name: "Material" });
    firstCard.focus();
    expect(firstCard).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("combobox", { name: "Tipo de Filamento" })).toHaveFocus();

    const machineCard = screen.getByRole("article", { name: "Máquina e energia" });
    machineCard.focus();
    expect(machineCard).toHaveFocus();
  });

  it("saves the current calculation from the summary CTA", async () => {
    const user = userEvent.setup();
    const addToHistory = vi.fn();
    useLayoutStore.setState({ layoutMode: "bento" });
    useCalculatorStore.setState({ addToHistory });

    render(<CalculatorSurface />);

    await user.click(screen.getByRole("button", { name: "Salvar no histórico" }));

    expect(addToHistory).toHaveBeenCalledOnce();
  });

  it.each([
    ["pt-BR", ["Material", "Máquina e energia", "Mão de obra e extras", "Precificação", "Resumo financeiro"]],
    ["en-US", ["Material", "Machine & energy", "Labor & extras", "Pricing", "Financial summary"]],
  ] as const)("renders every card label in %s", async (language, headings) => {
    await i18n.changeLanguage(language);
    useLayoutStore.setState({ layoutMode: "bento" });

    render(<CalculatorSurface />);

    for (const heading of headings) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByText(/bento\./i)).not.toBeInTheDocument();
  });

  it("exposes the shared three-level toggle in the Bento surface", () => {
    useLayoutStore.setState({ layoutMode: "bento" });
    useCalculatorStore.setState({ calcLevel: "basic", hiddenFields: [] });

    render(<CalculatorSurface />);

    const quick = screen.getByRole("button", { name: "Rápido" });
    const detailed = screen.getByRole("button", { name: "Detalhado" });
    const complete = screen.getByRole("button", { name: "Completo" });

    expect(quick).toHaveAttribute("aria-pressed", "true");
    expect(detailed).toHaveAttribute("aria-pressed", "false");
    expect(complete).toHaveAttribute("aria-pressed", "false");
  });

  it("updates Bento field visibility immediately through the shared store", async () => {
    const user = userEvent.setup();
    useLayoutStore.setState({ layoutMode: "bento" });
    useCalculatorStore.setState({ calcLevel: "basic", hiddenFields: [] });

    render(<CalculatorSurface />);

    const materialCard = screen.getByRole("article", { name: "Material" });
    expect(
      within(materialCard).queryByRole("spinbutton", { name: "Densidade" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Detalhado" }));
    expect(useCalculatorStore.getState().calcLevel).toBe("intermediate");
    expect(
      within(materialCard).getByRole("spinbutton", { name: "Densidade" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Completo" }));
    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");
    expect(
      within(materialCard).getByRole("spinbutton", { name: "Purga / Perda" }),
    ).toBeInTheDocument();
  });

  it("keeps hidden fields hidden after changing the level in Bento", async () => {
    const user = userEvent.setup();
    useLayoutStore.setState({ layoutMode: "bento" });
    useCalculatorStore.setState({
      calcLevel: "basic",
      hiddenFields: ["material.density"],
    });

    render(<CalculatorSurface />);
    await user.click(screen.getByRole("button", { name: "Completo" }));

    const materialCard = screen.getByRole("article", { name: "Material" });
    expect(
      within(materialCard).queryByRole("spinbutton", { name: "Densidade" }),
    ).not.toBeInTheDocument();
    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");
  });

  it("uses the same level state and labels when returning to Classic", async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage("pt-BR");
    useCalculatorStore.setState({ calcLevel: "basic", hiddenFields: [] });

    render(
      <>
        <LayoutSwitcher />
        <CalculatorSurface />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Bento Grid" }));
    const bentoLabels = ["Rápido", "Detalhado", "Completo"].map((label) =>
      screen.getByRole("button", { name: label }),
    );
    await user.click(bentoLabels[2]);

    expect(useCalculatorStore.getState().calcLevel).toBe("advanced");
    await user.click(
      screen.getByRole("button", { name: i18n.t("layoutSwitcher.classic") }),
    );

    for (const label of ["Rápido", "Detalhado", "Completo"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        label === "Completo" ? "true" : "false",
      );
    }
  });

  it.each([
    ["pt-BR", ["Rápido", "Detalhado", "Completo"]],
    ["en-US", ["Quick", "Detailed", "Complete"]],
  ] as const)(
    "keeps the Classic level labels in parity in %s",
    async (language, labels) => {
      const user = userEvent.setup();
      await i18n.changeLanguage(language);
      useCalculatorStore.setState({ calcLevel: "basic", hiddenFields: [] });

      render(
        <>
          <LayoutSwitcher />
          <CalculatorSurface />
        </>,
      );

      await user.click(screen.getByRole("button", { name: "Bento Grid" }));
      for (const label of labels) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }

      await user.click(
        screen.getByRole("button", { name: i18n.t("layoutSwitcher.classic") }),
      );
      for (const label of labels) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }
    },
  );

  it("is keyboard operable and exposes a visible focus ring", async () => {
    const user = userEvent.setup();
    useLayoutStore.setState({ layoutMode: "bento" });
    useCalculatorStore.setState({ calcLevel: "basic", hiddenFields: [] });

    render(<CalculatorSurface />);

    const quick = screen.getByRole("button", { name: "Rápido" });
    quick.focus();
    expect(quick).toHaveFocus();
    expect(quick).toHaveClass("focus-visible:ring-2");

    await user.keyboard("{Tab}");
    const detailed = screen.getByRole("button", { name: "Detalhado" });
    expect(detailed).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(useCalculatorStore.getState().calcLevel).toBe("intermediate");
    expect(detailed).toHaveAttribute("aria-pressed", "true");
  });
});
