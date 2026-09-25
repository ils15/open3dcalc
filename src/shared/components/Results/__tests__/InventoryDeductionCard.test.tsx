import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InventoryDeductionCard } from "../InventoryDeductionCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import type { CalculationResult } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const results: CalculationResult = {
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

function seedStore(activeTab: "fdm" | "resin" = "fdm") {
  useCalculatorStore.setState({
    activeTab,
    fdmMaterial: {
      type: "PLA",
      weightUsed: 85,
      purgeWeight: 0,
      costPerKg: 120,
      density: 1.24,
      spoolEfficiency: 98,
    },
    resinMaterial: { type: "Standard" } as never,
    selectedSpoolId: null,
    results: { ...results },
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
      {
        id: "s2",
        brand: "MarcaY",
        material: "PLA",
        color: "Branco",
        colorHex: "#eeeeee",
        weightGrams: 200,
        originalWeightGrams: 200,
        costPerKg: 130,
        diameterMm: 1.75,
        dateAdded: Date.now(),
        notes: "",
        status: "in_stock",
        purchaseStore: "",
      },
    ],
  });
}

beforeEach(() => {
  localStorage.clear();
  seedStore();
});

describe("InventoryDeductionCard — visibility", () => {
  it("renders the deduct action for FDM", () => {
    render(<InventoryDeductionCard />);

    expect(
      screen.getByRole("button", { name: "results.deductFromInventory" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("is not rendered on the resin tab", () => {
    seedStore("resin");
    const { container } = render(<InventoryDeductionCard />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("InventoryDeductionCard — dropdown", () => {
  it("lists only in-stock spools of the current material that cover the print", async () => {
    const user = userEvent.setup();
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.deductFromInventory" }),
    );

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(screen.getByText(/MarcaX/)).toBeInTheDocument();
    expect(screen.getByText(/MarcaY/)).toBeInTheDocument();
  });

  it("shows an empty state when no spool matches", async () => {
    const user = userEvent.setup();
    useFilamentInventory.setState({
      spools: [
        {
          id: "s3",
          brand: "MarcaZ",
          material: "ABS",
          color: "Cinza",
          colorHex: "#999999",
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
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.deductFromInventory" }),
    );

    expect(screen.getByText("common.noData")).toBeInTheDocument();
  });

  it("closes the dropdown with Escape", async () => {
    const user = userEvent.setup();
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.deductFromInventory" }),
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("InventoryDeductionCard — deduction", () => {
  it("confirms before deducting the print weight from the chosen spool", async () => {
    const user = userEvent.setup();
    const deductWeight = vi.spyOn(
      useFilamentInventory.getState(),
      "deductWeight",
    );
    render(<InventoryDeductionCard />);
    const stockButton = screen.getByRole("button", {
      name: "results.deductFromInventory",
    });

    await user.click(stockButton);
    await user.click(
      await screen.findByRole("option", { name: /MarcaX/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "results.deductFromInventory",
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: "common.confirm",
    });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    await user.click(confirmButton);

    expect(deductWeight).toHaveBeenCalledWith("s1", 85, {
      calculationIssues: [],
      quantity: 1,
    });
    await waitFor(() => expect(stockButton).toHaveFocus());
  });

  it("ignores a rapid duplicate confirmation", async () => {
    const user = userEvent.setup();
    const deductWeight = vi.spyOn(
      useFilamentInventory.getState(),
      "deductWeight",
    );
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.deductFromInventory" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /MarcaX/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "results.deductFromInventory",
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: "common.confirm",
    });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    await user.dblClick(confirmButton);

    expect(deductWeight).toHaveBeenCalledTimes(1);
  });

  it("confirms the deduction in the action button", async () => {
    const user = userEvent.setup();
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.deductFromInventory" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /MarcaX/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "results.deductFromInventory",
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: "common.confirm",
    });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    await user.click(confirmButton);

    expect(screen.getByText("results.deductSuccess")).toBeInTheDocument();
  });

  it("aborts the deduction when the confirm is cancelled", async () => {
    const user = userEvent.setup();
    const deductWeight = vi.spyOn(
      useFilamentInventory.getState(),
      "deductWeight",
    );
    render(<InventoryDeductionCard />);
    const stockButton = screen.getByRole("button", {
      name: "results.deductFromInventory",
    });

    await user.click(stockButton);
    await user.click(
      await screen.findByRole("option", { name: /MarcaX/ }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "results.deductFromInventory",
    });
    const cancelButton = within(dialog).getByRole("button", {
      name: "common.cancel",
    });
    await waitFor(() => expect(cancelButton).toBeEnabled());
    await user.click(cancelButton);

    expect(deductWeight).not.toHaveBeenCalled();
    await waitFor(() => expect(stockButton).toHaveFocus());
  });
});

describe("InventoryDeductionCard — add to shelf", () => {
  it("opens a prefilled form and adds the calculation material", async () => {
    const user = userEvent.setup();
    const addSpool = vi.spyOn(useFilamentInventory.getState(), "addSpool");
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.addToShelf" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "spools.newSpool" });
    expect(
      within(dialog).getByRole("combobox", { name: "spools.form.material" }),
    ).toHaveTextContent("PLA");
    expect(within(dialog).getByLabelText("spools.form.weight")).toHaveValue(85);
    expect(
      within(dialog).getByLabelText("spools.form.costPerKg"),
    ).toHaveValue(120);

    await user.type(
      within(dialog).getByLabelText("spools.form.brand"),
      "MarcaNova",
    );
    await user.type(
      within(dialog).getByLabelText("spools.form.color"),
      "Azul",
    );
    await user.type(
      within(dialog).getByLabelText("spools.form.originalWeight"),
      "1000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "spools.form.save" }),
    );

    expect(addSpool).toHaveBeenCalledWith(
      expect.objectContaining({
        material: "PLA",
        weightGrams: 85,
        costPerKg: 120,
        brand: "MarcaNova",
      }),
    );
  });

  it("offers a compatible existing spool instead of duplicating it", async () => {
    const user = userEvent.setup();
    useCalculatorStore.setState({ selectedSpoolId: "s1" });
    const addSpool = vi.spyOn(useFilamentInventory.getState(), "addSpool");
    render(<InventoryDeductionCard />);

    await user.click(
      screen.getByRole("button", { name: "results.addToShelf" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "spools.newSpool" });
    expect(
      within(dialog).getByRole("button", { name: "spools.useExisting" }),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "spools.useExisting" }),
    );

    expect(addSpool).not.toHaveBeenCalled();
    expect(useCalculatorStore.getState().selectedSpoolId).toBe("s1");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "spools.newSpool" }),
      ).not.toBeInTheDocument();
    });
  });
});
