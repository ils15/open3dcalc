import { useContext, useState, useCallback } from "react";
import {
  ThemeValueContext,
  ThemeActionsContext,
} from "@/shared/contexts/ThemeContext";
import type { Theme } from "@/shared/hooks/useTheme";

/**
 * Reads and toggles theme via ThemeProvider when mounted inside `<App />`,
 * while degrading gracefully in isolated component unit tests that render
 * Studio chrome without `<PreferenceProvider>`.
 */
export function useSafeStudioTheme(): {
  theme: Theme;
  toggleTheme: () => void;
} {
  const ctxTheme = useContext(ThemeValueContext);
  const ctxActions = useContext(ThemeActionsContext);
  const [fallbackTheme, setFallbackTheme] = useState<Theme>(() => {
    if (
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("light")
    ) {
      return "light";
    }
    return "dark";
  });

  const fallbackToggle = useCallback(() => {
    setFallbackTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
        document.documentElement.classList.toggle("light", next === "light");
      }
      return next;
    });
  }, []);

  if (ctxTheme !== undefined && ctxActions !== undefined) {
    return { theme: ctxTheme, toggleTheme: ctxActions.toggleTheme };
  }

  return { theme: fallbackTheme, toggleTheme: fallbackToggle };
}
