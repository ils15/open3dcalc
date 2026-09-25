import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Calculator } from "../Calculator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T,>(selector: (state: T) => T) => selector,
}));

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: (
    selector?: (state: Record<string, unknown>) => unknown,
  ) => {
    const state = {
      activeTab: "fdm",
      undo: () => undefined,
      setSelectedPrinter: () => undefined,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/shared/stores/catalogStore", () => ({
  useCatalogStore: (
    selector?: (state: Record<string, unknown>) => unknown,
  ) => {
    const state = { printers: [], materials: [] };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/shared/stores/filamentInventory", () => ({
  useFilamentInventory: (
    selector?: (state: Record<string, unknown>) => unknown,
  ) => {
    const state = { spools: [] };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({ symbol: "R$" }),
}));

vi.mock("@/shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => undefined,
}));

vi.mock("@/shared/components/ui/Toast", () => ({
  ToastContainer: () => null,
}));

vi.mock("@/shared/components/ui/QuickStartBanner", () => ({
  QuickStartBanner: () => null,
}));

vi.mock("@/shared/components/Results/ResultsPanel", () => ({
  ResultsPanel: () => <button type="button" data-testid="sidebar-control" />,
}));

vi.mock("../TechToggle", () => ({ TechToggle: () => null }));
vi.mock("../LevelToggle", () => ({ LevelToggle: () => null }));
vi.mock("../ProductName", () => ({ ProductName: () => null }));
vi.mock("../SectionNav", () => ({
  SectionNav: () => <button type="button" data-testid="nav-control" />,
}));
vi.mock("../SectionRenderer", () => ({
  SectionRenderer: () => <button type="button" data-testid="input-control" />,
}));

describe("Calculator layout order", () => {
  it("keeps real DOM, focus, and the right-column grid placement aligned", async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    const layout = screen.getByTestId("calculator-layout");
    const children = Array.from(layout.children);
    expect(children.map((child) => child.getAttribute("data-testid"))).toEqual([
      "calculator-section-nav",
      "results-sidebar",
      "calculator-inputs",
    ]);

    const sidebar = screen.getByTestId("results-sidebar");
    const inputs = screen.getByTestId("calculator-inputs");
    expect(sidebar.className).toContain("2xl:col-start-3");
    expect(inputs.className).toContain("col-start-2");
    expect(layout.className).toContain(
      "2xl:grid-cols-[auto_minmax(0,1fr)_360px]",
    );
    expect(sidebar.className).not.toContain("order-");
    expect(inputs.className).not.toContain("order-");

    await user.tab();
    expect(screen.getByTestId("nav-control")).toHaveFocus();
    for (const mode of ["compact", "tabs", "dock", "expanded"]) {
      await user.tab();
      expect(screen.getByTestId(`sidebar-mode-${mode}`)).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByTestId("sidebar-compact-chart")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("sidebar-compact-bars")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("sidebar-control")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("input-control")).toHaveFocus();
  });
});
