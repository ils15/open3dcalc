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

describe("StudioSidebar Stable layout", () => {
  it("keeps Stable navigation targets at least 44px", () => {
    renderSidebar();
    const btn = screen.getByRole("button", { name: "Calculadora" });
    expect(btn).toHaveClass("min-h-11", "min-w-11");
    const toggle = screen.getByRole("button", {
      name: /recolher painel|expandir painel/i,
    });
    expect(toggle).toHaveClass("min-h-11", "min-w-11");
  });

  it("keeps the Stable collapsed rail wide enough for 44px targets", () => {
    const { container } = renderSidebar(true);
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).toMatch(/(^|\s)w-\[68px\](\s|$)/);
  });

  it("scrolls navigation inside the Stable dock-safe workspace", () => {
    const { container } = renderSidebar();
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).toBe(
      "bg-surface-raised border-r border-border-subtle flex flex-col select-none shrink-0 transition-all duration-200 z-30 h-full min-h-0 overflow-hidden w-56",
    );
    expect(aside.className).toMatch(/(^|\s)h-full(\s|$)/);
    expect(aside.className).toMatch(/(^|\s)overflow-hidden(\s|$)/);
    expect(
      aside.querySelector(".flex-1.min-h-0.overflow-y-auto"),
    ).not.toBeNull();
    const sidebarTop = aside.firstElementChild as HTMLElement;
    expect(sidebarTop).toHaveClass("flex-1", "min-h-0", "overflow-y-auto");
    expect(sidebarTop.firstElementChild).toHaveClass("h-12");
    const sidebarBottom = aside.lastElementChild as HTMLElement;
    expect(sidebarBottom).toHaveClass("p-3", "shrink-0");
    expect(screen.getByText("Moeda Base")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recolher painel/i }),
    ).toBeInTheDocument();
  });
});
