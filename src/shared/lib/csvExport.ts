import { formatCurrency, type CurrencyCode } from './currency'
import type { CalculationResult } from '@/shared/types'

interface CsvRow {
  [key: string]: string | number
}

function escapeCsv(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const headerRow = headers.map(escapeCsv).join(',')
  const dataRows = rows.map(row =>
    headers.map(h => escapeCsv(row[h] ?? '')).join(',')
  )
  return [headerRow, ...dataRows].join('\n')
}

function getCurrencySymbol(currency?: string): string {
  return formatCurrency(0, (currency ?? 'BRL') as CurrencyCode).replace(/[\d,.\s]/g, '').trim()
}

export function exportHistoryToCsv(
  history: Array<{ id: string; timestamp: number; type: string; summary: string; totalCost: number; sellPrice: number; profit: number }>,
  options?: { locale?: string; currency?: string }
): string {
  const locale = options?.locale ?? 'pt-BR'
  const sym = getCurrencySymbol(options?.currency)
  const rows = history.map(item => ({
    Data: new Date(item.timestamp).toLocaleDateString(locale),
    Hora: new Date(item.timestamp).toLocaleTimeString(locale),
    Tipo: item.type.toUpperCase(),
    Produto: item.summary,
    [`Custo Total (${sym})`]: item.totalCost.toFixed(2),
    [`Preco Venda (${sym})`]: item.sellPrice.toFixed(2),
    [`Lucro (${sym})`]: item.profit.toFixed(2),
    'Margem (%)': item.totalCost > 0 ? ((item.profit / item.totalCost) * 100).toFixed(1) : '0',
  }))
  return rowsToCsv(rows)
}

export function exportResultToCsv(
  result: CalculationResult,
  productName?: string,
  options?: { locale?: string; currency?: string }
): string {
  const sym = getCurrencySymbol(options?.currency)
  const label = (field: string) => `${field} (${sym})`
  const rows: CsvRow[] = [
    { Campo: 'Produto', Valor: productName ?? '' },
    { Campo: label('Custo Material'), Valor: result.materialCost.toFixed(2) },
    { Campo: label('Custo Energia'), Valor: result.energyCost.toFixed(2) },
    { Campo: label('Depreciacao'), Valor: result.machineCost.toFixed(2) },
    { Campo: label('Hardware'), Valor: result.hardwareCost.toFixed(2) },
    { Campo: label('Consumiveis'), Valor: result.consumablesCost.toFixed(2) },
    { Campo: label('Mao de Obra'), Valor: result.laborCost.toFixed(2) },
    { Campo: label('Software'), Valor: result.softwareCost.toFixed(2) },
    { Campo: label('Falha'), Valor: result.failureCost.toFixed(2) },
    { Campo: label('Extras'), Valor: result.extrasCost.toFixed(2) },
    { Campo: label('Pos-Processamento'), Valor: result.postProcessingCost.toFixed(2) },
    { Campo: label('Custo Total'), Valor: result.totalCost.toFixed(2) },
    { Campo: label('Preco Venda'), Valor: result.sellPrice.toFixed(2) },
    { Campo: label('Lucro Liquido'), Valor: result.profit.toFixed(2) },
    { Campo: label('Taxa Marketplace'), Valor: result.marketplaceFee.toFixed(2) },
    { Campo: label('Impostos'), Valor: result.taxAmount.toFixed(2) },
    { Campo: label('Custo por Grama'), Valor: result.costPerGram.toFixed(4) },
    { Campo: 'Peso (g)', Valor: result.unitWeight.toFixed(2) },
  ]
  return rowsToCsv(rows)
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
