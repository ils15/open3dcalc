import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import i18n from "@/shared/i18n/i18n";

vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));
vi.mock("@/shared/hooks/useDemoMode", () => ({ useIsDemoMode: () => true }));
vi.mock("@/shared/components/DemoMode/DemoModeButton", () => ({
  DemoModeButton: () => null,
}));
vi.mock("@/shared/components/Privacy/PrivacyOnboarding", () => ({
  PrivacyOnboarding: () => null,
}));
vi.mock("@/shared/components/Results/ResultsSidebar", () => ({
  ResultsSidebar: () => null,
}));
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => null,
}));
vi.mock("@/shared/components/DemoMode/DemoExportBlockedToast", () => ({
  DemoExportBlockedToast: () => null,
}));
vi.mock("@/shared/stores/layoutStore", () => ({
  useLayoutStore: (
    selector: (state: {
      layoutMode: string;
      setLayoutMode: () => void;
    }) => unknown,
  ) => selector({ layoutMode: "classic", setLayoutMode: vi.fn() }),
}));
vi.mock("./StudioSubHeader", () => ({ StudioSubHeader: () => null }));
vi.mock("./StudioSidebar", () => ({ StudioSidebar: () => null }));
vi.mock("./StudioCockpitDock", () => ({ StudioCockpitDock: () => null }));
vi.mock("./StudioDashboardView", () => ({ StudioDashboardView: () => null }));
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
vi.mock("@/shared/components/Calculator/surfaces/GuidedSurface", () => ({
  GuidedSurface: () => null,
}));

import { StudioLayout } from "./StudioLayout";

describe("Studio technology selection", () => {
  beforeEach(() => {
    useCalculatorStore.setState({ activeTab: "fdm", calcLevel: "basic" });
  });

  it("keeps the shared calculator technology and Studio header in sync", async () => {
    const user = userEvent.setup();
    render(<StudioLayout />);

    const status = screen.getByRole("status", { name: "Tecnologia ativa" });

    expect(status).toHaveTextContent("FDM");
    await user.click(
      screen.getByRole("button", { name: i18n.t("calc.resin") }),
    );

    expect(status).toHaveTextContent("Resina");
    expect(useCalculatorStore.getState().activeTab).toBe("resin");

    await user.click(screen.getByRole("button", { name: i18n.t("calc.fdm") }));

    expect(status).toHaveTextContent("FDM");
    expect(useCalculatorStore.getState().activeTab).toBe("fdm");
  });
});
