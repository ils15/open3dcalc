import { pdf } from "@react-pdf/renderer";
import { ReportDoc } from "@/shared/lib/ReportDoc";
import {
  ExecutiveReportDoc,
  type ExecutiveReportData,
} from "@/shared/lib/ExecutiveReportDoc";
import type { CalculationResult } from "@/shared/types";
import { guardExport } from "./demoExportGuard";
import { downloadBlob } from "./download";

export async function exportPdf(
  result: CalculationResult,
  locale?: string,
  currency?: string,
) {
  // Choke point: nem renderiza o PDF em demo — o dado é ficcional e efêmero.
  if (guardExport()) return;
  const blob = await pdf(
    <ReportDoc result={result} locale={locale} currency={currency} />,
  ).toBlob();
  const lang = locale?.split("-")[0] || "pt";
  downloadBlob(blob, `open3dcalc_report_${lang}.pdf`);
}

export async function exportExecutivePdf(
  data: ExecutiveReportData,
  locale?: string,
  currency?: string,
) {
  if (guardExport()) return;
  const dateStr = new Date().toISOString().split("T")[0];
  // Explicit args win; otherwise keep whatever the caller already resolved on
  // `data` — a bare `{ ...data, locale, currency }` would overwrite resolved
  // values with `undefined` and silently force pt-BR + R$.
  const enrichedData = {
    ...data,
    locale: locale ?? data.locale,
    currency: currency ?? data.currency,
  };
  const blob = await pdf(<ExecutiveReportDoc {...enrichedData} />).toBlob();
  const lang = (locale ?? data.locale)?.split("-")[0] || "pt";
  downloadBlob(blob, `open3dcalc_executive_report_${dateStr}_${lang}.pdf`);
}
