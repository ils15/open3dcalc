import type { ReactNode } from "react";

import { CurrencyProvider } from "./CurrencyProvider";
import { ThemeProvider } from "./ThemeProvider";

interface PreferenceProviderProps {
  children: ReactNode;
}

/** Shared preference façades; NavigationProvider remains independently scoped. */
export function PreferenceProvider({
  children,
}: PreferenceProviderProps): React.ReactElement {
  return (
    <CurrencyProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </CurrencyProvider>
  );
}
