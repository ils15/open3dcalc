import { pdf } from '@react-pdf/renderer'
import { ReportDoc } from '@/shared/lib/ReportDoc'
import { ExecutiveReportDoc, type ExecutiveReportData } from '@/shared/lib/ExecutiveReportDoc'
import type { CalculationResult } from '@/shared/types'
import { guardExport } from './demoExportGuard'
import { downloadBlob } from './download'

export async function exportPdf(result: CalculationResult, locale?: string, currency?: string) {
  // Choke point: nem renderiza o PDF em demo — o dado é ficcional e efêmero.
  if (guardExport()) return
  const blob = await pdf(<ReportDoc result={result} locale={locale} currency={currency} />).toBlob()
  const lang = locale?.split('-')[0] || 'pt'
  downloadBlob(blob, `open3dcalc_report_${lang}.pdf`)
}

export async function exportExecutivePdf(data: ExecutiveReportData, locale?: string, currency?: string) {
  if (guardExport()) return
  const dateStr = new Date().toISOString().split('T')[0]
  const enrichedData = { ...data, locale, currency }
  const blob = await pdf(<ExecutiveReportDoc {...enrichedData} />).toBlob()
  const lang = locale?.split('-')[0] || 'pt'
  downloadBlob(blob, `open3dcalc_executive_report_${dateStr}_${lang}.pdf`)
}
