import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("./StudioHeader", () => ({ StudioHeader: () => null }));
vi.mock("./StudioCockpitDock", () => ({ StudioCockpitDock: () => null }));
vi.mock("./StudioDashboardView", () => ({ StudioDashboardView: () => null }));
vi.mock("./StudioCalculatorView", () => ({
  StudioCalculatorView: () => <div data-testid="calculator-view" />,
}));
vi.mock("./StudioSpoolView", () => ({ StudioSpoolView: () => null }));
vi.mock("./StudioMiniDashOverlay", () => ({
  StudioMiniDashOverlay: () => null,
}));
vi.mock("./StudioCopilotModal", () => ({ StudioCopilotModal: () => null }));
vi.mock("./StudioShortcutsModal", () => ({
  StudioShortcutsModal: () => null,
}));
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
  PrivacyScreen: () => <div data-testid="privacy-screen" />,
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

import { StudioSidebar } from "./StudioSidebar";
import { StudioLayout } from "./StudioLayout";

function renderSidebar() {
  return render(
    <StudioSidebar
      activeTab={"calculator" as Tab}
      onTabChange={vi.fn()}
      collapsed={false}
      onToggleCollapse={vi.fn()}
      currency="BRL"
      onCurrencyChange={vi.fn()}
    />,
  );
}

describe("StudioSidebar Beta surface", () => {
  it("does not expose the privacy entry on Beta", () => {
    renderSidebar();

    expect(screen.queryByRole("button", { name: "Privacidade" })).toBeNull();
  });

  it("keeps the privacy entry unreachable even with a modules override", () => {
    const { container } = render(
      <StudioSidebar
        activeTab={"calculator" as Tab}
        onTabChange={vi.fn()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        currency="BRL"
        onCurrencyChange={vi.fn()}
        modules={[
          {
            id: "privacy" as Tab,
            label: "Privacidade",
            icon: <span />,
          },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Privacidade" })).toBeNull();
    expect(container.textContent ?? "").not.toContain("Privacidade");
  });

  it("exposes no privacy navigation in the full layout, so the blank view is unreachable", () => {
    render(<StudioLayout />);

    expect(screen.queryByRole("button", { name: "Privacidade" })).toBeNull();
    expect(screen.queryByTestId("privacy-screen")).toBeNull();
    expect(screen.getByTestId("calculator-view")).toBeInTheDocument();
  });
});

describe("StudioSidebar Beta touch + scroll (Wave4)", () => {
  it("keeps Beta nav targets at 44px without a stale dock-clearance inset", () => {
    const { container } = renderSidebar();
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside).not.toBeNull();
    expect(aside.className).not.toMatch(/pb-20/);
    const btn = screen.getByRole("button", { name: "Calculadora" });
    expect(btn.className).toMatch(/min-h-11/);
  });

  it("widens the collapsed Beta rail so targets clear 44px", () => {
    const { container } = render(
      <StudioSidebar
        activeTab={"calculator" as Tab}
        onTabChange={vi.fn()}
        collapsed
        onToggleCollapse={vi.fn()}
        currency="BRL"
        onCurrencyChange={vi.fn()}
      />,
    );
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).toMatch(/w-\[68px\]/);
    expect(aside.className).not.toMatch(/(^|\s)w-16(\s|$)/);
  });

  it("keeps currency + collapse reachable via internal scroll at short heights", () => {
    const { container } = renderSidebar();
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).not.toMatch(/justify-between|pb-20/);
    expect(aside.className).toMatch(/h-\[calc\(100vh-92px\)\]/);
    const scroller = aside.querySelector(
      ".flex-1.min-h-0.overflow-y-auto",
    ) as HTMLElement;
    expect(scroller).not.toBeNull();
    // Bottom bar is pinned outside the scroller so it never scrolls away.
    const bottom = aside.lastElementChild as HTMLElement;
    expect(bottom.className).toMatch(/shrink-0/);
    expect(screen.getByText("Moeda Base")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recolher painel/i }),
    ).toBeInTheDocument();
  });
});

describe("StudioLayout Beta shell spacing", () => {
  it("does not reserve space for the in-flow Beta dock", () => {
    render(<StudioLayout />);
    expect(screen.getByRole("main")).not.toHaveClass("pb-24");
  });
});
