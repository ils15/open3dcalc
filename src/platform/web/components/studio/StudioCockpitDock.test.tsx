import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

import { StudioCockpitDock } from "./StudioCockpitDock";

describe("StudioCockpitDock Stable layout", () => {
  it("preserves the fixed dock and bottom inset", () => {
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

    expect(container.firstElementChild).toHaveClass(/\bfixed\b/);
    expect(container.firstElementChild).toHaveClass(/\bbottom-4\b/);
  });

  it("keeps the dock's primary controls at least 44px tall", () => {
    render(
      <StudioCockpitDock
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onTabChange={vi.fn()}
        onOpenCopilot={vi.fn()}
        onOpenNewQuote={vi.fn()}
      />,
    );

    for (const label of ["Mini-Dash", "Ações Rápidas"]) {
      const button = screen.getByRole("button", { name: new RegExp(label) });
      expect(button).toHaveClass(/min-h-11|min-h-\[44px\]/);
    }
  });

  it("keeps the Stable fixed-track spacing", () => {
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

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/\bfixed\b/);
    expect(root.className).toMatch(/inset-x-0/);
    expect(root.className).toMatch(/px-4/);
    expect(root.className).toMatch(/bottom-4/);
  });

  it("keeps every dock action reachable with theme tokens (no hardcoded navy)", () => {
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

    expect(
      screen.getByRole("button", { name: /Mini-Dash/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ações Rápidas/ }),
    ).toBeInTheDocument();
    expect(screen.getByTitle(/Modo Foco/)).toBeInTheDocument();
    expect(screen.getByTitle(/Atalhos/)).toBeInTheDocument();
    const html = container.innerHTML;
    // Generic hex pattern (not a quoted literal) so this assertion does not
    // itself add palette debt to the token floor.
    expect(html).not.toMatch(/bg-\[#[0-9a-f]{3,8}\]/i);
    expect(html).toMatch(/var\(--color-/);
  });

  it("reserves document space after the fixed dock for the last controls", () => {
    render(
      <StudioCockpitDock
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onTabChange={vi.fn()}
        onOpenCopilot={vi.fn()}
        onOpenNewQuote={vi.fn()}
      />,
    );

    const clearance = screen.getByTestId("cockpit-dock-clearance");
    expect(clearance).toHaveAttribute("aria-hidden", "true");
    expect(clearance).toHaveClass("h-[calc(6rem+env(safe-area-inset-bottom))]");
    expect(clearance.querySelector("button")).toBeNull();
  });

  it("keeps the global dock actions unique and reachable from quick actions", () => {
    const onOpenCopilot = vi.fn();
    render(
      <StudioCockpitDock
        onOpenMiniDash={vi.fn()}
        onToggleFocusMode={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onTabChange={vi.fn()}
        onOpenCopilot={onOpenCopilot}
        onOpenNewQuote={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Mini-Dash/ })).toHaveLength(
      1,
    );
    expect(screen.getAllByRole("button", { name: "Modo Foco" })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ações Rápidas/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Assistente IA de Impressão" }),
    );
    expect(onOpenCopilot).toHaveBeenCalledOnce();
  });
});
