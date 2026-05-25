export const CURRENCIES = {
  BRL: { code: 'BRL', locale: 'pt-BR', symbol: 'R$', name: 'Real' },
  USD: { code: 'USD', locale: 'en-US', symbol: '$',  name: 'Dollar' },
  EUR: { code: 'EUR', locale: 'de-DE', symbol: '€',  name: 'Euro' },
  GBP: { code: 'GBP', locale: 'en-GB', symbol: '£',  name: 'Pound' },
} as const

export type CurrencyCode = keyof typeof CURRENCIES
export type CurrencySetting = 'auto' | CurrencyCode

export function formatCurrency(val: number, currency: CurrencyCode): string {
  const { locale, code } = CURRENCIES[currency]
  return (val || 0).toLocaleString(locale, { style: 'currency', currency: code })
}

export function resolveCurrency(setting: CurrencySetting, lang: string): CurrencyCode {
  if (setting === 'auto') return lang.startsWith('pt') ? 'BRL' : 'USD'
  return setting
}
