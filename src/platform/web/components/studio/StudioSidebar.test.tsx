import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";
import { StudioSidebar } from "./StudioSidebar";

describe("StudioSidebar", () => {
  it("keeps keyboard focus visible with semantic colors in either theme", async () => {
    const user = userEvent.setup();
    render(
      <StudioSidebar
        activeTab={"marketplace" as Tab}
        onTabChange={vi.fn()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    const marketplaceButton = screen.getByRole("button", {
      name: "Marketplace",
    });
    for (
      let index = 0;
      index < 30 && !marketplaceButton.matches(":focus");
      index += 1
    ) {
      await user.tab();
    }

    expect(marketplaceButton).toHaveFocus();
    expect(marketplaceButton).toHaveClass("focus-visible:ring-2");
    expect(marketplaceButton).toHaveClass(
      "focus-visible:ring-[var(--color-accent)]",
    );
    expect(marketplaceButton).toHaveClass("focus-visible:ring-offset-2");
    expect(marketplaceButton).toHaveClass(
      "focus-visible:ring-offset-[var(--color-bg-primary)]",
    );
    const focusClasses = marketplaceButton.className
      .split(" ")
      .filter((className) => className.startsWith("focus-visible:"));
    expect(focusClasses.join(" ")).not.toMatch(/blue-|#[\da-f]{3,8}/i);
  });
});
