import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CatalogTab } from "../CatalogTab";
import {
  useCatalogStore,
  type CatalogPrinter,
} from "@/shared/stores/catalogStore";

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

const STORAGE_KEY = "open3dcalc_catalog_v1";

const printer = (
  id: string,
  name: string,
  tags: string[] = [],
  custom = true,
): CatalogPrinter => ({
  id,
  name,
  brand: "DIY",
  power: 120,
  value: 1500,
  usefulLife: 3000,
  maintenancePerHour: 0.25,
  custom,
  tags,
});

/** Seeds both localStorage and the store so the mount `load()` effect restores the same fixtures. */
const seed = (printers: CatalogPrinter[]) => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ printers, materials: [], marketplaces: [] }),
  );
  useCatalogStore.setState({
    printers,
    materials: [],
    marketplaces: [],
    selectedPrinterTag: null,
  });
};

describe("CatalogTab — Printer tag organization", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Filter chips ───────────────────────────────────────────────
  it("hides the tag filter bar when no printer has tags", () => {
    seed([printer("p1", "Alpha", []), printer("p2", "Beta", [], false)]);
    render(<CatalogTab />);

    expect(screen.queryByText("catalog.filterByTag")).toBeNull();
    expect(screen.queryByText("catalog.allTags")).toBeNull();
  });

  it("renders one chip per unique tag", () => {
    seed([
      printer("p1", "Alpha", ["resin", "fast"]),
      printer("p2", "Beta", ["resin"]),
    ]);
    render(<CatalogTab />);

    // Filter chips are the only buttons whose accessible name is the tag itself.
    expect(screen.getByRole("button", { name: "fast" })).toBeDefined();
    expect(screen.getByRole("button", { name: "resin" })).toBeDefined();
    // "All" reset chip is present alongside the tags.
    expect(
      screen.getByRole("button", { name: "catalog.allTags" }),
    ).toBeDefined();
  });

  it("filters printers when a tag chip is clicked", () => {
    seed([printer("p1", "Alpha", ["fdm"]), printer("p2", "Beta", ["resin"])]);
    render(<CatalogTab />);

    const resinChip = screen.getByRole("button", { name: "resin" });
    fireEvent.click(resinChip);

    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(resinChip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "fdm" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clears the filter when the active chip is clicked again", () => {
    seed([printer("p1", "Alpha", ["fdm"]), printer("p2", "Beta", ["resin"])]);
    render(<CatalogTab />);

    const resinChip = screen.getByRole("button", { name: "resin" });
    fireEvent.click(resinChip);
    fireEvent.click(resinChip);

    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
  });

  it('clears the filter via the "All" chip', () => {
    seed([printer("p1", "Alpha", ["fdm"]), printer("p2", "Beta", ["resin"])]);
    render(<CatalogTab />);

    fireEvent.click(screen.getByRole("button", { name: "resin" }));
    fireEvent.click(screen.getByRole("button", { name: "catalog.allTags" }));

    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "catalog.allTags" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("stops offering a removed tag as a filter", () => {
    seed([printer("p1", "Alpha", ["resin"]), printer("p2", "Beta", [])]);
    render(<CatalogTab />);

    fireEvent.click(screen.getAllByLabelText("catalog.removeTag")[0]);

    expect(screen.queryByText("resin")).toBeNull();
    expect(screen.queryByText("catalog.allTags")).toBeNull();
  });

  // ── Tag editor ─────────────────────────────────────────────────
  it("shows existing tags on custom printers", () => {
    seed([printer("p1", "Alpha", ["resin", "fast"])]);
    render(<CatalogTab />);

    expect(screen.getAllByLabelText("catalog.removeTag").length).toBe(2);
  });

  it("shows the empty hint for custom printers without tags", () => {
    seed([printer("p1", "Alpha", []), printer("p2", "Beta", [], false)]);
    render(<CatalogTab />);

    expect(screen.getByText("catalog.noTags")).toBeDefined();
  });

  it("only renders the tag editor for custom printers", () => {
    seed([
      printer("p1", "Alpha", ["resin"]),
      printer("p2", "Beta", ["resin"], false),
    ]);
    render(<CatalogTab />);

    // Editor (input + per-tag remove) exists only on the custom printer.
    expect(screen.getAllByLabelText("catalog.addTag").length).toBe(1);
    expect(screen.getAllByLabelText("catalog.removeTag").length).toBe(1);
    // The default printer's tag is still offered as a filter.
    expect(screen.getByRole("button", { name: "resin" })).toBeDefined();
  });

  it("adds a normalized tag via Enter", () => {
    seed([printer("p1", "Alpha", [])]);
    render(<CatalogTab />);

    const input = screen.getByLabelText("catalog.addTag");
    fireEvent.change(input, { target: { value: "  Voron 2 " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags,
    ).toEqual(["voron 2"]);
    expect(screen.getAllByText("voron 2").length).toBeGreaterThan(0);
  });

  it("keeps the Add button disabled until input is non-empty", () => {
    seed([printer("p1", "Alpha", [])]);
    render(<CatalogTab />);

    const button = screen.getByRole("button", {
      name: "catalog.addTag",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("removes a tag from a custom printer", () => {
    seed([printer("p1", "Alpha", ["resin", "fast"])]);
    render(<CatalogTab />);

    fireEvent.click(screen.getAllByLabelText("catalog.removeTag")[0]);
    expect(screen.getAllByLabelText("catalog.removeTag").length).toBe(1);
  });
});
