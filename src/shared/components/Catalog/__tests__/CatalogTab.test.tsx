import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CatalogTab } from "../CatalogTab";

// Mock stores
vi.mock("@/shared/stores/catalogStore", () => {
  const mockState = {
    printers: [],
    materials: [],
    marketplaces: [],
    load: vi.fn(),
    addPrinter: vi.fn(),
    addMaterial: vi.fn(),
    addMarketplace: vi.fn(),
    removePrinter: vi.fn(),
    removeMaterial: vi.fn(),
    removeMarketplace: vi.fn(),
  };
  return {
    useCatalogStore: Object.assign(
      vi.fn((selector?: (s: typeof mockState) => unknown) => {
        return selector ? selector(mockState) : mockState;
      }),
      { subscribe: vi.fn() },
    ),
  };
});

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
});
