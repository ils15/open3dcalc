import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

vi.mock("./StudioHeader", () => ({ StudioHeader: () => null }));
vi.mock("./StudioSubHeader", () => ({ StudioSubHeader: () => null }));
vi.mock("./StudioSidebar", () => ({
  StudioSidebar: ({
    onTabChange,
  }: {
    onTabChange: (tab: "catalog" | "marketplace") => void;
  }) => (
    <nav>
      <button type="button" onClick={() => onTabChange("catalog")}>
        Select Cadastros
      </button>
      <button type="button" onClick={() => onTabChange("marketplace")}>
        Select Marketplace
      </button>
    </nav>
  ),
}));
vi.mock("./StudioCockpitDock", () => ({ StudioCockpitDock: () => null }));
vi.mock("./StudioDashboardView", () => ({ StudioDashboardView: () => null }));
vi.mock("./StudioCalculatorView", () => ({ StudioCalculatorView: () => null }));
vi.mock("./StudioSpoolView", () => ({ StudioSpoolView: () => null }));
vi.mock("./StudioMiniDashOverlay", () => ({
  StudioMiniDashOverlay: () => null,
}));
vi.mock("./StudioCopilotModal", () => ({ StudioCopilotModal: () => null }));
vi.mock("./StudioShortcutsModal", () => ({ StudioShortcutsModal: () => null }));
vi.mock("./StudioQuoteModal", () => ({ StudioQuoteModal: () => null }));
vi.mock("./StudioHistoryView", () => ({ StudioHistoryView: () => null }));
vi.mock("./StudioCustomerView", () => ({ StudioCustomerView: () => null }));
vi.mock("./StudioQuotesView", () => ({ StudioQuotesView: () => null }));
vi.mock("./StudioProductsView", () => ({ StudioProductsView: () => null }));
vi.mock("@/shared/components/Calculator/InfillCalculator", () => ({
  InfillCalculator: () => null,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => null,
}));
vi.mock("@/shared/components/Catalog/MarketplaceBrowseTab", () => ({
  MarketplaceBrowseTab: () => null,
}));
vi.mock("@/shared/components/Wiki/WikiPage", () => ({ WikiPage: () => null }));
vi.mock("@/shared/components/Changelog/ChangelogPage", () => ({
  ChangelogPage: () => null,
}));
vi.mock("@/shared/components/Privacy/PrivacyScreen", () => ({
  PrivacyScreen: () => null,
}));
vi.mock("@/shared/components/Calculator/surfaces/BentoSurface", () => ({
  BentoSurface: () => null,
}));
vi.mock("@/shared/components/Calculator/surfaces/CalculatorSurface", () => ({
  CalculatorSurface: () => null,
}));
vi.mock("@/shared/components/Calculator/surfaces/GuidedSurface", () => ({
  GuidedSurface: () => null,
}));
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => null,
}));
vi.mock("@/shared/components/Privacy/PrivacyOnboarding", () => ({
  PrivacyOnboarding: () => null,
}));
vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: () => {} }));
vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

import { StudioLayout } from "./StudioLayout";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";

describe("StudioLayout demo export feedback", () => {
  afterEach(() => {
    useDemoModeStore.setState({ isActive: false, snapshot: null });
  });

  it("announces a blocked export while focus mode has removed the chrome", async () => {
    useDemoModeStore.setState({ isActive: true });
    render(<StudioLayout />);

    fireEvent.keyDown(window, { key: "f" });
    expect(screen.getByText(/Modo Foco Ativo/)).toBeInTheDocument();

    act(() => {
      expect(guardExport()).toBe(true);
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "Notificações" }),
    ).toHaveClass("relative");
  });

  it.each([
    { route: "catalog", control: "Select Cadastros" },
    { route: "marketplace", control: "Select Marketplace" },
  ])("keeps the dock-safe scroll viewport on the $route", ({ control }) => {
    const { container } = render(<StudioLayout />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: control }));
    });

    const root = container.firstElementChild;
    expect(root).toHaveClass("bg-surface-canvas", "text-text-primary");
    expect(root).toHaveClass("h-dvh", "overflow-hidden");
    const main = screen.getByRole("main");
    expect(main).toHaveClass("p-4", "sm:p-6", "lg:p-8");
    expect(main).toHaveClass("min-h-0", "overflow-y-auto");
    expect(main).not.toHaveClass("pb-24");
  });

  it("keeps the Stable dock-safe shell while focus mode hides the dock", () => {
    render(<StudioLayout />);

    const main = screen.getByRole("main");
    expect(main).toHaveClass("p-4", "sm:p-6", "lg:p-8");
    expect(main).toHaveClass("min-h-0", "overflow-y-auto");

    act(() => {
      fireEvent.keyDown(window, { key: "f" });
    });
    expect(screen.getByRole("main")).toHaveClass("min-h-0", "overflow-y-auto");
  });
});
