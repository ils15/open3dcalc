import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainContent } from "../MainContent";

vi.mock("@/shared/components/Catalog/MarketplaceBrowseTab", () => ({
  MarketplaceBrowseTab: () => <div data-testid="catalog-marketplace-route" />,
}));

describe("shared Marketplace route", () => {
  it("renders the browse-only surface when the shared desktop shell selects Marketplace", () => {
    render(
      <MainContent activeTab="marketplace" onSelectCalculator={vi.fn()} />,
    );

    expect(screen.getByTestId("catalog-marketplace-route")).toBeInTheDocument();
  });
});
