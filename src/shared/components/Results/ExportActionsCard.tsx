import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart2,
  CheckCircle2,
  FileText,
  Save,
  ScrollText,
  Share2,
  Sparkles,
} from "lucide-react";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useDemoExportGuard } from "@/shared/hooks/useDemoExportGuard";
import { exportQuoteJson, downloadQuoteJson } from "@/shared/lib/quoteApi";
import { generateShareUrl } from "@/shared/lib/calculationLink";

export interface ExportActionsCardProps {
  /** Forwards the explanation when an export/share action is blocked in demo. */
  readonly onExportBlocked?: (message: string) => void;
  /** The results hierarchy places save-settings with the first action group. */
  readonly showSaveSettings?: boolean;
}

/**
 * Save / export / share toolbar plus the demo-mode badge.
 *
 * Owns the demo export guard and every status flag locally — the panel only
 * forwards the blocked-feedback callback. The `data-tutorial="export"` hook is
 * preserved for the onboarding tours.
 */
export function ExportActionsCard({
  onExportBlocked,
  showSaveSettings = true,
}: ExportActionsCardProps) {
  const { t, i18n } = useTranslation();
  const { currency } = useCurrency();
  const { isDemoMode, guard } = useDemoExportGuard(onExportBlocked);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  const saveSettings = useCalculatorStore((s) => s.saveSettings);

  const handleExportQuote = () => {
    if (guard()) return;
    const state = useCalculatorStore.getState();
    const results = state.results;
    if (!results) return;
    const name = state.productName || "Cotação Open3DCalc";
    const qty = state.quantity || 1;
    const isFdm = state.activeTab === "fdm";
    const pkg = isFdm
      ? state.fdmSales.packagingCost
      : state.resinSales.packagingCost;
    const ship = isFdm
      ? state.fdmSales.shippingCost
      : state.resinSales.shippingCost;
    const locale = i18n.resolvedLanguage || i18n.language || "pt-BR";
    const json = exportQuoteJson(
      results,
      name,
      qty,
      pkg || 0,
      ship || 0,
      locale,
      currency,
    );
    downloadQuoteJson(json, `quote_${Date.now()}.json`);
  };

  const handleShareLink = async () => {
    if (guard()) return;
    const state = useCalculatorStore.getState();
    const shareState = {
      activeTab: state.activeTab,
      fdmMaterial: state.fdmMaterial,
      fdmPrintParams: state.fdmPrintParams,
      fdmMachine: state.fdmMachine,
      fdmHardware: state.fdmHardware,
      fdmFinishing: state.fdmFinishing,
      fdmLabor: state.fdmLabor,
      fdmExtras: state.fdmExtras,
      fdmSales: state.fdmSales,
      fdmOps: state.fdmOps,
      fdmSoft: state.fdmSoft,
      resinMaterial: state.resinMaterial,
      resinPrintParams: state.resinPrintParams,
      resinMachine: state.resinMachine,
      resinHardware: state.resinHardware,
      resinPostProcess: state.resinPostProcess,
      resinLabor: state.resinLabor,
      resinExtras: state.resinExtras,
      resinSales: state.resinSales,
      resinOps: state.resinOps,
      resinSoft: state.resinSoft,
      selectedPrinterId: state.selectedPrinter.id,
      selectedMarketplaceId: state.selectedMarketplace.id,
      fdmAmsEnabled: state.fdmAmsEnabled,
      fdmAmsSlots: state.fdmAmsSlots,
      fixedCosts: state.fixedCosts,
      productName: state.productName,
      quantity: state.quantity,
      infillPercent: state.infillPercent,
      targetMarginMode: state.targetMarginMode,
      enabledSections: state.enabledSections,
    };
    const url = generateShareUrl(shareState);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2500);
    } catch {
      // Clipboard API may fail in some contexts — fallback
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2500);
    }
  };

  return (
    <>
      <div data-tutorial="export" className="grid grid-cols-2 gap-2">
        {isDemoMode && (
          <div
            role="status"
            className="col-span-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/30 text-[11px] font-semibold text-[var(--accent)]"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{t("demo.export.badge")}</span>
          </div>
        )}
        {showSaveSettings && (
          <button
            type="button"
            onClick={() => {
              saveSettings();
              setSaveStatus("saved");
              setTimeout(() => setSaveStatus("idle"), 2000);
            }}
            className={`min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none flex items-center justify-center gap-1 truncate ${
              saveStatus === "saved"
                ? "bg-[var(--positive)] text-[var(--text-inverse)]"
                : "bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
            }`}
          >
            {saveStatus === "saved" ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Save className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {saveStatus === "saved"
                ? t("calc.saved")
                : t("calc.saveSettings")}
            </span>
          </button>
        )}
        <button
          type="button"
          data-shortcut="export"
          onClick={async () => {
            if (guard()) return;
            const state = useCalculatorStore.getState();
            const results = state.results;
            if (!results) return;
            const { exportPdf } = await import("@/shared/lib/pdfExport");
            const locale = i18n.resolvedLanguage || i18n.language || "pt-BR";
            exportPdf(results, locale, currency);
          }}
          className="min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-overlay)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none flex items-center justify-center gap-1 truncate"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />{" "}
          <span className="truncate">{t("calc.exportPdf")}</span>
        </button>
        {/* contrast-site: export-actions-csv-button */}
        <button
          type="button"
          onClick={async () => {
            if (guard()) return;
            const state = useCalculatorStore.getState();
            const results = state.results;
            if (!results) return;
            const { exportResultToCsv, downloadCsv } =
              await import("@/shared/lib/csvExport");
            const csv = exportResultToCsv(
              results,
              state.productName || "open3dcalc",
            );
            downloadCsv(csv, "open3dcalc_resultado.csv");
          }}
          className="min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold bg-[var(--info)] text-[var(--text-inverse)] hover:bg-[var(--info)]/80 transition-all focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none flex items-center justify-center gap-1 truncate"
        >
          <BarChart2 className="w-3.5 h-3.5 shrink-0" /> CSV
        </button>
        <button
          type="button"
          onClick={handleExportQuote}
          className="min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold bg-[var(--warning)] text-[var(--text-inverse)] hover:bg-[var(--warning)]/80 transition-all focus-visible:ring-2 focus-visible:ring-[var(--warning)] focus-visible:outline-none flex items-center justify-center gap-1 truncate"
        >
          <ScrollText className="w-3.5 h-3.5 shrink-0" />{" "}
          <span className="truncate">{t("results.exportQuote")}</span>
        </button>
      </div>

      {/* Share Link */}
      <button
        type="button"
        onClick={handleShareLink}
        className={`w-full min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none flex items-center justify-center gap-2 ${
          shareStatus === "copied"
            ? "bg-[var(--positive)] text-[var(--text-inverse)]"
            : "bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-sunken)]"
        }`}
        aria-label={t("results.shareLink")}
      >
        {shareStatus === "copied" ? (
          <>
            <CheckCircle2 className="w-4 h-4 shrink-0" />{" "}
            <span>{t("results.linkCopied")}</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4 shrink-0" />{" "}
            <span>{t("results.shareLink")}</span>
          </>
        )}
      </button>
    </>
  );
}
