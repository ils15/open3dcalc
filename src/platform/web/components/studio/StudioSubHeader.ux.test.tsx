import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

import { StudioSidebar } from "./StudioSidebar";
import { StudioSubHeader } from "./StudioSubHeader";

function renderSidebar(collapsed = false): void {
  render(
    <StudioSidebar
      activeTab="calculator"
      onTabChange={vi.fn()}
      collapsed={collapsed}
      onToggleCollapse={vi.fn()}
      currency="BRL"
      onCurrencyChange={vi.fn()}
    />,
  );
}

describe("StudioSubHeader global controls", () => {
  it("leaves module navigation and global controls to their single owners", () => {
    render(
      <StudioSubHeader
        activeTab="calculator"
        layoutMode="classic"
        onLayoutChange={vi.fn()}
        onOpenQuoteModal={vi.fn()}
      />,
    );

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
      screen.getByRole("button", { name: "Clássico" }),
    ).toBeInTheDocument();
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

  it("keeps base currency selection in the sidebar only", () => {
    renderSidebar();

    expect(screen.getByText("Moeda Base")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Moeda base BRL" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Moeda base USD" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });
});
