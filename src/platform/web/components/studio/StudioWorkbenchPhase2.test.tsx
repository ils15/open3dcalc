import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DataSyncButton } from "@/shared/components/ui/DataSyncButton";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useScenarioComparisonStore } from "@/shared/stores/scenarioComparisonStore";
import { StudioCalculatorModeSelector } from "./StudioCalculatorModeSelector";
import { StudioSidebar } from "./StudioSidebar";

describe("Phase 2 — Studio Ergonomics, Workshop Sub-Routes & Calculator Workbench", () => {
  beforeEach(() => {
    useCalculatorStore.getState().resetCalculator();
    useScenarioComparisonStore.getState().clearPinnedScenario();
  });

  it("renders DataSyncButton in compact icon-only mode when hideLabel is true while preserving accessible name", () => {
    render(<DataSyncButton variant="icon" hideLabel />);

    const btn = screen.getByRole("button", {
      name: /Sincronização de Dados|sync\.title/i,
    });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector("span")).toBeNull();
  });

  it("applies calculator presets atomically, tracks lastAppliedPresetId, and undoes in a single step", () => {
    const store = useCalculatorStore.getState();
    const initialCostPerKg = store.fdmMaterial.costPerKg;
    const initialMargin = store.fdmSales.profitMarginPercent;
    expect(store.lastAppliedPresetId).toBeNull();

    store.applyCalculatorPreset("petg_functional");
    const afterPreset = useCalculatorStore.getState();
    expect(afterPreset.lastAppliedPresetId).toBe("petg_functional");
    expect(afterPreset.fdmMaterial.type).toBe("PETG");
    expect(afterPreset.infillPercent).toBe(35);
    expect(afterPreset.fdmSlicerProfile.wallCount).toBe(4);
    expect(afterPreset.fdmSales.profitMarginPercent).toBe(65);

    // A single undo() must revert the entire preset application
    afterPreset.undo();
    const afterUndo = useCalculatorStore.getState();
    expect(afterUndo.lastAppliedPresetId).toBeNull();
    expect(afterUndo.fdmMaterial.costPerKg).toBe(initialCostPerKg);
    expect(afterUndo.fdmSales.profitMarginPercent).toBe(initialMargin);

    // Subsequent manual edit clears lastAppliedPresetId
    afterUndo.applyCalculatorPreset("marketplace_premium");
    expect(useCalculatorStore.getState().lastAppliedPresetId).toBe(
      "marketplace_premium",
    );
    useCalculatorStore.getState().setInfillPercent(45);
    expect(useCalculatorStore.getState().lastAppliedPresetId).toBeNull();
  });

  it("renders Calculator Workbench Control Deck with Quick Presets and Live Scenario A/B Comparator", () => {
    const onModeChange = vi.fn();
    render(
      <StudioCalculatorModeSelector
        mode="classic"
        onModeChange={onModeChange}
      />,
    );

    // Mode group remains unique and accessible
    const modeGroup = screen.getByRole("group", {
      name: "Modo da calculadora",
    });
    expect(
      within(modeGroup).getByRole("button", { name: "Clássico" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Quick Presets group renders all 4 presets
    const presetsGroup = screen.getByRole("group", {
      name: /Perfis rápidos de cálculo|Quick calculation presets/i,
    });
    const petgBtn = within(presetsGroup).getByRole("button", {
      name: /PETG Funcional|Functional PETG/i,
    });
    fireEvent.click(petgBtn);
    expect(useCalculatorStore.getState().lastAppliedPresetId).toBe(
      "petg_functional",
    );
    expect(petgBtn).toHaveAttribute("aria-pressed", "true");

    // Scenario A/B Comparator is initially hidden until pinned
    expect(
      screen.queryByRole("region", {
        name: /Comparador de Cenários A\/B|A\/B Scenario Comparator/i,
      }),
    ).toBeNull();

    // Pin Baseline (A)
    const pinBtn = screen.getByRole("button", {
      name: /Fixar Cenário Base \(A\/B\)|Pin Baseline \(A\/B\)/i,
    });
    fireEvent.click(pinBtn);

    const compareRegion = screen.getByRole("region", {
      name: /Comparador de Cenários A\/B|A\/B Scenario Comparator/i,
    });
    expect(compareRegion).toBeInTheDocument();

    // Apply Marketplace Premium preset (80% markup + marketplace fees) to create a positive price delta in Scenario B
    const mpBtn = within(presetsGroup).getByRole("button", {
      name: /Marketplace Premium/i,
    });
    fireEvent.click(mpBtn);

    const pinned = useScenarioComparisonStore.getState().pinnedScenario;
    const liveResults = useCalculatorStore.getState().results;
    expect(pinned).not.toBeNull();
    expect(liveResults).not.toBeNull();
    expect(liveResults!.sellPrice).not.toBe(pinned!.sellPrice);

    // Clear Comparison hides the comparator region
    const clearBtn = within(compareRegion).getByRole("button", {
      name: /Limpar Comparação|Clear Comparison/i,
    });
    fireEvent.click(clearBtn);
    expect(
      screen.queryByRole("region", {
        name: /Comparador de Cenários A\/B|A\/B Scenario Comparator/i,
      }),
    ).toBeNull();
  });

  it("renders direct 1-click Workshop sub-routes when StudioSidebar is expanded and hides them when collapsed", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <StudioSidebar
        activeTab="inventory"
        onTabChange={onTabChange}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    // Parent Minha Oficina button retains aria-current="page"
    const parentCatalogBtn = screen.getByRole("button", {
      name: /Minha Oficina|nav\.catalog/i,
    });
    expect(parentCatalogBtn).toHaveAttribute("aria-current", "page");

    // Sub-route buttons are present when expanded
    const subInventoryBtn = screen.getByRole("button", {
      name: /Estoque de Carretéis|nav\.workshopSubInventory/i,
    });
    const subMarketplaceBtn = screen.getByRole("button", {
      name: /Canais & Taxas|nav\.workshopSubMarketplace/i,
    });
    expect(subInventoryBtn).toHaveAttribute("aria-pressed", "true");
    expect(subMarketplaceBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(subMarketplaceBtn);
    expect(onTabChange).toHaveBeenCalledWith("marketplace");

    // When collapsed, sub-route buttons are not rendered
    rerender(
      <StudioSidebar
        activeTab="inventory"
        onTabChange={onTabChange}
        collapsed={true}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", {
        name: /Estoque de Carretéis|nav\.workshopSubInventory/i,
      }),
    ).toBeNull();
  });
});
