import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { printers } from "@/shared/lib/printers";
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
      image?: string;
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
    mockCatalog.materials = [];
    mockCatalog.marketplaces = [];
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

  it("keeps catalog section tabs readable and semantically themed on mobile", () => {
    render(<CatalogTab />);

    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveClass("grid-cols-1", "sm:grid-cols-3");
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("min-h-11", "w-full", "whitespace-nowrap");
    }
    expect(screen.getByRole("tab", { name: "catalog.printers" })).toHaveClass(
      "text-[var(--accent-fill-fg)]",
    );
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
    expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "xl:grid-cols-3");
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
    expect(
      within(preset).queryByText("catalog.materialType"),
    ).not.toBeInTheDocument();
    expect(within(preset).getByText("stl.volume")).toBeInTheDocument();
    expect(within(preset).getByText("220 × 220 × 250 mm")).toBeInTheDocument();
    expect(within(preset).getByText("250 W")).toBeInTheDocument();
    expect(within(preset).getByText("R$ 1200")).toBeInTheDocument();

    const custom = screen.getByRole("article", { name: /Resin One/ });
    expect(within(custom).getAllByText("—")).toHaveLength(1);
    expect(
      within(custom).getByText("catalog.technologyUnknown"),
    ).toBeInTheDocument();
    expect(within(custom).getByText("90 W")).toBeInTheDocument();
  });

  it("shows printer images with a resilient fallback and keeps unknown technology visible", () => {
    mockCatalog.printers = [
      {
        id: "image-printer",
        name: "Image Printer",
        brand: "Maker",
        power: 250,
        value: 1200,
        usefulLife: 3000,
        maintenancePerHour: 0.25,
        technology: "fdm",
        image: "/images/printers/not-shipped.png",
      },
      {
        id: "unknown-printer",
        name: "Unknown Printer",
        brand: "Independent",
        power: 90,
        value: 500,
        usefulLife: 1800,
        maintenancePerHour: 0.4,
        image: "javascript:alert(1)",
      },
      {
        id: "malformed-image-printer",
        name: "Malformed Image Printer",
        brand: "Independent",
        power: 90,
        value: 500,
        usefulLife: 1800,
        maintenancePerHour: 0.4,
        image: "http://[invalid",
      },
    ];

    render(<CatalogTab />);

    const imageCard = screen.getByRole("article", {
      name: "Image Printer Maker",
    });
    expect(
      within(imageCard).queryByRole("img", { name: "Image Printer" }),
    ).not.toBeInTheDocument();
    expect(
      within(imageCard).getByRole("img", {
        name: "catalog.imageUnavailable",
      }),
    ).toBeInTheDocument();
    const fdmBadge = within(imageCard).getByText("catalog.fdm");
    expect(fdmBadge).toHaveClass(
      "border-[var(--color-accent-muted)]",
      "bg-[var(--color-accent-muted)]",
      "text-[var(--color-accent)]",
    );

    const unknownCard = screen.getByRole("article", {
      name: /Unknown Printer/,
    });
    expect(unknownCard).toBeInTheDocument();
    expect(
      within(unknownCard).getByText("catalog.technologyUnknown"),
    ).toBeInTheDocument();
    expect(
      within(unknownCard).getByRole("img", {
        name: "catalog.imageUnavailable",
      }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("article", {
          name: "Malformed Image Printer Independent",
        }),
      ).getByRole("img", { name: "catalog.imageUnavailable" }),
    ).toBeInTheDocument();
  });

  it("uses fallbacks for missing catalog PNGs without rendering image requests", () => {
    const missingPngPrinters = printers.filter(
      (printer) =>
        printer.image?.endsWith(".png") &&
        !existsSync(
          resolve(process.cwd(), "public", printer.image.replace(/^\/+/, "")),
        ),
    );
    expect(missingPngPrinters).toHaveLength(25);

    render(<CatalogTab />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "catalog.addPrinter" })[0],
    );
    const dialog = screen
      .getAllByRole("dialog")
      .find((candidate) => candidate.querySelector("h2"));
    expect(dialog).toBeDefined();
    if (!dialog) throw new Error("Printer preset dialog was not rendered");

    const presetCards = new Map(
      Array.from(dialog.querySelectorAll<HTMLDivElement>("div.group")).map(
        (card) =>
          [card.querySelector("h4")?.textContent?.trim() ?? "", card] as const,
      ),
    );

    const verifiedFdmPreset = printers.find(
      (printer) => printer.technology === "fdm",
    );
    expect(verifiedFdmPreset).toBeDefined();
    if (!verifiedFdmPreset) throw new Error("No verified FDM seed was found");
    const verifiedFdmCard = presetCards.get(verifiedFdmPreset.name);
    expect(verifiedFdmCard).toBeDefined();
    if (!verifiedFdmCard)
      throw new Error("Verified FDM preset card was not rendered");
    expect(within(verifiedFdmCard).getByText("catalog.fdm")).toHaveClass(
      "border-[var(--color-accent-muted)]",
      "bg-[var(--color-accent-muted)]",
      "text-[var(--color-accent)]",
    );

    for (const printer of missingPngPrinters) {
      const presetCard = presetCards.get(printer.name);
      expect(presetCard).toBeDefined();
      if (!presetCard) throw new Error(`Preset missing: ${printer.name}`);
      expect(
        within(presetCard).getByRole("img", {
          name: "catalog.imageUnavailable",
        }),
      ).toBeInTheDocument();
      expect(presetCard.querySelector("img")).toBeNull();
    }
  });

  it("resolves root printer images beneath the production relative base URL", () => {
    vi.stubEnv("BASE_URL", "./");
    mockCatalog.printers = [
      {
        id: "relative-base-image",
        name: "Relative Base Printer",
        brand: "Maker",
        power: 250,
        value: 1200,
        usefulLife: 3000,
        maintenancePerHour: 0.25,
        image: "/images/printers/fallback-fdm.svg",
      },
    ];

    try {
      render(<CatalogTab />);

      expect(
        within(
          screen.getByRole("article", { name: /Relative Base Printer/ }),
        ).getByRole("img", { name: "Relative Base Printer" }),
      ).toHaveAttribute("src", "./images/printers/fallback-fdm.svg");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("labels printer presets with unknown technology accessibly", () => {
    render(<CatalogTab />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "catalog.addPrinter" })[0],
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        "Buscar por modelo ou marca (ex: Ender, P1S, A1, K1, Mars, Saturn, Prusa...)",
      ),
      { target: { value: "OrangeStorm G2" } },
    );

    expect(
      screen.getByRole("heading", { name: "OrangeStorm G2" }),
    ).toBeInTheDocument();
    expect(screen.getByText("catalog.technologyUnknown")).toBeInTheDocument();
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
      screen.getByRole("searchbox", { name: "catalog.printerSearch" }),
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
      screen.getByRole("searchbox", { name: "catalog.printerSearch" }),
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

  it("filters material cards, clears the search, and preserves remove IDs", () => {
    mockCatalog.materials = [
      {
        id: "material-pla",
        name: "PLA Premium",
        type: "fdm",
        density: 1.24,
        avgPrice: 120,
        custom: true,
      },
      {
        id: "material-abs",
        name: "ABS Pro",
        type: "fdm",
        density: 1.04,
        avgPrice: 100,
        custom: true,
      },
    ];

    render(<CatalogTab />);
    fireEvent.click(screen.getByRole("tab", { name: "catalog.materials" }));

    fireEvent.change(
      screen.getByRole("searchbox", { name: "catalog.materialSearch" }),
      { target: { value: "premium" } },
    );
    expect(screen.getByText("PLA Premium")).toBeInTheDocument();
    expect(screen.queryByText("ABS Pro")).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "catalog.materialSearch" }),
      { target: { value: "no match" } },
    );
    expect(screen.getByText("history.noResults")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "catalog.clearSearch" }),
    );
    expect(screen.getByText("PLA Premium")).toBeInTheDocument();
    expect(screen.getByText("ABS Pro")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("article", { name: /PLA Premium/ })).getByRole(
        "button",
        { name: "catalog.remove" },
      ),
    );
    expect(mockCatalog.removeMaterial).toHaveBeenCalledWith("material-pla");
  });

  it("clears material search with the keyboard and exposes visible focus", async () => {
    const user = userEvent.setup();
    mockCatalog.materials = [
      {
        id: "material-pla",
        name: "PLA Premium",
        type: "fdm",
        density: 1.24,
        avgPrice: 120,
      },
    ];

    render(<CatalogTab />);
    await user.click(screen.getByRole("tab", { name: "catalog.materials" }));
    const search = screen.getByRole("searchbox", {
      name: "catalog.materialSearch",
    });
    await user.type(search, "missing");

    const clearButton = screen.getByRole("button", {
      name: "catalog.clearSearch",
    });
    await user.tab();
    expect(document.activeElement).toBe(clearButton);
    expect(clearButton).toHaveClass("focus-visible:ring-2");
    await user.keyboard("{Enter}");

    expect(search).toHaveValue("");
    expect(document.activeElement).toBe(search);
    expect(search).toHaveClass("focus-visible:ring-2");
    expect(screen.getByText("PLA Premium")).toBeInTheDocument();
  });

  it("returns focus to the search input after mouse-clearing", async () => {
    const user = userEvent.setup();
    mockCatalog.materials = [
      {
        id: "material-pla",
        name: "PLA Premium",
        type: "fdm",
        density: 1.24,
        avgPrice: 120,
      },
    ];

    render(<CatalogTab />);
    await user.click(screen.getByRole("tab", { name: "catalog.materials" }));
    const search = screen.getByRole("searchbox", {
      name: "catalog.materialSearch",
    });
    await user.type(search, "missing");
    await user.click(
      screen.getByRole("button", { name: "catalog.clearSearch" }),
    );

    expect(search).toHaveValue("");
    expect(document.activeElement).toBe(search);
  });

  it("filters fee-template cards and keeps marketplace IDs and labels for CRUD", () => {
    mockCatalog.marketplaces = [
      {
        id: "fee-template-local",
        name: "Local Pickup",
        feePercent: 0,
        feeFixed: 0,
        hasFreeShipping: false,
        custom: true,
      },
      {
        id: "fee-template-shop",
        name: "Shop Central",
        feePercent: 12,
        feeFixed: 1.5,
        hasFreeShipping: true,
        custom: true,
      },
    ];

    render(<CatalogTab />);
    fireEvent.click(screen.getByRole("tab", { name: "catalog.marketplaces" }));

    fireEvent.change(
      screen.getByRole("searchbox", { name: "catalog.marketplaceSearch" }),
      { target: { value: "central" } },
    );
    expect(screen.getByText("Shop Central")).toBeInTheDocument();
    expect(screen.queryByText("Local Pickup")).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "catalog.marketplaceSearch" }),
      { target: { value: "nothing" } },
    );
    expect(screen.getByText("history.noResults")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "catalog.clearSearch" }),
    );
    expect(screen.getByText("Local Pickup")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("article", { name: /Shop Central/ })).getByRole(
        "button",
        { name: "catalog.remove" },
      ),
    );
    expect(mockCatalog.removeMarketplace).toHaveBeenCalledWith(
      "fee-template-shop",
    );
  });

  it("creates materials and fee templates without changing their submitted labels", () => {
    render(<CatalogTab />);

    fireEvent.click(screen.getByRole("tab", { name: "catalog.materials" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "catalog.materialName" }),
      {
        target: { value: "PETG Workshop" },
      },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "catalog.density" }),
      {
        target: { value: "1.27" },
      },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "catalog.avgPrice" }),
      {
        target: { value: "135" },
      },
    );
    const materialSaveButton = screen.getByRole("button", {
      name: "catalog.save",
    });
    expect(materialSaveButton).toHaveClass("text-[var(--accent-fill-fg)]");
    fireEvent.click(materialSaveButton);
    expect(mockCatalog.addMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: "PETG Workshop",
        type: "fdm",
        density: 1.27,
        avgPrice: 135,
        custom: true,
      }),
    );

    fireEvent.click(screen.getByRole("tab", { name: "catalog.marketplaces" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "catalog.marketplaceName" }),
      { target: { value: "Artisan Shop" } },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "catalog.feePercent" }),
      { target: { value: "10" } },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "catalog.feeFixed" }),
      { target: { value: "2.5" } },
    );
    const feeSaveButton = screen.getByRole("button", {
      name: "catalog.save",
    });
    expect(feeSaveButton).toHaveClass("text-[var(--accent-fill-fg)]");
    fireEvent.click(feeSaveButton);
    expect(mockCatalog.addMarketplace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: "Artisan Shop",
        feePercent: 10,
        feeFixed: 2.5,
        hasFreeShipping: false,
        custom: true,
      }),
    );
  });
});
