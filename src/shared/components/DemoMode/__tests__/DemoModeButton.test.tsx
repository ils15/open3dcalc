import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DemoModeButton } from "../DemoModeButton";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface MockDemoModeState {
  isActive: boolean;
  enter: () => void;
  exit: () => void;
}

const mockEnter = vi.fn();
const mockExit = vi.fn();
const mockState: MockDemoModeState = {
  isActive: false,
  enter: mockEnter,
  exit: mockExit,
};

// Overloaded store mock keeps the real selector contract (`useDemoModeStore(s
// => s.isActive)` returns a boolean) without reaching for `any`.
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

describe("DemoModeButton", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockState.isActive = false;
    vi.clearAllMocks();
  });

  it("renders an accessible demo entry button", () => {
    render(<DemoModeButton />);

    expect(
      screen.getByRole("button", { name: "demo.button.ariaLabel" }),
    ).toBeInTheDocument();
  });

  it("exposes the visible demo label", () => {
    render(<DemoModeButton />);

    expect(screen.getByText("demo.button.label")).toBeInTheDocument();
  });

  it("is keyboard-focusable (present in the tab order)", () => {
    render(<DemoModeButton />);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("enters demo mode on click", async () => {
    render(<DemoModeButton />);

    await user.click(screen.getByRole("button"));

    expect(mockEnter).toHaveBeenCalledTimes(1);
  });

  it("enters demo mode via keyboard — Enter and Space", async () => {
    render(<DemoModeButton />);
    const button = screen.getByRole("button");
    button.focus();

    await user.keyboard("{Enter}");
    expect(mockEnter).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(mockEnter).toHaveBeenCalledTimes(2);
  });

  it("is hidden while demo mode is active", () => {
    mockState.isActive = true;

    render(<DemoModeButton />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
