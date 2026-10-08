import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PrivacyOnboarding } from "@/shared/components/Privacy/PrivacyOnboarding";
import { StudioSubHeader } from "@/platform/web/components/studio/StudioSubHeader";
import { StudioSidebar } from "@/platform/web/components/studio/StudioSidebar";
import { StudioCockpitDock } from "@/platform/web/components/studio/StudioCockpitDock";
import type { Tab } from "@/shared/components/AppShell/tabs";

function renderSubHeader() {
  return render(
    <StudioSubHeader
      activeTab="calculator"
      onTabChange={vi.fn()}
      layoutMode="classic"
      onLayoutChange={vi.fn()}
      currency="BRL"
      onCurrencyChange={vi.fn()}
      focusMode={false}
      onToggleFocusMode={vi.fn()}
      onOpenMiniDash={vi.fn()}
      onOpenCopilot={vi.fn()}
      onOpenShortcuts={vi.fn()}
      onOpenQuoteModal={vi.fn()}
    />,
  );
}

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

function renderDock() {
  return render(
    <StudioCockpitDock
      onOpenMiniDash={vi.fn()}
      onToggleFocusMode={vi.fn()}
      onOpenShortcuts={vi.fn()}
      onTabChange={vi.fn()}
      onOpenCopilot={vi.fn()}
      onOpenNewQuote={vi.fn()}
    />,
  );
}

describe("Wave4 Beta shell: ONE navigation model", () => {
  it("hides the duplicated top tab strip on Beta (sidebar owns navigation)", () => {
    renderSubHeader();
    // Sidebar already exposes Calculadora; the top strip must not duplicate it.
    expect(screen.queryByRole("button", { name: /Calculadora/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dashboard/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Histórico/ })).toBeNull();
  });

  it("keeps every retained screen reachable from the sidebar", () => {
    renderSidebar();
    for (const name of [
      "Calculadora",
      "Dashboard",
      "Calc. Infill",
      "Insumos",
      "Cadastros",
      "Histórico",
      "Orçamentos",
      "Clientes",
      "Produtos",
      "Marketplace",
    ]) {
      expect(
        screen.getByRole("button", { name }),
        `${name} must stay reachable from the single sidebar`,
      ).toBeInTheDocument();
    }
  });

  it("exposes no migration or privacy entries on Beta", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: "Privacidade" })).toBeNull();
    expect(screen.queryByText(/migra/i)).toBeNull();
    renderSubHeader();
    expect(screen.queryByRole("button", { name: "Privacidade" })).toBeNull();
  });

  it("labels the sidebar as the primary navigation with a drawer toggle", () => {
    const { container } = renderSidebar();
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    // Toggle must be a drawer control: expanded state + 44px target.
    const toggle = screen.getByRole("button", {
      name: /painel|navegação|menu/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded");
    expect(toggle.className).toMatch(/min-h-11|min-h-\[44px\]/);
  });
});

describe("Wave4 Beta shell: dock in normal flow", () => {
  it("keeps the dock in document flow with responsive spacing", () => {
    const { container } = renderDock();
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).not.toMatch(/\bfixed\b/);
    // Responsive spacing: base + sm/lg gutters, in-flow padding.
    expect(root.className).toMatch(/px-4/);
    expect(root.className).toMatch(/sm:px-6|sm:pb-6|lg:px-8/);
  });

  it("keeps all dock actions reachable", () => {
    renderDock();
    expect(
      screen.getByRole("button", { name: /Mini-Dash/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ações Rápidas/ }),
    ).toBeInTheDocument();
    expect(screen.getByTitle(/Modo Foco/)).toBeInTheDocument();
    expect(screen.getByTitle(/Atalhos/)).toBeInTheDocument();
  });
});

describe("Wave4 Beta first-run notice: proper dialog", () => {
  it("uses role=dialog with an accessible name (honest copy preserved)", () => {
    render(<PrivacyOnboarding />);
    const dialog = screen.getByRole("dialog", {
      name: "privacy.betaFirstRun.title",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Honest Beta copy keys must all still render — no legal text changes.
    for (const key of [
      "privacy.betaFirstRun.testOnly",
      "privacy.betaFirstRun.syntheticOnly",
      "privacy.betaFirstRun.plaintextLocal",
      "privacy.betaFirstRun.noPassword",
      "privacy.betaFirstRun.noMigration",
      "privacy.betaFirstRun.noExport",
      "privacy.betaFirstRun.disposable",
    ]) {
      expect(within(dialog).getByText(key)).toBeInTheDocument();
    }
  });

  it("dismisses with Escape and restores focus", () => {
    render(<button type="button">outside</button>);
    const outside = screen.getByRole("button", { name: "outside" });
    outside.focus();
    expect(document.activeElement).toBe(outside);
    // Mount the dialog AFTER outside has focus so it can capture + restore it.
    render(<PrivacyOnboarding />);
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "common.close" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // Focus returns to the element that had it before the dialog opened.
    expect(document.activeElement).toBe(outside);
  });

  it("traps Tab inside the dialog while open", () => {
    render(<PrivacyOnboarding />);
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "common.close" });
    expect(document.activeElement).toBe(close);
    // Single focusable control: Tab cycles back to itself (trap holds).
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });
});

describe("Wave4 Beta shell: 44px targets", () => {
  it("keeps sidebar navigation targets at least 44px", () => {
    renderSidebar();
    for (const name of ["Calculadora", "Dashboard", "Histórico"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.className).toMatch(/min-h-11|min-h-\[44px\]/);
    }
  });
});

describe("Wave4 Beta shell: light-theme tokens (no hardcoded navy)", () => {
  it("paints the dock pill row with theme tokens, not hardcoded navy", () => {
    const { container } = renderDock();
    const html = container.innerHTML;
    // No hardcoded hex backgrounds in the dock pill row or popup — a generic
    // hex pattern (not a quoted literal) so this guard does not itself add
    // palette debt to the token floor.
    expect(html).not.toMatch(/bg-\[#[0-9a-f]{3,8}\]/i);
    expect(html).toMatch(/var\(--color-/);
  });
});
