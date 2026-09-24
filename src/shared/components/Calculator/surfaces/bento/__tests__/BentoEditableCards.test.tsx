import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import i18n from "@/shared/i18n/i18n";
import { printers } from "@/shared/lib/printers";
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
};

const spool: FilamentSpool = {
  id: "spool-editable",
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
  useLayoutStore.setState({ layoutMode: "bento" });
  useSpoolStore.setState({ spools: [] });
  useCalculatorStore.setState({
    activeTab: "fdm",
    calcLevel: "advanced",
    hiddenFields: [],
    results: result,
    selectedPrinter: printers[1],
    selectedSpoolId: null,
    fdmMaterial: {
      type: "PLA",
      weightUsed: 102.8,
      purgeWeight: 0,
      costPerKg: 90,
      density: 1.24,
      spoolEfficiency: 98,
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
  });
});

function renderBento() {
  render(<CalculatorSurface />);
  const machineCardName = i18n.resolvedLanguage?.startsWith("en")
    ? "Machine & energy"
    : "Máquina e energia";
  return {
    materialCard: screen.getByRole("article", { name: "Material" }),
    machineCard: screen.getByRole("article", { name: machineCardName }),
  };
}

describe("editable Bento cards", () => {
  it("writes FDM material fields through the calculator store", async () => {
    const user = userEvent.setup();
    const { materialCard } = renderBento();

    await user.selectOptions(
      within(materialCard).getByRole("combobox", { name: "Tipo de Filamento" }),
      "PETG",
    );
    expect(useCalculatorStore.getState().fdmMaterial.type).toBe("PETG");

    const weight = within(materialCard).getByRole("spinbutton", {
      name: "Peso da Peça",
    });
    await user.clear(weight);
    await user.type(weight, "75.5");
    expect(useCalculatorStore.getState().fdmMaterial.weightUsed).toBe(75.5);

    const cost = within(materialCard).getByRole("spinbutton", {
      name: "Custo/kg",
    });
    await user.clear(cost);
    await user.type(cost, "140");
    expect(useCalculatorStore.getState().fdmMaterial.costPerKg).toBe(140);

    const purge = within(materialCard).getByRole("spinbutton", {
      name: "Purga / Perda",
    });
    fireEvent.change(purge, { target: { value: "12" } });
    expect(useCalculatorStore.getState().fdmMaterial.purgeWeight).toBe(12);

    const density = within(materialCard).getByRole("spinbutton", {
      name: "Densidade",
    });
    fireEvent.change(density, { target: { value: "1.3" } });
    expect(useCalculatorStore.getState().fdmMaterial.density).toBe(1.3);

    const efficiency = within(materialCard).getByRole("spinbutton", {
      name: "Eficiência do Carretel",
    });
    fireEvent.change(efficiency, { target: { value: "95" } });
    expect(useCalculatorStore.getState().fdmMaterial.spoolEfficiency).toBe(95);
  });

  it("selects an inventory spool and keeps the accessible gauge", async () => {
    const user = userEvent.setup();
    useSpoolStore.setState({ spools: [spool] });
    const { materialCard } = renderBento();

    await user.selectOptions(
      within(materialCard).getByRole("combobox", { name: "Carretel do inventário" }),
      spool.id,
    );
    expect(useCalculatorStore.getState().selectedSpoolId).toBe(spool.id);

    const gauge = within(materialCard).getByRole("progressbar", {
      name: "Carretel Open3D PLA Azul",
    });
    expect(gauge).toHaveAttribute("aria-valuetext", "500 g de 800 g disponíveis (63%)");
  });

  it("writes print, energy, and machine fields through public setters", async () => {
    const user = userEvent.setup();
    const { machineCard } = renderBento();

    await user.selectOptions(
      within(machineCard).getByRole("combobox", { name: "Impressora" }),
      printers[2].id,
    );
    expect(useCalculatorStore.getState().selectedPrinter.id).toBe(printers[2].id);

    const printTime = within(machineCard).getByRole("spinbutton", {
      name: "Tempo de Impressão",
    });
    fireEvent.change(printTime, { target: { value: "3.5" } });
    expect(useCalculatorStore.getState().fdmPrintParams.printTimeHours).toBe(3.5);

    const power = within(machineCard).getByRole("spinbutton", {
      name: "Potência da Impressora",
    });
    fireEvent.change(power, { target: { value: "180" } });
    expect(useCalculatorStore.getState().fdmPrintParams.printerPowerWatts).toBe(180);

    const energyPrice = within(machineCard).getByRole("spinbutton", {
      name: "Custo da Energia",
    });
    fireEvent.change(energyPrice, { target: { value: "1.15" } });
    expect(useCalculatorStore.getState().fdmPrintParams.energyCostPerKwh).toBe(1.15);

    const machineCost = within(machineCard).getByRole("spinbutton", {
      name: "Custo da Impressora",
    });
    fireEvent.change(machineCost, { target: { value: "4200" } });
    expect(useCalculatorStore.getState().fdmMachine.machineCost).toBe(4200);

    const depreciation = within(machineCard).getByRole("spinbutton", {
      name: "Depreciação",
    });
    fireEvent.change(depreciation, { target: { value: "48" } });
    expect(useCalculatorStore.getState().fdmMachine.depreciationMonths).toBe(48);

    const hours = within(machineCard).getByRole("spinbutton", {
      name: "Uso Mensal",
    });
    fireEvent.change(hours, { target: { value: "100" } });
    expect(useCalculatorStore.getState().fdmMachine.hoursPerMonth).toBe(100);

    const monthlyUsage = within(machineCard).getByRole("checkbox", {
      name: "Ativar uso mensal",
    });
    await user.click(monthlyUsage);
    expect(useCalculatorStore.getState().fdmMachine.enabled).toBe(false);
    await user.click(monthlyUsage);
    expect(useCalculatorStore.getState().fdmMachine.enabled).toBe(true);

    const maintenance = within(machineCard).getByRole("checkbox", {
      name: "Manutenção",
    });
    await user.click(maintenance);
    expect(useCalculatorStore.getState().fdmMachine.maintenanceEnabled).toBe(false);
    await user.click(maintenance);
    expect(useCalculatorStore.getState().fdmMachine.maintenanceEnabled).toBe(true);

    const maintenanceCost = within(machineCard).getByRole("spinbutton", {
      name: "Custo Mensal Manutenção",
    });
    fireEvent.change(maintenanceCost, { target: { value: "90" } });
    expect(useCalculatorStore.getState().fdmMachine.maintenanceCost).toBe(90);
  });

  it("uses the Classic field visibility contract for every calc level", () => {
    useCalculatorStore.setState({ calcLevel: "basic" });
    const { materialCard, machineCard } = renderBento();

    expect(within(materialCard).getByRole("spinbutton", { name: "Peso da Peça" })).toBeInTheDocument();
    expect(within(materialCard).queryByRole("spinbutton", { name: "Densidade" })).not.toBeInTheDocument();
    expect(within(materialCard).queryByRole("spinbutton", { name: "Purga / Perda" })).not.toBeInTheDocument();
    expect(within(machineCard).queryByRole("combobox", { name: "Impressora" })).not.toBeInTheDocument();
    expect(within(machineCard).queryByRole("spinbutton", { name: "Custo da Impressora" })).not.toBeInTheDocument();
  });

  it("shows intermediate fields but still hides the advanced machine section", () => {
    useCalculatorStore.setState({ calcLevel: "intermediate" });
    const { materialCard, machineCard } = renderBento();

    expect(within(materialCard).getByRole("spinbutton", { name: "Densidade" })).toBeInTheDocument();
    expect(within(materialCard).getByRole("spinbutton", { name: "Purga / Perda" })).toBeInTheDocument();
    expect(within(machineCard).getByRole("combobox", { name: "Impressora" })).toBeInTheDocument();
    expect(within(machineCard).queryByRole("spinbutton", { name: "Custo da Impressora" })).not.toBeInTheDocument();
  });

  it("honors hidden intermediate fields in advanced mode and keeps resin fields editable", async () => {
    useCalculatorStore.setState({
      calcLevel: "advanced",
      hiddenFields: ["material.density"],
      activeTab: "resin",
    });
    const user = userEvent.setup();
    const { materialCard } = renderBento();

    expect(within(materialCard).queryByRole("spinbutton", { name: "Densidade" })).not.toBeInTheDocument();
    const volume = within(materialCard).getByRole("spinbutton", { name: "Volume Usado" });
    fireEvent.change(volume, { target: { value: "80" } });
    expect(useCalculatorStore.getState().resinMaterial.volumeUsedMl).toBe(80);

    const cost = within(materialCard).getByRole("spinbutton", { name: "Custo/Litro" });
    fireEvent.change(cost, { target: { value: "210" } });
    expect(useCalculatorStore.getState().resinMaterial.costPerLiter).toBe(210);

    await user.selectOptions(
      within(materialCard).getByRole("combobox", { name: "Tipo de Resina" }),
      "Resina Tough",
    );
    expect(useCalculatorStore.getState().resinMaterial.type).toBe("Resina Tough");
  });

  it("keeps the English labels and visible units in parity with Portuguese", () => {
    return i18n.changeLanguage("en-US").then(() => {
      const { materialCard } = renderBento();
      expect(within(materialCard).getByRole("spinbutton", { name: "Part Weight" })).toBeInTheDocument();
      for (const unit of within(materialCard).getAllByText("g")) {
        expect(unit).toBeVisible();
      }
      expect(within(materialCard).getByText("Cost/kg")).toBeInTheDocument();
    });
  });
});
