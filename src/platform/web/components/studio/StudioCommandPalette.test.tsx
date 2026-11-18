import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";
import { PreferenceProvider } from "@/shared/contexts/PreferenceProvider";
import { StudioCommandPalette } from "./StudioCommandPalette";
import { StudioHeader } from "./StudioHeader";
import { StudioSidebar } from "./StudioSidebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

vi.mock("@/shared/hooks/useDemoMode", () => ({
  useIsDemoMode: () => false,
}));

vi.mock("@/shared/components/DemoMode/DemoModeButton", () => ({
  DemoModeButton: () => null,
}));

function renderPalette(
  overrides: Partial<React.ComponentProps<typeof StudioCommandPalette>> = {},
) {
  const onClose = vi.fn();
  const onTabChange = vi.fn();
  const onOpenQuoteModal = vi.fn();
  const onOpenWhatsAppModal = vi.fn();
  const onOpenCopilot = vi.fn();
  const onOpenMiniDash = vi.fn();
  const onToggleFocusMode = vi.fn();
  const onOpenShortcuts = vi.fn();

  const utils = render(
    <PreferenceProvider>
      <StudioCommandPalette
        isOpen
        onClose={onClose}
        activeTab={"calculator" as Tab}
        onTabChange={onTabChange}
        onOpenQuoteModal={onOpenQuoteModal}
        onOpenWhatsAppModal={onOpenWhatsAppModal}
        onOpenCopilot={onOpenCopilot}
        onOpenMiniDash={onOpenMiniDash}
        onToggleFocusMode={onToggleFocusMode}
        onOpenShortcuts={onOpenShortcuts}
        {...overrides}
      />
    </PreferenceProvider>,
  );

  return {
    ...utils,
    onClose,
    onTabChange,
    onOpenQuoteModal,
    onOpenWhatsAppModal,
    onOpenCopilot,
    onOpenMiniDash,
    onToggleFocusMode,
    onOpenShortcuts,
  };
}

describe("StudioCommandPalette & modernized Studio navigation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders nothing when closed and exposes an accessible dialog when open", () => {
    const { rerender } = render(
      <StudioCommandPalette
        isOpen={false}
        onClose={vi.fn()}
        activeTab={"calculator" as Tab}
        onTabChange={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onOpenWhatsAppModal={vi.fn()}
        onOpenCopilot={vi.fn()}
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <StudioCommandPalette
        isOpen
        onClose={vi.fn()}
        activeTab={"calculator" as Tab}
        onTabChange={vi.fn()}
        onOpenQuoteModal={vi.fn()}
        onOpenWhatsAppModal={vi.fn()}
        onOpenCopilot={vi.fn()}
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Navegação & Comandos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listbox", { name: "Comandos disponíveis" }),
    ).toBeInTheDocument();
  });

  it("filters commands accent-insensitively and navigates via keyboard", () => {
    const { onTabChange, onClose } = renderPalette();

    const searchInput = screen.getByRole("textbox", {
      name: /Buscar módulos, modos, oficina ou ações/i,
    });
    fireEvent.change(searchInput, { target: { value: "orcamentos" } });

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options[0]).toHaveTextContent("Orçamentos & Propostas");

    fireEvent.keyDown(
      screen.getByRole("dialog", { name: "Navegação & Comandos" }),
      { key: "Enter" },
    );

    expect(onTabChange).toHaveBeenCalledWith("quotes");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("supports ArrowDown cycling and Escape dismissal", () => {
    const { onTabChange, onClose } = renderPalette();
    const dialog = screen.getByRole("dialog", { name: "Navegação & Comandos" });

    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });

    expect(onTabChange).toHaveBeenCalledWith("dashboard");
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("wires the StudioHeader quick search trigger and theme toggle", () => {
    const onOpenCommandPalette = vi.fn();
    render(
      <PreferenceProvider>
        <StudioHeader
          activeTab="calculator"
          onTabChange={vi.fn()}
          activeTechnology="fdm"
          onOpenQuoteModal={vi.fn()}
          onOpenCommandPalette={onOpenCommandPalette}
          currentProjectName="Suporte Articulado"
        />
      </PreferenceProvider>,
    );

    expect(screen.getByText("Suporte Articulado")).toBeInTheDocument();

    const cmdBtn = screen.getByRole("button", {
      name: /Abrir busca rápida e comandos/i,
    });
    fireEvent.click(cmdBtn);
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);

    const initialDark = document.documentElement.classList.contains("dark");
    const themeBtn = screen.getByRole("button", {
      name: /Alternar para modo/i,
    });
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(
      !initialDark,
    );
  });

  it("groups StudioSidebar destinations by domain and caps live count badges at 99+", () => {
    render(
      <StudioSidebar
        activeTab={"calculator" as Tab}
        onTabChange={vi.fn()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        modules={[
          {
            id: "quotes" as Tab,
            label: "nav.quotes",
            icon: <span />,
            countBadge: 12,
          },
          {
            id: "history" as Tab,
            label: "nav.history",
            icon: <span />,
            countBadge: 140,
          },
        ]}
      />,
    );

    const nav = document.getElementById("beta-sidebar-nav");
    expect(nav).not.toBeNull();
    expect(within(nav!).getByText("nav.groupProduction")).toBeInTheDocument();
    expect(within(nav!).getByText("nav.groupCommercial")).toBeInTheDocument();
    expect(within(nav!).getByText("nav.groupWorkshop")).toBeInTheDocument();

    const quotesBtn = within(nav!).getByRole("button", { name: /nav\.quotes/ });
    expect(quotesBtn).toHaveTextContent("12");

    const historyBtn = within(nav!).getByRole("button", {
      name: /nav\.history/,
    });
    expect(historyBtn).toHaveTextContent("99+");
  });
});
