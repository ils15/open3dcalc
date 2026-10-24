import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainContent } from "../MainContent";

vi.mock("@/shared/components/Catalog/WorkshopHub", () => ({
  WorkshopHub: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="workshop-hub-route">{activeTab}</div>
  ),
}));

describe("shared workshop routes", () => {
  it("opens sales-channel settings for the legacy Marketplace route", () => {
    render(
      <MainContent
        activeTab="marketplace"
        onTabChange={vi.fn()}
        onSelectCalculator={vi.fn()}
      />,
    );

    expect(screen.getByTestId("workshop-hub-route")).toHaveTextContent(
      "marketplace",
    );
  });
});
