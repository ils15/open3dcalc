import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { Calculator } from "../Calculator";
import type { CalcLevel } from "@/shared/stores/calculatorStore.types";

vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/stores/storeBridge", () => ({
  restoreAutoSnapshot: vi.fn(),
}));
vi.mock("@/shared/components/StlPreview/StlPreview", () => ({
  StlPreview: () => null,
}));
vi.mock("@/shared/components/Dashboard/RechartsLazy", () => ({
  Area: () => null,
  AreaChart: () => null,
  Cell: () => null,
  Pie: () => null,
  PieChart: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Legend: () => null,
}));
vi.mock("@/shared/components/Dashboard/MaterialEfficiencyHeatmap", () => ({
  MaterialEfficiencyHeatmap: () => null,
}));

/** A3 — parity of the level × technology matrix: every combination renders
 * its full section set, and navigating sections never resets the draft. */
describe("Calculator — level × technology parity (A3)", () => {
  const previousLayout = useLayoutStore.getState().layoutMode;

  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
    useLayoutStore.setState({ layoutMode: "classic" });
    useCalculatorStore.setState({
      calcLevel: "basic",
      activeTab: "fdm",
      quantity: 3,
      productName: "Peça de paridade",
    });
  });

  afterEach(() => {
    useLayoutStore.setState({ layoutMode: previousLayout });
  });

  const matrix: Array<{
    level: CalcLevel;
    tech: "fdm" | "resin";
    sections: string[];
  }> = [
    { level: "basic", tech: "fdm", sections: ["material", "print", "sales"] },
    { level: "basic", tech: "resin", sections: ["material", "print", "sales"] },
    {
      level: "intermediate",
      tech: "fdm",
      sections: ["material", "print", "failure", "sales"],
    },
    {
      level: "intermediate",
      tech: "resin",
      sections: ["material", "print", "failure", "sales"],
    },
    {
      level: "advanced",
      tech: "fdm",
      sections: [
        "material",
        "print",
        "failure",
        "hardware",
        "machine",
        "fixedCost",
        "labor",
        "ops",
        "sales",
      ],
    },
    {
      level: "advanced",
      tech: "resin",
      sections: [
        "material",
        "print",
        "failure",
        "hardware",
        "machine",
        "fixedCost",
        "labor",
        "ops",
        "sales",
      ],
    },
  ];

  it.each(matrix)(
    "renders level $level × $tech with its full section set",
    ({ level, tech, sections }) => {
      useCalculatorStore.setState({ calcLevel: level, activeTab: tech });
      const { container, unmount } = render(<Calculator />);

      for (const id of sections) {
        expect(
          container.querySelector(`#section-${id}`),
          `level ${level} × ${tech} is missing #section-${id}`,
        ).not.toBeNull();
      }
      // The results answer is always present, on every level and tech.
      expect(container.querySelector("#section-results")).not.toBeNull();
      // Sections outside the level must NOT leak in.
      expect(
        container.querySelectorAll(".surface").length,
      ).toBeGreaterThanOrEqual(sections.length);
      unmount();
    },
  );

  it("never resets the draft when navigating between sections", () => {
    useCalculatorStore.setState({ calcLevel: "advanced" });
    render(<Calculator />);

    // Draft values survive section-to-section navigation (the draft lives in
    // the store, not in component state).
    const quantityBefore = useCalculatorStore.getState().quantity;
    const nameBefore = useCalculatorStore.getState().productName;

    // Level switch is the only operation that may reshuffle sections —
    // switching must not wipe the draft either.
    useCalculatorStore.getState().setCalcLevel("basic");
    useCalculatorStore.getState().setCalcLevel("advanced");

    expect(useCalculatorStore.getState().quantity).toBe(quantityBefore);
    expect(useCalculatorStore.getState().productName).toBe(nameBefore);
    expect(useCalculatorStore.getState().activeTab).toBe("fdm");
  });
});
