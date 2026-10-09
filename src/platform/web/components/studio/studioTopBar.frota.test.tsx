import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Frota-pattern contract for the Studio top-bar region (PR #280).
 *
 * The owner's reference is the Catalog tab ("Frota de Impressoras"): a
 * breadcrumb + title, pill-shaped filters, aligned actions, and cards whose
 * colours come exclusively from semantic tokens so both themes render
 * correctly. These tests lock the BEHAVIOUR of that pattern on the Studio
 * shell — contextual mode pills, module navigation, global currency, quick
 * actions — and its theme-responsiveness contract: a rendered className may
 * not contain a raw palette step, raw ink, or arbitrary hex, because none of
 * those flip with the theme (same rule as tokenOnlyColors.test.ts, asserted
 * at component level so a regression is caught where it renders).
 *
 * Behaviour tests only — no snapshots.
 */

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR" },
  }),
}));

vi.mock("@/shared/hooks/useDemoMode", () => ({
  useIsDemoMode: () => false,
}));

vi.mock("@/shared/components/DemoMode/DemoModeButton", () => ({
  DemoModeButton: () => null,
}));

import { StudioHeader } from "./StudioHeader";
import { StudioSidebar } from "./StudioSidebar";
import { StudioSubHeader } from "./StudioSubHeader";
import { StudioCalculatorModeSelector } from "./StudioCalculatorModeSelector";
import { StudioCockpitDock } from "./StudioCockpitDock";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState({ currency: "BRL" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function CurrencyValueProbe(): ReactElement {
  const { format } = useCurrency();
  return <output aria-label="Valor formatado">{format(1234.56)}</output>;
}

/** Palette/ink/hex literal — must not appear in any rendered className. */
const PALETTE_LITERAL =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?\d|-(?:white|black)\b|\[#[0-9a-f]{3,8}\]/i;

function expectThemeTokenOnly(container: HTMLElement): void {
  expect(container.innerHTML).toMatch(/var\(--/);
  expect(container.innerHTML).not.toMatch(PALETTE_LITERAL);
}

function renderSidebar(): {
  onTabChange: ReturnType<typeof vi.fn>;
  container: HTMLElement;
} {
  const onTabChange = vi.fn();
  const { container } = render(
    <StudioSidebar
      activeTab="calculator"
      onTabChange={onTabChange}
      collapsed={false}
      onToggleCollapse={vi.fn()}
    />,
  );
  return { onTabChange, container };
}

describe("StudioCalculatorModeSelector (calculator-context pills)", () => {
  it("switches layout modes from a single labelled pill group", () => {
    const onLayoutChange = vi.fn();
    render(
      <StudioCalculatorModeSelector
        mode="classic"
        onModeChange={onLayoutChange}
      />,
    );

    const group = screen.getByRole("group", { name: "Modo da calculadora" });
    const classic = within(group).getByRole("button", { name: "Clássico" });
    const bento = within(group).getByRole("button", { name: "Bento" });
    const guided = within(group).getByRole("button", { name: "Guiado" });

    expect(classic).toHaveAttribute("aria-pressed", "true");
    expect(bento).toHaveAttribute("aria-pressed", "false");
    expect(guided).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(guided);
    expect(onLayoutChange).toHaveBeenCalledWith("guided");
    fireEvent.click(bento);
    expect(onLayoutChange).toHaveBeenCalledWith("bento");
    fireEvent.click(classic);
    expect(onLayoutChange).toHaveBeenCalledWith("classic");
  });

  it("marks the active pill with the accent fill token, not a palette step", () => {
    render(
      <StudioCalculatorModeSelector mode="bento" onModeChange={vi.fn()} />,
    );

    const group = screen.getByRole("group", { name: "Modo da calculadora" });
    const active = within(group).getByRole("button", { name: "Bento" });
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active.className).toContain("bg-[var(--color-accent-fill)]");
    expect(active.className).toContain("text-[var(--color-accent-fill-fg)]");
  });

  it("renders the Orçamento action on the token accent fill", () => {
    const onOpenQuoteModal = vi.fn();
    render(<StudioSubHeader onOpenQuoteModal={onOpenQuoteModal} />);

    const quote = screen.getByRole("button", { name: "Orçamento" });
    fireEvent.click(quote);
    expect(onOpenQuoteModal).toHaveBeenCalledOnce();
    expect(quote.className).toContain("bg-[var(--color-accent-fill)]");
  });

  it("renders with semantic tokens only (no hardcoded dark)", () => {
    const { container } = render(
      <StudioSubHeader onOpenQuoteModal={vi.fn()} />,
    );
    expectThemeTokenOnly(container);
  });
});

describe("StudioSidebar shell (Frota breadcrumb-and-pill pattern)", () => {
  it("navigates modules on click and marks the active destination", () => {
    const { onTabChange } = renderSidebar();

    const catalog = screen.getByRole("button", { name: "Cadastros" });
    fireEvent.click(catalog);
    expect(onTabChange).toHaveBeenCalledWith("catalog");

    const calculator = screen.getByRole("button", { name: "Calculadora" });
    expect(calculator).toHaveAttribute("aria-current", "page");
  });

  it("renders with semantic tokens only (no hardcoded navy palette)", () => {
    const { container } = renderSidebar();
    expectThemeTokenOnly(container);
  });
});

describe("StudioHeader global currency control", () => {
  it("updates calculator formatting and persists a selected currency", () => {
    render(
      <>
        <StudioHeader
          activeTab="calculator"
          onTabChange={vi.fn()}
          activeTechnology="fdm"
          onOpenQuoteModal={vi.fn()}
        />
        <CurrencyValueProbe />
      </>,
    );

    expect(screen.getByLabelText("Valor formatado")).toHaveTextContent("R$");

    fireEvent.change(screen.getByRole("combobox", { name: "Moeda base" }), {
      target: { value: "USD" },
    });

    expect(useCalculatorStore.getState().currency).toBe("USD");
    expect(screen.getByLabelText("Valor formatado")).toHaveTextContent("$");
    expect(
      JSON.parse(localStorage.getItem("open3dcalc_settings_v2") ?? "{}"),
    ).toMatchObject({ currency: "USD" });
  });
});

describe("StudioCockpitDock quick actions (Frota aligned-action pattern)", () => {
  it("navigates to a module from the quick actions popup", () => {
    const onTabChange = vi.fn();
    render(
      <StudioCockpitDock
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onTabChange={onTabChange}
        onOpenCopilot={vi.fn()}
        onOpenNewQuote={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ações Rápidas/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar Impressora" }),
    );
    expect(onTabChange).toHaveBeenCalledWith("catalog");
  });

  it("renders with semantic tokens only (no hardcoded dark)", () => {
    const { container } = render(
      <StudioCockpitDock
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onTabChange={vi.fn()}
        onOpenCopilot={vi.fn()}
        onOpenNewQuote={vi.fn()}
      />,
    );
    expectThemeTokenOnly(container);
  });
});

describe("StudioHeader breadcrumb (Frota title pattern)", () => {
  it("shows the module title for the active tab", () => {
    render(
      <StudioHeader
        activeTab="catalog"
        onTabChange={vi.fn()}
        activeTechnology="fdm"
        onOpenQuoteModal={vi.fn()}
      />,
    );

    expect(screen.getByText("Frota de Impressoras")).toBeInTheDocument();
  });

  it("provides a global dashboard navigation landmark", () => {
    const onTabChange = vi.fn();
    render(
      <StudioHeader
        activeTab="calculator"
        onTabChange={onTabChange}
        activeTechnology="fdm"
        onOpenQuoteModal={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ir para o Dashboard" }),
    );
    expect(onTabChange).toHaveBeenCalledWith("dashboard");
  });

  it("renders with semantic tokens only (no palette icons)", () => {
    const { container } = render(
      <StudioHeader
        activeTab="calculator"
        onTabChange={vi.fn()}
        activeTechnology="fdm"
        onOpenQuoteModal={vi.fn()}
      />,
    );
    expectThemeTokenOnly(container);
  });
});
