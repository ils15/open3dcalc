import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "layoutSwitcher.guided" ? "Fluxo Guiado" : key,
  }),
}));

vi.mock("@/shared/components/Calculator/Calculator", () => ({
  Calculator: () => <div data-testid="classic-surface">classic</div>,
}));

vi.mock("@/shared/components/Wizard/GuidedWizard", () => ({
  GuidedWizard: () => <div data-testid="guided-wizard">guided</div>,
}));

vi.mock("../BentoSurface", () => ({
  BentoSurface: () => <div data-testid="bento-surface">bento</div>,
}));

import { useLayoutStore } from "@/shared/stores/layoutStore";
import { LayoutSwitcher } from "@/shared/components/Header/LayoutSwitcher";
import { CalculatorSurface } from "../CalculatorSurface";

/**
 * Wave 1 + W4 — the single switch point between layout surfaces.
 *
 * "classic", "guided" (W4 wizard), and "bento" (W3) each map to their dedicated
 * surface. The classic mode remains the safe fallback for unknown state.
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

    expect(screen.getByTestId("guided-wizard")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-surface")).not.toBeInTheDocument();
  });

  it("renders the guided wizard when the header control selects guided mode", async () => {
    const user = userEvent.setup();

    render(
      <>
        <LayoutSwitcher />
        <CalculatorSurface />
      </>,
    );

    await user.click(
      screen.getByRole("button", { name: "Fluxo Guiado" }),
    );

    expect(screen.getByTestId("guided-wizard")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-surface")).not.toBeInTheDocument();
  });

  it("renders the bento surface for the bento mode", () => {
    useLayoutStore.setState({ layoutMode: "bento" });

    render(<CalculatorSurface />);

    expect(screen.getByTestId("bento-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-surface")).not.toBeInTheDocument();
  });

  it("subscribes to the layout store — switching mode re-renders", () => {
    const { rerender } = render(<CalculatorSurface />);
    expect(screen.getByTestId("classic-surface")).toBeInTheDocument();

    useLayoutStore.getState().setLayoutMode("guided");
    rerender(<CalculatorSurface />);

    expect(screen.getByTestId("guided-wizard")).toBeInTheDocument();
  });
});
