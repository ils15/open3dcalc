import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";
import { StudioSidebar } from "./StudioSidebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR" },
  }),
}));

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

    const workshopButton = screen.getByRole("button", {
      name: "nav.catalog",
    });
    for (
      let index = 0;
      index < 30 && !workshopButton.matches(":focus");
      index += 1
    ) {
      await user.tab();
    }

    expect(workshopButton).toHaveFocus();
    expect(workshopButton).toHaveAttribute("aria-current", "page");
    expect(workshopButton).toHaveClass("focus-visible:ring-2");
    expect(workshopButton).toHaveClass(
      "focus-visible:ring-[var(--color-accent)]",
    );
    expect(workshopButton).toHaveClass("focus-visible:ring-offset-2");
    expect(workshopButton).toHaveClass(
      "focus-visible:ring-offset-[var(--color-bg-primary)]",
    );
    const focusClasses = workshopButton.className
      .split(" ")
      .filter((className) => className.startsWith("focus-visible:"));
    expect(focusClasses.join(" ")).not.toMatch(/blue-|#[\da-f]{3,8}/i);
  });
});
