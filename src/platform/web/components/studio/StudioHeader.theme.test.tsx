import { render } from "@testing-library/react";
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
