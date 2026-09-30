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

  it("never shrinks, and keeps a 44px target", () => {
    // The toggle moved into the utility band, whose row is `flex-1` with a
    // definite width. In the header it was a child of a `shrink-0` cluster, so
    // nothing inside it could be compressed; in the band that protection is
    // gone unless the control carries it itself. Asserted on the real
    // component here, because the chrome suites stub this one out.
    renderToggle();
    const button = screen.getByRole("button");
    expect(button.className).toContain("shrink-0");
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("min-w-[44px]");
  });
});
