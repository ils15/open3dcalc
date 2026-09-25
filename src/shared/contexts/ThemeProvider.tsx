import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useTheme } from "@/shared/hooks/useTheme";
import { ThemeActionsContext, ThemeValueContext } from "./ThemeContext";
import type { ThemeActions } from "./ThemeContext";

interface ThemeProviderProps {
  children: ReactNode;
}

/** Shares the existing theme hook through split state/action contexts. */
export function ThemeProvider({
  children,
}: ThemeProviderProps): React.ReactElement {
  const { theme, setTheme, toggleTheme } = useTheme();
  const currentToggle = useRef(toggleTheme);

  useEffect(() => {
    currentToggle.current = toggleTheme;
  }, [toggleTheme]);

  const stableToggleTheme = useCallback((): void => {
    currentToggle.current();
  }, []);
  const actions = useMemo<ThemeActions>(
    () => ({ setTheme, toggleTheme: stableToggleTheme }),
    [setTheme, stableToggleTheme],
  );

  return (
    <ThemeValueContext.Provider value={theme}>
      <ThemeActionsContext.Provider value={actions}>
        {children}
      </ThemeActionsContext.Provider>
    </ThemeValueContext.Provider>
  );
}
