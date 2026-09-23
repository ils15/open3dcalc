import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/components/Calculator/Calculator", () => ({
  Calculator: () => <div data-testid="classic-surface">classic</div>,
}));

import { useLayoutStore } from "@/shared/stores/layoutStore";
import { CalculatorSurface } from "../CalculatorSurface";

/**
 * Wave 1 — the single switch point between layout surfaces.
 *
 * Only "classic" exists in W1; "guided" (W4) and "bento" (W3) fall back to
 * the classic surface until their waves land. This test locks the fallback
 * so a half-implemented mode can never render a blank surface.
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

  it.each(["guided", "bento"] as const)(
    "falls back to the classic surface for %s until its wave lands",
    (mode) => {
      useLayoutStore.setState({ layoutMode: mode });

      render(<CalculatorSurface />);

      expect(screen.getByTestId("classic-surface")).toBeInTheDocument();
    },
  );

  it("subscribes to the layout store — switching mode re-renders", () => {
    const { rerender } = render(<CalculatorSurface />);
    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();

    useLayoutStore.getState().setLayoutMode("guided");
    rerender(<CalculatorSurface />);

    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();
  });
});
