import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { formatCurrency, resolveCurrency, CURRENCIES, type CurrencyCode } from '@/lib/currency'

export function useCurrency() {
  const { i18n } = useTranslation()
  const currencySetting = useCalculatorStore(s => s.currency)

  const currency: CurrencyCode = resolveCurrency(currencySetting, i18n.language ?? 'pt-BR')

  return {
    currency,
    symbol: CURRENCIES[currency].symbol,
    format: (val: number) => formatCurrency(val, currency),
  }
}
