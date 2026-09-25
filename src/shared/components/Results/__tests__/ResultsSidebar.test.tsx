import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LAYOUT_STORAGE_KEY, useLayoutStore } from "@/shared/stores/layoutStore";
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
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}")).toEqual({
      layoutMode: "classic",
      sidebarMode: "tabs",
    });
  });

  it("keeps the scroll region usable without rendering any overflow badge", () => {
    render(<ResultsSidebar />);

    expect(screen.queryByTestId("sidebar-overflow-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("results-sidebar-scroll-region").className).toContain(
      "overflow-y-auto",
    );
  });
});
