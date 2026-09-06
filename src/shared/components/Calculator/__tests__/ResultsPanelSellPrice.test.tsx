import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsPanel } from "../ResultsPanel";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useProductInventory } from "@/shared/stores/productInventory";
import type { CalculationResult } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

vi.mock("@/shared/components/Dashboard/RechartsLazy", () => ({
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => <div />,
  Legend: () => <div />,
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

const salesParams = {
  packagingCost: 0,
  shippingCost: 0,
  taxPercent: 10,
  marketplaceFeePercent: 5,
  profitMarginPercent: 50,
  volumeDiscounts: [],
};

function seedStore(productName = "Vaso Teste") {
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName,
    selectedSpoolId: null,
    fdmSales: { ...salesParams },
    results: { ...baseResults },
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
  useHistoryStore.setState({ entries: [] });
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

describe("ResultsPanel — editable sell price (display-local override)", () => {
  it("renders an edit button for the sell price", () => {
    render(<ResultsPanel variant="mobile" />);
    expect(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    ).toBeInTheDocument();
  });

  it("applies an override and shows recalculated profit + real margin", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.clear(screen.getByLabelText("calc.sellPriceInputLabel"));
    await user.type(screen.getByLabelText("calc.sellPriceInputLabel"), "120");
    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceConfirm" }),
    );

    // custom badge + details (S=120, base=60, tax=12, fee=6, profit=42)
    expect(screen.getByText("calc.sellPriceCustom")).toBeInTheDocument();
    expect(screen.getByText(/calc\.actualMargin/)).toBeInTheDocument();
    expect(screen.getByText(/calc\.effectiveMarkup/)).toBeInTheDocument();
    // no break-even warning for a healthy price
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when the override is below break-even", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.clear(screen.getByLabelText("calc.sellPriceInputLabel"));
    await user.type(screen.getByLabelText("calc.sellPriceInputLabel"), "50");
    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceConfirm" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("calc.belowBreakEven");
  });

  it("rejects non-positive values and stays in edit mode", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.clear(screen.getByLabelText("calc.sellPriceInputLabel"));
    await user.type(screen.getByLabelText("calc.sellPriceInputLabel"), "0");
    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceConfirm" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "calc.sellPriceInvalid",
    );
    // still editing
    expect(
      screen.getByLabelText("calc.sellPriceInputLabel"),
    ).toBeInTheDocument();
  });

  it("cancels editing and keeps the calculated price", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.clear(screen.getByLabelText("calc.sellPriceInputLabel"));
    await user.type(screen.getByLabelText("calc.sellPriceInputLabel"), "999");
    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceCancel" }),
    );

    expect(screen.queryByText("calc.sellPriceCustom")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("calc.sellPriceInputLabel"),
    ).not.toBeInTheDocument();
  });

  it("resets the override back to the calculated price", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.clear(screen.getByLabelText("calc.sellPriceInputLabel"));
    await user.type(screen.getByLabelText("calc.sellPriceInputLabel"), "120");
    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceConfirm" }),
    );
    expect(screen.getByText("calc.sellPriceCustom")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceReset" }),
    );
    expect(screen.queryByText("calc.sellPriceCustom")).not.toBeInTheDocument();
  });
});

describe("ResultsPanel — calculator → product bridge", () => {
  it("registers a product with the on-screen price and shows inventory link", async () => {
    const user = userEvent.setup();
    const goProducts = vi.fn();
    window.addEventListener("open3dcalc:go-products", goProducts);
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    const products = useProductInventory.getState().products;
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Vaso Teste");
    expect(products[0].costPrice).toBe(60);
    expect(products[0].salePrice).toBe(105.88);
    expect(products[0].weightGrams).toBe(85);
    expect(screen.getByRole("status")).toHaveTextContent(
      "results.productRegistered",
    );

    await user.click(
      screen.getByRole("button", { name: "results.viewProducts" }),
    );
    expect(goProducts).toHaveBeenCalledTimes(1);
    window.removeEventListener("open3dcalc:go-products", goProducts);
  });

  it("uses the override price when registering", async () => {
    const user = userEvent.setup();
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceEdit" }),
    );
    await user.clear(screen.getByLabelText("calc.sellPriceInputLabel"));
    await user.type(screen.getByLabelText("calc.sellPriceInputLabel"), "120");
    await user.click(
      screen.getByRole("button", { name: "calc.sellPriceConfirm" }),
    );

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );
    expect(useProductInventory.getState().products[0].salePrice).toBe(120);
  });

  it("warns (without blocking) on duplicate product names", async () => {
    const user = userEvent.setup();
    useProductInventory.getState().addProduct({
      name: "Vaso Teste",
      weightGrams: 10,
      filamentType: "PLA",
      costPrice: 5,
      salePrice: 15,
    });
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    // warn-only: second product is still created
    expect(useProductInventory.getState().products).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "results.productDuplicateWarn",
    );
  });

  it("prompts for a name when the calculator product name is empty", async () => {
    const user = userEvent.setup();
    seedStore("");
    window.prompt = vi.fn().mockReturnValue("Nome Prompt") as typeof prompt;
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(window.prompt).toHaveBeenCalled();
    expect(useProductInventory.getState().products[0].name).toBe("Nome Prompt");
  });

  it("aborts registration when the name prompt is cancelled", async () => {
    const user = userEvent.setup();
    seedStore("");
    window.prompt = vi.fn().mockReturnValue(null) as unknown as typeof prompt;
    render(<ResultsPanel variant="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "results.registerProduct" }),
    );

    expect(useProductInventory.getState().products).toHaveLength(0);
  });
});
