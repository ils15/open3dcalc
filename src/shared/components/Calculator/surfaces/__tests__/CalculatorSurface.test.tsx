import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/components/Calculator/Calculator", () => ({
  Calculator: () => <div data-testid="classic-surface">classic</div>,
}));

vi.mock("@/shared/components/Calculator/surfaces/GuidedSurface", () => ({
  GuidedSurface: () => <div data-testid="guided-surface">guided</div>,
}));

import { useLayoutStore } from "@/shared/stores/layoutStore";
import { CalculatorSurface } from "../CalculatorSurface";

/**
 * Wave 1 + W4 — the single switch point between layout surfaces.
 *
 * "classic" and "guided" (W4 wizard) exist today; "bento" (W3) intentionally
 * falls back to the classic surface until its wave lands, so a persisted future
 * mode never renders a blank surface. This test locks the mapping and the
 * fallback.
 */

beforeEach(() => {
  localStorage.clear();
  useLayoutStore.setState({ layoutMode: "classic" });
});

describe("CalculatorSurface", () => {
  it("renders the classic surface by default", () => {
    render(<CalculatorSurface />);

    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();
  });

  it("renders the classic surface for the classic mode", () => {
    useLayoutStore.setState({ layoutMode: "classic" });

    render(<CalculatorSurface />);

    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();
  });

  it("renders the guided surface (W4) for the guided mode", () => {
    useLayoutStore.setState({ layoutMode: "guided" });

    render(<CalculatorSurface />);

    expect(screen.getByTestId("guided-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-surface")).not.toBeInTheDocument();
  });

  it("falls back to the classic surface for bento until W3 lands", () => {
    useLayoutStore.setState({ layoutMode: "bento" });

    render(<CalculatorSurface />);

    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();
  });

  it("subscribes to the layout store — switching mode re-renders", () => {
    const { rerender } = render(<CalculatorSurface />);
    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();

    useLayoutStore.getState().setLayoutMode("guided");
    rerender(<CalculatorSurface />);

    expect(screen.getByTestId("guided-surface")).toBeInTheDocument();
  });
});
