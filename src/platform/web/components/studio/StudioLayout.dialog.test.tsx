import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./StudioCockpitDock", () => ({
  StudioCockpitDock: ({ onOpenNewQuote }: { onOpenNewQuote: () => void }) => (
    <button type="button" onClick={onOpenNewQuote}>
      Open synthetic quote
    </button>
  ),
}));
vi.mock("./StudioHeader", () => ({ StudioHeader: () => null }));
vi.mock("./StudioSubHeader", () => ({ StudioSubHeader: () => null }));
vi.mock("./StudioSidebar", () => ({ StudioSidebar: () => null }));
vi.mock("./StudioDashboardView", () => ({ StudioDashboardView: () => null }));
vi.mock("./StudioCalculatorView", () => ({ StudioCalculatorView: () => null }));
vi.mock("./StudioSpoolView", () => ({ StudioSpoolView: () => null }));
vi.mock("./StudioMiniDashOverlay", () => ({
  StudioMiniDashOverlay: () => null,
}));
vi.mock("./StudioCopilotModal", () => ({ StudioCopilotModal: () => null }));
vi.mock("./StudioShortcutsModal", () => ({ StudioShortcutsModal: () => null }));
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
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => null,
}));
vi.mock("@/shared/components/DemoMode/DemoExportBlockedToast", () => ({
  DemoExportBlockedToast: () => null,
}));
vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));
vi.mock("@/shared/components/Privacy/PrivacyOnboarding", () => ({
  PrivacyOnboarding: () => null,
}));
vi.mock("@/shared/stores/layoutStore", () => ({
  useLayoutStore: (
    selector: (state: {
      layoutMode: string;
      setLayoutMode: () => void;
    }) => unknown,
  ) => selector({ layoutMode: "classic", setLayoutMode: vi.fn() }),
}));

import { StudioLayout } from "./StudioLayout";

describe("StudioLayout.dialog", () => {
  function openQuoteDialog() {
    render(<StudioLayout />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open synthetic quote" }),
    );
  }

  it("opens a labeled dialog with a 44px close target", () => {
    openQuoteDialog();
    const dialog = screen.getByRole("dialog", {
      name: "Gerador de Proposta Comercial & Relatório",
    });
    const closeButton = within(dialog).getByRole("button", {
      name: "Fechar proposta",
    });
    expect(closeButton).toHaveClass(/min-h-11|min-h-\[44px\]/);
  });

  it("closes the open dialog with Escape", () => {
    openQuoteDialog();
    expect(
      screen.getByRole("dialog", {
        name: "Gerador de Proposta Comercial & Relatório",
      }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", {
        name: "Gerador de Proposta Comercial & Relatório",
      }),
    ).toBeNull();
  });

  it("marks the quote dialog as modal for background isolation", () => {
    openQuoteDialog();
    const dialog = screen.getByRole("dialog", {
      name: "Gerador de Proposta Comercial & Relatório",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
