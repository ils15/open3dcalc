import { useCallback, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  CURRENCIES,
  formatCurrency,
  resolveCurrency,
} from "@/shared/lib/currency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CurrencyValue } from "./CurrencyContext";
import {
  CurrencySettingContext,
  CurrencyValueContext,
  SetCurrencyContext,
} from "./CurrencyContext";

interface CurrencyProviderProps {
  children: ReactNode;
}

/** Provides a derived currency view while Zustand remains the sole state owner. */
export function CurrencyProvider({
  children,
}: CurrencyProviderProps): React.ReactElement {
  const currencySetting = useCalculatorStore((state) => state.currency);
  const setCurrency = useCalculatorStore((state) => state.setCurrency);
  const { i18n } = useTranslation();
  const currency = resolveCurrency(currencySetting, i18n.language ?? "pt-BR");
  const format = useCallback(
    (value: number): string => formatCurrency(value, currency),
    [currency],
  );
  const value = useMemo<CurrencyValue>(
    () => ({ currency, symbol: CURRENCIES[currency].symbol, format }),
    [currency, format],
  );

  return (
    <CurrencyValueContext.Provider value={value}>
      <CurrencySettingContext.Provider value={currencySetting}>
        <SetCurrencyContext.Provider value={setCurrency}>
          {children}
        </SetCurrencyContext.Provider>
      </CurrencySettingContext.Provider>
    </CurrencyValueContext.Provider>
  );
}
