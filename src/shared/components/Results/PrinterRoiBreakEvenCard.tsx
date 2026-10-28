import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, TrendingUp } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";

export interface PrinterRoiBreakEvenCardProps {
  /** Acquisition cost of the active printer (PrinterProfile.value). */
  machineCost: number;
  /** Net profit per unit of the current calculation. */
  netProfit: number;
  /** Print time per unit, in hours. */
  printTimeHours: number;
  /** Printer name for the summary sentence. */
  printerName: string;
}

/**
 * Análise de ROI & Ponto de Equilíbrio da Impressora — the Example
 * reference's collapsible analysis in the print-parameters section. Everything
 * derives live from the current calculation: pieces and machine-hours needed
 * to pay off the active printer's acquisition cost. Informational only.
 */
export function PrinterRoiBreakEvenCard({
  machineCost,
  netProfit,
  printTimeHours,
  printerName,
}: PrinterRoiBreakEvenCardProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  if (!(machineCost > 0)) return null;
  const pieces = netProfit > 0 ? Math.ceil(machineCost / netProfit) : null;
  const hours =
    pieces !== null && printTimeHours > 0 ? pieces * printTimeHours : null;

  return (
    <div
      data-testid="printer-roi"
      className="rounded-xl border border-[var(--info)]/30 bg-[var(--info)]/5"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="printer-roi-panel"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--info)]">
          <TrendingUp size={13} aria-hidden="true" />
          {t("results.roi.title")}
        </span>
        <span className="flex items-center gap-2">
          {pieces !== null && (
            <span className="font-mono text-[11px] font-bold text-[var(--positive)]">
              {t("results.breakEven.pieces", { count: pieces })}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && (
        <div
          id="printer-roi-panel"
          className="space-y-1.5 border-t border-[var(--info)]/20 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)]"
        >
          <p>
            {t("results.roi.summary", {
              pieces: pieces ?? 0,
              hours: hours !== null ? Math.ceil(hours) : 0,
              printer: printerName,
            })}
          </p>
          <p>
            {t("results.roi.machineCost", { value: fmtCurrency(machineCost) })}
            {netProfit > 0 && (
              <>
                {" · "}
                {t("results.roi.perUnit", {
                  value: fmtCurrency(netProfit),
                  hours: printTimeHours.toFixed(1),
                })}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
