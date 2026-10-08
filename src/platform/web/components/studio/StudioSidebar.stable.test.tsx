import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

import { StudioSidebar } from "./StudioSidebar";

function renderSidebar(collapsed = false) {
  return render(
    <StudioSidebar
      activeTab={"calculator" as Tab}
      onTabChange={vi.fn()}
      collapsed={collapsed}
      onToggleCollapse={vi.fn()}
      currency="BRL"
      onCurrencyChange={vi.fn()}
    />,
  );
}

describe("StudioSidebar Stable layout unchanged", () => {
  it("omits Beta-only touch sizing so Stable heights are untouched", () => {
    renderSidebar();
    const btn = screen.getByRole("button", { name: "Calculadora" });
    expect(btn.className).not.toMatch(/min-h-11/);
    const toggle = screen.getByRole("button", {
      name: /recolher painel|expandir painel/i,
    });
    expect(toggle.className).not.toMatch(/min-h-11/);
  });

  it("keeps the Stable collapsed rail at w-16", () => {
    const { container } = renderSidebar(true);
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).toMatch(/(^|\s)w-16(\s|$)/);
    expect(aside.className).not.toMatch(/w-\[68px\]/);
  });

  it("preserves the Stable dock clearance and original sidebar structure", () => {
    const { container } = renderSidebar();
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).toBe(
      "bg-surface-raised border-r border-border-subtle flex flex-col justify-between select-none shrink-0 transition-all duration-200 z-30 sticky top-0 h-screen pb-20 w-56",
    );
    expect(aside.className).toMatch(/(^|\s)justify-between(\s|$)/);
    expect(aside.className).toMatch(/(^|\s)pb-20(\s|$)/);
    expect(aside.className).toMatch(/(^|\s)h-screen(\s|$)/);
    expect(aside.querySelector(".flex-1.min-h-0.overflow-y-auto")).toBeNull();
    const sidebarTop = aside.firstElementChild as HTMLElement;
    expect(sidebarTop.hasAttribute("class")).toBe(false);
    expect(sidebarTop.className).toBe("");
    expect(sidebarTop.firstElementChild).toHaveClass("h-12");
    const sidebarBottom = aside.lastElementChild as HTMLElement;
    expect(sidebarBottom).toHaveClass("p-3");
    expect(sidebarBottom).not.toHaveClass("shrink-0");
    expect(aside.lastElementChild).not.toHaveClass("shrink-0");
    expect(screen.getByText("Moeda Base")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recolher painel/i }),
    ).toBeInTheDocument();
  });
});
