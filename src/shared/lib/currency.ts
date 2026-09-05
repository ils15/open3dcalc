export const CURRENCIES = {
  BRL: { code: "BRL", locale: "pt-BR", symbol: "R$", name: "Real" },
  USD: { code: "USD", locale: "en-US", symbol: "$", name: "Dollar" },
  EUR: { code: "EUR", locale: "de-DE", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", locale: "en-GB", symbol: "£", name: "Pound" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export type CurrencySetting = "auto" | CurrencyCode;

export function formatCurrency(val: number, currency: CurrencyCode): string {
  const { locale, code } = CURRENCIES[currency];
  return (val || 0).toLocaleString(locale, {
    style: "currency",
    currency: code,
  });
}

/**
 * Rounds a monetary value to 2 decimal places (centavos).
 * Central helper for Fase 2 #70 profit/hr so every surface
 * (store, panels, PDF docs) shares the same rounding.
 */
export function roundCurrency(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function resolveCurrency(
  setting: CurrencySetting,
  lang: string,
): CurrencyCode {
  if (setting === "auto") return lang.startsWith("pt") ? "BRL" : "USD";
  return setting;
}
