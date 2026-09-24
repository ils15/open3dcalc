export const CURRENCIES = {
  BRL: { code: "BRL", locale: "pt-BR", symbol: "R$", name: "Real" },
  USD: { code: "USD", locale: "en-US", symbol: "$", name: "Dollar" },
  EUR: { code: "EUR", locale: "de-DE", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", locale: "en-GB", symbol: "£", name: "Pound" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export type CurrencySetting = "auto" | CurrencyCode;

/**
 * Neutral marker used when a currency value is not a number.
 *
 * The application must not turn a non-finite value into a believable zero:
 * zero is a valid calculated result, while this marker means "no value yet".
 * Keeping the fallback in the shared formatter protects existing UI and export
 * callers without making them each invent their own invalid-value behavior.
 */
export const INVALID_CURRENCY_MARKER = "—";

/** Formats finite currency values and fails visibly for non-finite input. */
export function formatCurrency(val: number, currency: CurrencyCode): string {
  if (!Number.isFinite(val)) return INVALID_CURRENCY_MARKER;

  const { locale, code } = CURRENCIES[currency];
  return val.toLocaleString(locale, {
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
  if (!Number.isFinite(val)) return val;
  return Math.round(val * 100) / 100;
}

export function resolveCurrency(
  setting: CurrencySetting,
  lang: string,
): CurrencyCode {
  if (setting === "auto") return lang.startsWith("pt") ? "BRL" : "USD";
  return setting;
}
