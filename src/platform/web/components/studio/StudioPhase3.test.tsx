import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { WorkshopHub } from "@/shared/components/Catalog/WorkshopHub";
import { CatalogTab } from "@/shared/components/Catalog/CatalogTab";
import { QuickResultActionsBar } from "@/shared/components/Results/QuickResultActionsBar";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useScenarioComparisonStore } from "@/shared/stores/scenarioComparisonStore";
import { useHistoryStore } from "@/shared/stores/historyStore";

describe("Phase 3 — Workshop Item Management & Panel Ergonomics", () => {
  beforeEach(() => {
    useCalculatorStore.getState().resetCalculator();
    useScenarioComparisonStore.getState().clearPinnedScenario();
    useHistoryStore.getState().clearHistory();
  });

  it("renders Active Workshop Setup Deck in WorkshopHub and jumps between sections or calculator", () => {
    const onTabChange = vi.fn();
    render(<WorkshopHub activeTab="catalog" onTabChange={onTabChange} />);

    expect(
      screen.getByTestId("workshop-active-setup-deck"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("workshop-slot-printer")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-slot-material")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-slot-stock")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-slot-channel")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("workshop-slot-stock"));
    expect(onTabChange).toHaveBeenCalledWith("inventory");

    fireEvent.click(screen.getByTestId("workshop-open-calculator-btn"));
    expect(onTabChange).toHaveBeenCalledWith("calculator");
  });

  it("applies library material to calculator in 1 click, filters by tech, sorts by price, and clones to personal collection", () => {
    render(
      <CatalogTab
        activeSection="materials"
        showHeader={false}
        showSectionTabs={false}
      />,
    );

    // Switch to Library collection to inspect library materials
    const libraryBtn = screen.getByRole("button", {
      name: /catalog\.materialLibrary|Biblioteca de materiais|Material library/i,
    });
    fireEvent.click(libraryBtn);

    // Filter by Resin
    fireEvent.click(screen.getByTestId("material-filter-tech-resin"));
    const applyBtnsResin = screen.getAllByTestId("catalog-apply-material-btn");
    expect(applyBtnsResin.length).toBeGreaterThan(0);

    // Apply first resin material to calculator
    fireEvent.click(applyBtnsResin[0]);
    expect(useCalculatorStore.getState().activeTab).toBe("resin");

    // Reset filter to All and sort by priceAsc
    fireEvent.click(screen.getByTestId("material-filter-tech-all"));
    fireEvent.change(screen.getByTestId("material-sort-select"), {
      target: { value: "priceAsc" },
    });

    // Clone a library material into Mine
    const initialCount = useCatalogStore.getState().materials.length;
    const cloneBtns = screen.getAllByTestId("catalog-clone-material-btn");
    fireEvent.click(cloneBtns[0]);
    expect(useCatalogStore.getState().materials.length).toBe(initialCount + 1);
  });

  it("selects sales channel in 1 click, shows live fee impact when calculator has sellPrice, and clones to personal channels", () => {
    // Load example in calculator so results.sellPrice > 0
    useCalculatorStore.getState().setQuickStart();
    expect(
      useCalculatorStore.getState().results?.sellPrice ?? 0,
    ).toBeGreaterThan(0);

    render(
      <CatalogTab
        activeSection="marketplaces"
        showHeader={false}
        showSectionTabs={false}
      />,
    );

    const libraryBtn = screen.getByRole("button", {
      name: /catalog\.marketplaceLibrary|Biblioteca de canais|Channel library/i,
    });
    fireEvent.click(libraryBtn);

    // Live fee estimate should be rendered for channels
    const liveFeeNotes = screen.getAllByTestId("catalog-channel-live-fee");
    expect(liveFeeNotes.length).toBeGreaterThan(0);

    // Select a channel
    const selectBtns = screen.getAllByTestId("catalog-select-channel-btn");
    fireEvent.click(selectBtns[1]);
    expect(selectBtns[1]).toHaveAttribute("aria-pressed", "true");

    // Clone a channel into Mine
    const initialChannels = useCatalogStore.getState().marketplaces.length;
    const cloneBtns = screen.getAllByTestId("catalog-clone-channel-btn");
    fireEvent.click(cloneBtns[0]);
    expect(useCatalogStore.getState().marketplaces.length).toBe(
      initialChannels + 1,
    );
  });

  it("renders QuickResultActionsBar and executes 1-click Copy Summary, Pin A/B Baseline, and Quick Save", () => {
    useCalculatorStore.getState().setQuickStart();
    render(<QuickResultActionsBar />);

    expect(screen.getByTestId("quick-result-actions-bar")).toBeInTheDocument();

    // Pin Scenario A/B
    const pinBtn = screen.getByTestId("quick-result-pin-btn");
    expect(pinBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pinBtn);
    expect(pinBtn).toHaveAttribute("aria-pressed", "true");
    expect(useScenarioComparisonStore.getState().pinnedScenario).not.toBeNull();

    // Quick Save to History
    const saveBtn = screen.getByTestId("quick-result-save-btn");
    fireEvent.click(saveBtn);
    expect(useHistoryStore.getState().entries.length).toBeGreaterThan(0);

    // Copy Summary
    const copyBtn = screen.getByTestId("quick-result-copy-btn");
    fireEvent.click(copyBtn);
    expect(copyBtn).toBeInTheDocument();
  });
});
