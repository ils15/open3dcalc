import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DemoModeIndicator } from "../DemoModeIndicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface MockDemoModeState {
  isActive: boolean;
  enter: () => void;
  exit: () => void;
}

const mockExit = vi.fn();
const mockState: MockDemoModeState = {
  isActive: false,
  enter: vi.fn(),
  exit: mockExit,
};

// Overloaded store mock preserves the real selector contract without `any`.
function mockDemoModeStore(): MockDemoModeState;
function mockDemoModeStore<T>(selector: (state: MockDemoModeState) => T): T;
function mockDemoModeStore(
  selector?: (state: MockDemoModeState) => unknown,
): unknown {
  return selector ? selector(mockState) : mockState;
}

vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(mockDemoModeStore, {
    getState: () => mockState,
  }),
}));

describe("DemoModeIndicator", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockState.isActive = false;
    vi.clearAllMocks();
  });

  it("renders nothing while the demo is inactive", () => {
    render(<DemoModeIndicator />);

    expect(screen.queryByText("demo.indicator.title")).not.toBeInTheDocument();
  });

  it("renders the title and description while the demo is active", () => {
    mockState.isActive = true;

    render(<DemoModeIndicator />);

    expect(screen.getByText("demo.indicator.title")).toBeInTheDocument();
    expect(screen.getByText("demo.indicator.description")).toBeInTheDocument();
  });

  it("exposes the banner as a labelled region landmark", () => {
    mockState.isActive = true;

    render(<DemoModeIndicator />);

    expect(
      screen.getByRole("region", { name: "demo.indicator.title" }),
    ).toBeInTheDocument();
  });

  it("exits the demo on click", async () => {
    mockState.isActive = true;

    render(<DemoModeIndicator />);

    await user.click(
      screen.getByRole("button", { name: "demo.indicator.exitAriaLabel" }),
    );

    expect(mockExit).toHaveBeenCalledTimes(1);
  });

  it("exits the demo via keyboard — Enter and Space", async () => {
    mockState.isActive = true;

    render(<DemoModeIndicator />);
    screen.getByRole("button").focus();

    await user.keyboard("{Enter}");
    expect(mockExit).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(mockExit).toHaveBeenCalledTimes(2);
  });

  it("moves keyboard focus to the exit button when it appears", () => {
    const { rerender } = render(<DemoModeIndicator />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    mockState.isActive = true;
    rerender(<DemoModeIndicator />);

    expect(
      screen.getByRole("button", { name: "demo.indicator.exitAriaLabel" }),
    ).toHaveFocus();
  });

  it("keeps an existing focus instead of stealing it", () => {
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    const { rerender } = render(<DemoModeIndicator />);
    mockState.isActive = true;
    rerender(<DemoModeIndicator />);

    expect(elsewhere).toHaveFocus();

    elsewhere.remove();
  });
});
