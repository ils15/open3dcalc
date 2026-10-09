import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import { StudioSubHeader } from "./StudioSubHeader";

describe("StudioSubHeader Beta surface", () => {
  it("does not expose the privacy route", () => {
    render(<StudioSubHeader onOpenQuoteModal={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Privacidade" })).toBeNull();
  });
});
