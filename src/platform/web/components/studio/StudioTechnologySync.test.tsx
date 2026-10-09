import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
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
  it("keeps the header, demo template, and material technology card in sync", async () => {
    const user = userEvent.setup();
    render(<StudioLayout />);

    const status = screen.getByRole("status", { name: "Tecnologia ativa" });
    const fdmTemplate = screen.getByRole("button", {
      name: /Template Filamento \(FDM\)/,
    });
    const resinTemplate = screen.getByRole("button", {
      name: /Template Resina \(MSLA\)/,
    });
    const fdmCard = screen.getByRole("button", {
      name: "Insumo Filamento (FDM)",
    });
    const resinCard = screen.getByRole("button", {
      name: "Insumo Resina (SLA / MSLA / DLP)",
    });

    expect(status).toHaveTextContent("FDM");
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: /Filamento|Resina/,
      }),
    ).not.toBeInTheDocument();
    expect(fdmTemplate).toHaveAttribute("aria-pressed", "true");
    expect(fdmCard).toHaveAttribute("aria-pressed", "true");
    expect(resinTemplate).toHaveAttribute("aria-pressed", "false");
    expect(resinCard).toHaveAttribute("aria-pressed", "false");

    await user.click(resinCard);

    expect(status).toHaveTextContent("Resina");
    expect(
      screen.getByRole("button", { name: /Template Resina \(MSLA\)/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Insumo Resina (SLA / MSLA / DLP)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Template Filamento \(FDM\)/ }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Insumo Filamento (FDM)" }),
    ).toHaveAttribute("aria-pressed", "false");

    await user.click(
      screen.getByRole("button", { name: /Template Filamento \(FDM\)/ }),
    );

    expect(status).toHaveTextContent("FDM");
    expect(
      screen.getByRole("button", { name: /Template Filamento \(FDM\)/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Insumo Filamento (FDM)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Template Resina \(MSLA\)/ }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Insumo Resina (SLA / MSLA / DLP)" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
