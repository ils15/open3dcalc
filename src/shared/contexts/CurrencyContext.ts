import { createContext, useCallback, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  CURRENCIES,
  formatCurrency,
  resolveCurrency,
  type CurrencyCode,
  type CurrencySetting,
} from "@/shared/lib/currency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

export interface CurrencyValue {
  currency: CurrencyCode;
  symbol: string;
  format: (value: number) => string;
}

export const CurrencyValueContext = createContext<CurrencyValue | undefined>(
  undefined,
);
export const CurrencySettingContext = createContext<
  CurrencySetting | undefined
>(undefined);
export const SetCurrencyContext = createContext<
  ((setting: CurrencySetting) => void) | undefined
>(undefined);

/** Reads the context when mounted in the app, with a store-backed fallback. */
export function useCurrency(): CurrencyValue {
  const providedValue = useContext(CurrencyValueContext);
  const currencySetting = useCalculatorStore((state) => state.currency);
  const { i18n } = useTranslation();
  const currency = resolveCurrency(currencySetting, i18n.language ?? "pt-BR");
  const format = useCallback(
    (value: number): string => formatCurrency(value, currency),
    [currency],
  );
  const fallbackValue = useMemo<CurrencyValue>(
    () => ({ currency, symbol: CURRENCIES[currency].symbol, format }),
    [currency, format],
  );

  return providedValue ?? fallbackValue;
}

/** Reads the persisted preference without copying it into context-owned state. */
export function useCurrencyPreference(): {
  currencySetting: CurrencySetting;
} {
  const providedSetting = useContext(CurrencySettingContext);
  const storeSetting = useCalculatorStore((state) => state.currency);

  return { currencySetting: providedSetting ?? storeSetting };
}

/** Reads the stable existing Zustand action without subscribing to the value. */
export function useSetCurrency(): (setting: CurrencySetting) => void {
  const providedAction = useContext(SetCurrencyContext);
  const storeAction = useCalculatorStore((state) => state.setCurrency);

  return providedAction ?? storeAction;
}
