import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";
import i18n from "@/shared/i18n/i18n";
import { StudioSidebar } from "./StudioSidebar";

describe("StudioSidebar", () => {
  it.each([
    ["en-US", "Expand sidebar", "Collapse sidebar"],
    ["pt-BR", "Expandir painel", "Recolher painel"],
  ])(
    "gives the %s collapse toggle a localized accessible name and state",
    async (locale, expandLabel, collapseLabel) => {
      const previousLanguage = i18n.language;
      await i18n.changeLanguage(locale);
      const props = {
        activeTab: "marketplace" as Tab,
        onTabChange: vi.fn(),
        onToggleCollapse: vi.fn(),
        currency: "USD",
        onCurrencyChange: vi.fn(),
      };
      const { rerender } = render(<StudioSidebar {...props} collapsed />);

      try {
        const expandButton = screen.getByRole("button", {
          name: expandLabel,
        });
        expect(expandButton).toHaveAttribute("aria-expanded", "false");

        rerender(<StudioSidebar {...props} collapsed={false} />);

        expect(
          screen.getByRole("button", { name: collapseLabel }),
        ).toHaveAttribute("aria-expanded", "true");
      } finally {
        await i18n.changeLanguage(previousLanguage);
      }
    },
  );

  it("keeps keyboard focus visible with semantic colors in either theme", async () => {
    const user = userEvent.setup();
    render(
      <StudioSidebar
        activeTab={"marketplace" as Tab}
        onTabChange={vi.fn()}
        collapsed={false}
        onToggleCollapse={vi.fn()}
        currency="USD"
        onCurrencyChange={vi.fn()}
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
