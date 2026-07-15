import { pdf } from '@react-pdf/renderer'
import { ReportDoc } from '@/shared/lib/ReportDoc'
import { ExecutiveReportDoc, type ExecutiveReportData } from '@/shared/lib/ExecutiveReportDoc'
import type { CalculationResult } from '@/shared/types'

export async function exportPdf(result: CalculationResult) {
  const blob = await pdf(<ReportDoc result={result} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'open3dcalc_relatorio.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportExecutivePdf(data: ExecutiveReportData) {
  const dateStr = new Date().toISOString().split('T')[0]
  const blob = await pdf(<ExecutiveReportDoc {...data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `open3dcalc_executive_report_${dateStr}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
