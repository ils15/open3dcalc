import { createContext, useContext } from "react";

import type { Theme } from "@/shared/hooks/useTheme";

export interface ThemeActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeValueContext = createContext<Theme | undefined>(undefined);
export const ThemeActionsContext = createContext<ThemeActions | undefined>(
  undefined,
);

/** Context façade for theme consumers; storage and system handling stay in useTheme. */
export function useThemeContext(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const theme = useContext(ThemeValueContext);
  const actions = useContext(ThemeActionsContext);

  if (theme === undefined || actions === undefined) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }

  return { theme, ...actions };
}

/** Action-only consumers don't subscribe to theme state changes. */
export function useThemeActions(): ThemeActions {
  const actions = useContext(ThemeActionsContext);
  if (!actions) {
    throw new Error("useThemeActions must be used within ThemeProvider");
  }
  return actions;
}
