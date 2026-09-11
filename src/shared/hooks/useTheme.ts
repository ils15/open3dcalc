import { useCallback, useEffect, useState } from "react";
import { guardedStorage } from "@/shared/lib/manifestStorage";

export type Theme = "light" | "dark";

const STORAGE_KEY = "open3dcalc_theme";

function getSystemPreference(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = guardedStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  return null;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
  root.setAttribute("color-scheme", theme);
}

function persistTheme(theme: Theme) {
  try {
    guardedStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Initialize theme synchronously BEFORE React renders.
 * Call this in main.tsx before createRoot().render().
 */
export function initTheme(): Theme {
  const stored = getStoredTheme();
  const theme = stored ?? getSystemPreference();
  applyTheme(theme);
  return theme;
}

/**
 * React hook for theme management.
 * Returns the current theme and a toggle function.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme();
    return stored ?? getSystemPreference();
  });

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      const stored = getStoredTheme();
      // Only auto-switch if user hasn't explicitly chosen a theme
      if (!stored) {
        const newTheme = e.matches ? "light" : "dark";
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    persistTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
