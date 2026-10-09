import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR" },
  }),
}));

import { StudioSidebar } from "./StudioSidebar";
import { StudioSubHeader } from "./StudioSubHeader";
import { StudioHeader } from "./StudioHeader";

function renderSidebar(collapsed = false): void {
  render(
    <StudioSidebar
      activeTab="calculator"
      onTabChange={vi.fn()}
      collapsed={collapsed}
      onToggleCollapse={vi.fn()}
    />,
  );
}

describe("StudioSubHeader global controls", () => {
  it("leaves module navigation and global controls to their single owners", () => {
    render(<StudioSubHeader onOpenQuoteModal={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Calculadora" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Modo Foco" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mini-Dash/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "IA" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "R$" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Clássico" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Orçamento" }),
    ).toBeInTheDocument();
  });

  it("keeps every Stable destination reachable from the sidebar rail", () => {
    renderSidebar(true);

    for (const label of [
      "Calculadora",
      "Dashboard",
      "Calc. Infill",
      "Insumos",
      "Cadastros",
      "Histórico",
      "Orçamentos",
      "Clientes",
      "Produtos",
      "Privacidade",
      "Marketplace",
      "Documentação / Wiki",
      "Notas de Versão",
    ]) {
      const destination = screen.getByRole("button", { name: label });
      expect(destination).toHaveClass("min-h-11", "min-w-11");
    }
  });

  it("keeps global currency selection out of the sidebar", () => {
    renderSidebar();

    expect(screen.queryByText("Moeda Base")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Moeda base" }),
    ).not.toBeInTheDocument();
  });

  it("exposes currency selection in the global header", () => {
    render(
      <StudioHeader
        activeTab="calculator"
        onTabChange={vi.fn()}
        activeTechnology="fdm"
        onOpenQuoteModal={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "Moeda base" }),
    ).toBeInTheDocument();
  });
});
