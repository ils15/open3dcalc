import { pdf } from '@react-pdf/renderer'
import { ReportDoc } from '@/shared/lib/ReportDoc'
import { ExecutiveReportDoc, type ExecutiveReportData } from '@/shared/lib/ExecutiveReportDoc'
import type { CalculationResult } from '@/shared/types'

export async function exportPdf(result: CalculationResult, locale?: string, currency?: string) {
  const blob = await pdf(<ReportDoc result={result} locale={locale} currency={currency} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const lang = locale?.split('-')[0] || 'pt'
  a.download = `open3dcalc_report_${lang}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportExecutivePdf(data: ExecutiveReportData, locale?: string, currency?: string) {
  const dateStr = new Date().toISOString().split('T')[0]
  const enrichedData = { ...data, locale, currency }
  const blob = await pdf(<ExecutiveReportDoc {...enrichedData} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const lang = locale?.split('-')[0] || 'pt'
  a.download = `open3dcalc_executive_report_${dateStr}_${lang}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
