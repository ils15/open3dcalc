import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";
import { WorkshopHub } from "../WorkshopHub";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../CatalogTab", () => ({
  CatalogTab: ({ activeSection }: { activeSection: string }) => (
    <div data-testid="catalog-section">{activeSection}</div>
  ),
}));

vi.mock("@/shared/components/SpoolShelf/SpoolShelf", () => ({
  SpoolShelf: () => <div data-testid="stock-section" />,
}));

function renderHub(activeTab: Tab) {
  return render(<WorkshopHub activeTab={activeTab} onTabChange={vi.fn()} />);
}

describe("WorkshopHub", () => {
  it("opens stock from the legacy inventory route", () => {
    renderHub("inventory");

    expect(screen.getByRole("tab", { name: "workshop.stock" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("stock-section")).toBeInTheDocument();
  });

  it("opens seller fee profiles from the legacy Marketplace route", () => {
    renderHub("marketplace");

    expect(
      screen.getByRole("tab", { name: "workshop.salesChannels" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("catalog-section")).toHaveTextContent(
      "marketplaces",
    );
  });

  it("switches to materials inside the same workshop destination", () => {
    const onTabChange = vi.fn();
    render(<WorkshopHub activeTab="catalog" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "workshop.materials" }));

    expect(onTabChange).toHaveBeenCalledWith("catalog");
    expect(screen.getByTestId("catalog-section")).toHaveTextContent(
      "materials",
    );
  });
});
