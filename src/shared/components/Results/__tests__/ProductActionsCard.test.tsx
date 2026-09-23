import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProductActionsCard } from "../ProductActionsCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useProductInventory } from "@/shared/stores/productInventory";
import type { CalculationResult } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const baseResults: CalculationResult = {
  materialCost: 10,
  energyCost: 2,
  machineCost: 3,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 20,
  softwareCost: 1,
  failureCost: 0,
  extrasCost: 2,
  postProcessingCost: 0,
  subtotal: 40,
  totalCost: 60,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.1,
  costPerUnit: 60,
  unitWeight: 85,
  estimatedPrintTime: 5,
  targetMarginPercent: 50,
  breakEvenPrice: 60,
  actualMargin: 28.33,
  carbonFootprintGrams: 100,
  profitPerHour: 6,
  totalHoursForProfit: 5,
};

function seedStore(productName = "Vaso Teste") {
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName,
    selectedSpoolId: null,
    fdmMaterial: { type: "PLA" } as never,
    resinMaterial: { type: "Standard" } as never,
    results: { ...baseResults },
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
  useFilamentInventory.setState({
    spools: [
      {
        id: "s1",
        brand: "MarcaX",
        material: "PLA",
        color: "Preto",
        colorHex: "#111111",
        weightGrams: 1000,
        originalWeightGrams: 1000,
        costPerKg: 120,
        diameterMm: 1.75,
        dateAdded: Date.now(),
        notes: "",
        status: "in_stock",
        purchaseStore: "",
      },
    ],
  });
  useProductInventory.setState({ products: [] });
}

beforeEach(() => {
  localStorage.clear();
  seedStore();
  vi.restoreAllMocks();
});

describe("ProductActionsCard", () => {
  it("registers a product at the displayed sell price", async () => {
    const user = userEvent.setup();
    render(<ProductActionsCard displaySellPrice={105.88} />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    const products = useProductInventory.getState().products;
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Vaso Teste");
    expect(products[0].costPrice).toBe(60);
    expect(products[0].salePrice).toBe(105.88);
    expect(products[0].weightGrams).toBe(85);
  });

  it("announces success and offers the inventory shortcut", async () => {
    const user = userEvent.setup();
    render(<ProductActionsCard displaySellPrice={105.88} />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "results.productRegistered",
    );
    expect(screen.getByText("results.viewProducts")).toBeInTheDocument();
  });

  it("honors an overridden sell price when registering", async () => {
    const user = userEvent.setup();
    render(<ProductActionsCard displaySellPrice={120} />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(useProductInventory.getState().products[0].salePrice).toBe(120);
  });

  it("prompts for a name when the product name is empty", async () => {
    const user = userEvent.setup();
    seedStore("");
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Nome Prompt");
    render(<ProductActionsCard displaySellPrice={105.88} />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(prompt).toHaveBeenCalled();
    expect(useProductInventory.getState().products[0].name).toBe("Nome Prompt");
  });

  it("aborts registration when the name prompt is cancelled", async () => {
    const user = userEvent.setup();
    seedStore("");
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<ProductActionsCard displaySellPrice={105.88} />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(useProductInventory.getState().products).toHaveLength(0);
  });

  it("warns — without blocking — on a duplicate name", async () => {
    const user = userEvent.setup();
    useProductInventory.setState({
      products: [
        {
          id: "p1",
          name: "Vaso Teste",
          costPrice: 1,
          salePrice: 1,
          weightGrams: 1,
          filamentType: "PLA",
          sold: false,
          updatedAt: Date.now(),
          createdAt: Date.now(),
        },
      ],
    });
    render(<ProductActionsCard displaySellPrice={105.88} />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(useProductInventory.getState().products).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "results.productDuplicateWarn",
    );
  });

  it("adds the current calculation to the history", async () => {
    const user = userEvent.setup();
    const addToHistory = vi.spyOn(
      useCalculatorStore.getState(),
      "addToHistory",
    );
    render(<ProductActionsCard displaySellPrice={105.88} />);

    await user.click(
      screen.getByRole("button", { name: "calc.addHistory" }),
    );

    expect(addToHistory).toHaveBeenCalledTimes(1);
  });
});
