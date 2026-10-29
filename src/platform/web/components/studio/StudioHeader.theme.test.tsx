import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioHeader } from "./StudioHeader";

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

describe("StudioHeader theme surfaces", () => {
  it("keeps the WhatsApp proposal accessible and labels it above mobile", () => {
    render(
      <StudioHeader
        activeTab="calculator"
        onTabChange={vi.fn()}
        activeTechnology="fdm"
        onOpenQuoteModal={vi.fn()}
      />,
    );

    const proposalButton = screen.getByRole("button", {
      name: "Proposta WhatsApp",
    });
    expect(proposalButton.className).toContain("min-h-11");
    expect(proposalButton.querySelector("span")?.className).toContain(
      "hidden sm:inline",
    );
  });

  it.each(["catalog", "marketplace"] as const)(
    "uses semantic surface and text tokens on the %s route",
    (activeTab) => {
      const { container } = render(
        <StudioHeader
          activeTab={activeTab}
          onTabChange={vi.fn()}
          activeTechnology="fdm"
          onOpenQuoteModal={vi.fn()}
        />,
      );

      expect(container.querySelector("header")).toHaveClass(
        "bg-[var(--color-bg-elevated)]",
        "border-[var(--color-border)]",
        "text-[var(--color-text-primary)]",
      );
    },
  );
});
