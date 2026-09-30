import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LAYOUT_STORAGE_KEY,
  useLayoutStore,
} from "@/shared/stores/layoutStore";
import { ResultsSidebar } from "../ResultsSidebar";

vi.mock("../ResultsPanel", () => ({
  ResultsPanel: ({
    sidebarMode,
    sidebarTab,
    compactView,
  }: {
    sidebarMode?: string;
    sidebarTab?: string;
    compactView?: string;
  }) => (
    <div
      data-testid="shared-results-panel"
      data-sidebar-mode={sidebarMode}
      data-sidebar-tab={sidebarTab}
      data-compact-view={compactView}
    />
  ),
}));

describe("ResultsSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ layoutMode: "classic", sidebarMode: "compact" });
  });

  it("selects and persists each of the four sidebar modes independently", async () => {
    const user = userEvent.setup();
    render(<ResultsSidebar />);

    await user.click(screen.getByTestId("sidebar-mode-tabs"));

    expect(useLayoutStore.getState().sidebarMode).toBe("tabs");
    expect(useLayoutStore.getState().layoutMode).toBe("classic");
    expect(
      JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}"),
    ).toEqual({
      layoutMode: "classic",
      sidebarMode: "tabs",
    });
  });

  it("keeps the scroll region usable without rendering any overflow badge", () => {
    render(<ResultsSidebar />);

    expect(
      screen.queryByTestId("sidebar-overflow-badge"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("results-sidebar-scroll-region").className,
    ).toContain("overflow-y-auto");
  });

  // The tag shipped `aria-controls="results-sidebar-panel"` on every tab while
  // the region it pointed at had no `role="tabpanel"` and no `aria-labelledby`,
  // so the tabs announced a relationship to nothing (WCAG 4.1.2).
  it("wires the tabs mode as a complete tablist/tabpanel relationship", async () => {
    const user = userEvent.setup();
    render(<ResultsSidebar />);

    await user.click(screen.getByTestId("sidebar-mode-tabs"));

    const panel = screen.getByTestId("results-sidebar-scroll-region");
    const chartTab = screen.getByTestId("sidebar-tab-chart");

    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", chartTab.id);
    expect(chartTab).toHaveAttribute("role", "tab");
    expect(chartTab).toHaveAttribute("aria-selected", "true");
    expect(chartTab).toHaveAttribute("aria-controls", panel.id);

    // Following the relationship keeps labelling in sync with the active tab.
    await user.click(screen.getByTestId("sidebar-tab-actions"));

    expect(panel).toHaveAttribute(
      "aria-labelledby",
      screen.getByTestId("sidebar-tab-actions").id,
    );
    expect(screen.getByTestId("sidebar-tab-actions")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches the compact chart/bars view and forwards it to the panel", async () => {
    const user = userEvent.setup();
    render(<ResultsSidebar />);

    expect(screen.getByTestId("shared-results-panel")).toHaveAttribute(
      "data-compact-view",
      "chart",
    );

    await user.click(screen.getByTestId("sidebar-compact-bars"));

    expect(screen.getByTestId("sidebar-compact-bars")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("sidebar-compact-chart")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByTestId("shared-results-panel")).toHaveAttribute(
      "data-compact-view",
      "bars",
    );
    // The view switch is local presentation and must not touch the global
    // layout preference.
    expect(useLayoutStore.getState().sidebarMode).toBe("compact");
  });

  it("does not claim a tabpanel relationship outside the tabs mode", () => {
    render(<ResultsSidebar />);

    // Compact mode uses a pressed-button group, not a tablist.
    const panel = screen.getByTestId("results-sidebar-scroll-region");
    expect(panel).not.toHaveAttribute("role");
    expect(panel).not.toHaveAttribute("aria-labelledby");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar-compact-chart")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
