import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { CatalogTab } from "../CatalogTab";

// Mock stores
const { mockCatalog, mockCalculator } = vi.hoisted(() => ({
  mockCatalog: {
    printers: [] as Array<{
      id: string;
      name: string;
      brand: string;
      power: number;
      value: number;
      usefulLife: number;
      maintenancePerHour: number;
      custom?: boolean;
      tags?: string[];
      technology?: "fdm" | "resin";
      buildVolumeMm?: { x: number; y: number; z: number };
    }>,
    materials: [] as Array<Record<string, unknown>>,
    marketplaces: [] as Array<Record<string, unknown>>,
    selectedPrinterTag: null as string | null,
    load: vi.fn(),
    addPrinter: vi.fn(),
    addMaterial: vi.fn(),
    addMarketplace: vi.fn(),
    updatePrinter: vi.fn(),
    removePrinter: vi.fn(),
    removeMaterial: vi.fn(),
    removeMarketplace: vi.fn(),
    setPrinterTagFilter: vi.fn(),
  },
  mockCalculator: {
    selectedPrinterId: "",
    setSelectedPrinter: vi.fn(),
  },
}));

vi.mock("@/shared/stores/catalogStore", () => {
  return {
    useCatalogStore: Object.assign(
      vi.fn((selector?: (s: typeof mockCatalog) => unknown) => {
        return selector ? selector(mockCatalog) : mockCatalog;
      }),
      { subscribe: vi.fn() },
    ),
  };
});

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: Object.assign(
    vi.fn(
      (
        selector: (state: {
          selectedPrinter: { id: string };
          setSelectedPrinter: (printer: unknown) => void;
        }) => unknown,
      ) =>
        selector({
          selectedPrinter: { id: mockCalculator.selectedPrinterId },
          setSelectedPrinter: mockCalculator.setSelectedPrinter,
        }),
    ),
    {
      getState: () => ({
        setSelectedPrinter: mockCalculator.setSelectedPrinter,
      }),
    },
  ),
}));

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR" },
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    currency: "BRL",
    symbol: "R$",
    format: (v: number) => `R$ ${v.toFixed(2)}`,
  }),
}));

describe("CatalogTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCatalog.printers = [];
    mockCatalog.selectedPrinterTag = null;
    mockCalculator.selectedPrinterId = "";
  });

  it("renders tab bar with ARIA roles", () => {
    render(<CatalogTab />);
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveAttribute("aria-label", "catalog.title");
  });

  it("renders three tabs with correct roles", () => {
    render(<CatalogTab />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-controls", "tabpanel-printers");
    expect(tabs[1]).toHaveAttribute("aria-controls", "tabpanel-materials");
    expect(tabs[2]).toHaveAttribute("aria-controls", "tabpanel-marketplaces");
  });

  it("has tabpanel with correct id", () => {
    render(<CatalogTab />);
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "tabpanel-printers",
    );
  });

  it("switches tabs on click", () => {
    render(<CatalogTab />);
    const materialsTab = screen.getByRole("tab", { name: "catalog.materials" });
    fireEvent.click(materialsTab);
    expect(materialsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "tabpanel-materials",
    );
  });

  it("supports keyboard navigation", () => {
    render(<CatalogTab />);
    const firstTab = screen.getByRole("tab", { name: "catalog.printers" });
    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: "ArrowRight" });
    const secondTab = screen.getByRole("tab", { name: "catalog.materials" });
    expect(secondTab).toHaveAttribute("aria-selected", "true");
  });

  it("uses a one/two/three-column responsive printer profile grid", () => {
    render(<CatalogTab />);

    const grid = screen.getByRole("group", { name: "catalog.printers" });
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "xl:grid-cols-3");
  });

  it("renders real printer specs and marks optional fields as unavailable", () => {
    mockCatalog.printers = [
      {
        id: "preset-1",
        name: "Maker Pro",
        brand: "Maker",
        power: 250,
        value: 1200,
        usefulLife: 3000,
        maintenancePerHour: 0.25,
        technology: "fdm",
        buildVolumeMm: { x: 220, y: 220, z: 250 },
      },
      {
        id: "custom-1",
        name: "Resin One",
        brand: "Custom Lab",
        power: 90,
        value: 500,
        usefulLife: 1800,
        maintenancePerHour: 0.4,
        custom: true,
        tags: ["resin"],
      },
    ];

    render(<CatalogTab />);

    const preset = screen.getByRole("article", { name: /Maker Pro/ });
    expect(within(preset).getByText("catalog.fdm")).toBeInTheDocument();
    expect(
      within(preset).getByText("catalog.materialType"),
    ).toBeInTheDocument();
    expect(within(preset).getByText("stl.volume")).toBeInTheDocument();
    expect(within(preset).getByText("220 × 220 × 250 mm")).toBeInTheDocument();
    expect(within(preset).getByText("250 W")).toBeInTheDocument();
    expect(within(preset).getByText("R$ 1200")).toBeInTheDocument();

    const custom = screen.getByRole("article", { name: /Resin One/ });
    expect(within(custom).getAllByText("—")).toHaveLength(2);
    expect(within(custom).getByText("90 W")).toBeInTheDocument();
  });

  it("filters profiles by search, technology, and existing category tags", () => {
    mockCatalog.printers = [
      {
        id: "fdm-1",
        name: "Maker Pro",
        brand: "Maker",
        power: 250,
        value: 1200,
        usefulLife: 3000,
        maintenancePerHour: 0.25,
        technology: "fdm",
        tags: ["studio"],
      },
      {
        id: "resin-1",
        name: "Resin One",
        brand: "Lab",
        power: 90,
        value: 500,
        usefulLife: 1800,
        maintenancePerHour: 0.4,
        technology: "resin",
        tags: ["lab"],
      },
    ];

    render(<CatalogTab />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "catalog.printerName" }),
      {
        target: { value: "Maker" },
      },
    );
    expect(
      screen.getByRole("article", { name: /Maker Pro/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: /Resin One/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "catalog.printerName" }),
      {
        target: { value: "" },
      },
    );
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "catalog.materialType" }),
      ).getByRole("button", { name: "catalog.resin" }),
    );
    expect(
      screen.getByRole("article", { name: /Resin One/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: /Maker Pro/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "lab" }));
    expect(mockCatalog.setPrinterTagFilter).toHaveBeenCalledWith("lab");
  });

  it("selects a profile for calculations and keeps edit/delete protections", async () => {
    const preset = {
      id: "preset-1",
      name: "Maker Pro",
      brand: "Maker",
      power: 250,
      value: 1200,
      usefulLife: 3000,
      maintenancePerHour: 0.25,
      technology: "fdm" as const,
    };
    mockCatalog.printers = [
      preset,
      {
        ...preset,
        id: "custom-1",
        name: "My Printer",
        custom: true,
      },
    ];

    render(<CatalogTab />);

    const custom = screen.getByRole("article", { name: /My Printer/ });
    fireEvent.click(
      within(custom).getByRole("button", { name: "catalog.selectPrinter" }),
    );
    await waitFor(() =>
      expect(mockCalculator.setSelectedPrinter).toHaveBeenCalledWith(
        expect.objectContaining({ id: "custom-1", name: "My Printer" }),
      ),
    );

    const editButton = within(custom).getByRole("button", {
      name: "catalog.editPrinter",
    });
    editButton.focus();
    fireEvent.click(editButton);
    const dialog = screen.getByRole("dialog", { name: "catalog.editPrinter" });
    expect(dialog).toBeInTheDocument();
    const nameInput = within(dialog).getByRole("textbox", {
      name: "catalog.printerName",
    });
    const saveButton = within(dialog).getByRole("button", {
      name: "catalog.saveChanges",
    });
    const closeButton = within(dialog).getByRole("button", {
      name: "catalog.cancel",
    });
    expect(document.activeElement).toBe(nameInput);
    const backgroundTab = screen.getByRole("tab", { name: "catalog.printers" });
    backgroundTab.focus();
    fireEvent.keyDown(backgroundTab, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(saveButton, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(saveButton);
    fireEvent.change(nameInput, { target: { value: "Updated Printer" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "catalog.saveChanges" }),
    );
    expect(mockCatalog.updatePrinter).toHaveBeenCalledWith(
      "custom-1",
      expect.objectContaining({ name: "Updated Printer" }),
    );
    expect(document.activeElement).toBe(editButton);

    expect(
      within(screen.getByRole("article", { name: /Maker Pro/ })).queryByRole(
        "button",
        { name: "catalog.remove" },
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(custom).getByRole("button", { name: "catalog.remove" }),
    );
    expect(mockCatalog.removePrinter).toHaveBeenCalledWith("custom-1");
  });
});
