import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../ThemeToggle";
import { ThemeProvider } from "@/shared/contexts/ThemeProvider";

const mockToggleTheme = vi.fn();
let currentTheme = "dark";

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => ({ theme: currentTheme, toggleTheme: mockToggleTheme }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockToggleTheme.mockClear();
    currentTheme = "dark";
  });

  const renderToggle = () =>
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

  it("renders a button with aria-label", () => {
    renderToggle();
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label");
  });

  it("renders both sun and moon icons", () => {
    renderToggle();
    const sunIcon = document.querySelector(".lucide-sun");
    const moonIcon = document.querySelector(".lucide-moon");
    expect(sunIcon).toBeInTheDocument();
    expect(moonIcon).toBeInTheDocument();
  });

  it("calls toggleTheme on click", () => {
    renderToggle();
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("has accessible title matching aria-label", () => {
    renderToggle();
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title");
    expect(button.getAttribute("title")).toBe(
      button.getAttribute("aria-label"),
    );
  });

  it('shows "modo claro" in label when dark (action to switch)', () => {
    renderToggle();
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toContain("claro");
  });
});
