import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mutable holder so a single module mock can exercise both flag branches.
const betaFlag = vi.hoisted(() => ({ current: true }));

vi.mock("@/shared/config/betaChannel", () => ({
  get isBetaChannel(): boolean {
    return betaFlag.current;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { BetaBadge } from "../BetaBadge";

describe("BetaBadge", () => {
  it("renders the badge when the beta channel is enabled", () => {
    betaFlag.current = true;
    render(<BetaBadge />);

    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText("betaBadge.text")).toBeInTheDocument();
    expect(badge).toHaveAttribute("aria-label", "betaBadge.ariaLabel");
  });

  // D1: the badge used to carry `hidden … sm:inline-flex`, so it disappeared
  // below the 640px breakpoint. The root must never be display:none — on small
  // screens it collapses to icon-only instead of vanishing.
  it("stays visible below the sm breakpoint (mobile regression guard)", () => {
    betaFlag.current = true;
    render(<BetaBadge />);

    const badge = screen.getByRole("status");
    expect(badge).not.toHaveClass("hidden");
    expect(badge).toHaveClass("inline-flex");
  });

  it("renders nothing on stable builds (beta channel disabled)", () => {
    betaFlag.current = false;
    render(<BetaBadge />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("betaBadge.text")).toBeNull();
  });
});
