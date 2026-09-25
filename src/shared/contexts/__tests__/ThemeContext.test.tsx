import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeActions, useThemeContext } from "../ThemeContext";
import { ThemeProvider } from "../ThemeProvider";
import { initTheme } from "@/shared/hooks/useTheme";

const actionConsumerRenders = vi.fn();

function ThemeValue(): React.ReactElement {
  const { theme } = useThemeContext();
  return <span data-testid="theme">{theme}</span>;
}

function ThemeActions(): React.ReactElement {
  const { toggleTheme } = useThemeActions();
  actionConsumerRenders();

  return (
    <button type="button" onClick={toggleTheme}>
      Toggle theme
    </button>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    actionConsumerRenders.mockClear();
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it.each([
    ["dark", "dark"],
    ["light", "light"],
    ["system", "light"],
  ] as const)(
    "restores %s without replacing the saved preference",
    (mode, expectedTheme) => {
      localStorage.setItem("open3dcalc_theme", mode);

      expect(initTheme()).toBe(expectedTheme);
      expect(initTheme()).toBe(expectedTheme);

      render(
        <ThemeProvider>
          <ThemeValue />
          <ThemeActions />
        </ThemeProvider>,
      );

      expect(screen.getByTestId("theme")).toHaveTextContent(expectedTheme);
      expect(localStorage.getItem("open3dcalc_theme")).toBe(mode);

      const actionRendersBeforeChange = actionConsumerRenders.mock.calls.length;
      act(() => screen.getByRole("button", { name: "Toggle theme" }).click());

      expect(screen.getByTestId("theme")).toHaveTextContent(
        expectedTheme === "dark" ? "light" : "dark",
      );
      expect(actionConsumerRenders).toHaveBeenCalledTimes(
        actionRendersBeforeChange,
      );
    },
  );
});
