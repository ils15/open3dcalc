import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import type { FilamentSpool } from "@/shared/stores/filamentInventory";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "@/shared/components/Dashboard/RechartsLazy";
import {
  FolderOpen,
  Save,
  FileText,
  BarChart2,
  CheckCircle2,
  ScrollText,
  Database,
  Share2,
  Pencil,
  Check,
  X,
  PackagePlus,
} from "lucide-react";
import { exportQuoteJson, downloadQuoteJson } from "@/shared/lib/quoteApi";
import { generateShareUrl } from "@/shared/lib/calculationLink";
import { reverseFromSellPrice } from "@/shared/lib/sellPriceOverride";
import {
  calculatorToProduct,
  isDuplicateProductName,
} from "@/shared/lib/calculatorToProduct";
import { roundCurrency } from "@/shared/lib/currency";
import { useProductInventory } from "@/shared/stores/productInventory";

interface ResultsPanelProps {
  variant: "sidebar" | "mobile";
}

export function ResultsPanel({ variant }: ResultsPanelProps) {
  const { t, i18n } = useTranslation();
  const {
    results,
    productName,
    addToHistory,
    saveSettings,
    activeTab,
    fdmType,
    resinType,
    lastDeductedInfo,
    fdmSales,
    resinSales,
    selectedSpoolId,
  } = useCalculatorStore(
    useShallow((s) => ({
      results: s.results,
      productName: s.productName,
      addToHistory: s.addToHistory,
      saveSettings: s.saveSettings,
      activeTab: s.activeTab,
      fdmType: s.fdmMaterial.type,
      resinType: s.resinMaterial.type,
      lastDeductedInfo: s.lastDeductedInfo,
      fdmSales: s.fdmSales,
      resinSales: s.resinSales,
      selectedSpoolId: s.selectedSpoolId,
    })),
  );
  const setLastDeductedInfo = useCalculatorStore((s) => s.setLastDeductedInfo);
  const {
    clearHistory,
    entries: historyEntries,
    historyCount,
  } = useHistoryStore(
    useShallow((s) => ({
      clearHistory: s.clearHistory,
      entries: s.entries,
      historyCount: s.entries.length,
    })),
  );
  const recentEntries = useMemo(
    () => historyEntries.slice(0, 3),
    [historyEntries],
  );

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Display-local sell-price override (issue #85): never writes back to the
  // store, so the global margin stays untouched — only this panel re-derives
  // profit/margin from the overridden price.
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState(false);
  const [sellOverride, setSellOverride] = useState<number | null>(null);

  // Calculator → product bridge feedback (success / duplicate-warn / error).
  const [productMsg, setProductMsg] = useState<{
    kind: "success" | "warn" | "error";
    text: string;
  } | null>(null);

  // Inventory deduction state
  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
  const [selectedSpool, setSelectedSpool] = useState<FilamentSpool | null>(
    null,
  );
  const [showDeductConfirm, setShowDeductConfirm] = useState(false);
  const [deductSuccess, setDeductSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inventoryBtnRef = useRef<HTMLButtonElement>(null);

  const { spools, deductWeight: deductWeightFromSpool } = useFilamentInventory(
    useShallow((s) => ({ spools: s.spools, deductWeight: s.deductWeight })),
  );
  const currentMaterial = activeTab === "fdm" ? fdmType : resinType;
  const unitWeight = results?.unitWeight ?? 0;

  const availableSpools = useMemo(
    () =>
      spools.filter(
        (s) =>
          s.status === "in_stock" &&
          s.material.toLowerCase() === currentMaterial.toLowerCase() &&
          s.weightGrams >= unitWeight,
      ),
    [spools, currentMaterial, unitWeight],
  );

  // Close dropdown on click outside
  useEffect(() => {
    if (!showInventoryDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inventoryBtnRef.current &&
        !inventoryBtnRef.current.contains(e.target as Node)
      ) {
        setShowInventoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showInventoryDropdown]);

  // Close dropdown with Escape
  useEffect(() => {
    if (!showInventoryDropdown) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInventoryDropdown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showInventoryDropdown]);

  // Auto-hide success message
  useEffect(() => {
    if (!deductSuccess) return;
    const timer = setTimeout(() => setDeductSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [deductSuccess]);

  // Watch for auto-deduction triggered by addToHistory
  useEffect(() => {
    if (!lastDeductedInfo) return;
    const timer = setTimeout(() => {
      setDeductSuccess(true);
      setLastDeductedInfo(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [lastDeductedInfo, setLastDeductedInfo]);

  const handleDeductClick = (spool: FilamentSpool) => {
    setSelectedSpool(spool);
    setShowInventoryDropdown(false);
    setShowDeductConfirm(true);
  };

  const handleConfirmDeduct = () => {
    if (!selectedSpool) return;
    deductWeightFromSpool(selectedSpool.id, unitWeight);
    setShowDeductConfirm(false);
    setSelectedSpool(null);
    setDeductSuccess(true);
  };

  const isFDM = activeTab === "fdm";
  const { currency, format: fmtCurrency } = useCurrency();
  const isSidebar = variant === "sidebar";

  const chartData = useMemo((): {
    name: string;
    value: number;
    color: string;
  }[] => {
    if (!results) return [];
    const items = [
      {
        name: "Material",
        value: results.materialCost,
        color: isFDM ? "#38bdf8" : "#a855f7",
      },
      {
        name: t("calc.chartLabels.energy"),
        value: results.energyCost,
        color: "#facc15",
      },
      {
        name: t("calc.chartLabels.machine"),
        value: results.machineCost,
        color: "#94a3b8",
      },
      { name: "Hardware", value: results.hardwareCost, color: "#f97316" },
      {
        name: t("calc.chartLabels.finishing"),
        value: results.postProcessingCost,
        color: "#22d3ee",
      },
      {
        name: t("calc.chartLabels.consumables"),
        value: results.consumablesCost,
        color: "#06b6d4",
      },
      {
        name: t("calc.chartLabels.software"),
        value: results.softwareCost,
        color: "#818cf8",
      },
      {
        name: t("calc.chartLabels.labor"),
        value: results.laborCost,
        color: "#f472b6",
      },
      {
        name: t("calc.chartLabels.failure"),
        value: results.failureCost,
        color: "#f87171",
      },
      {
        name: t("calc.chartLabels.extras"),
        value: results.extrasCost,
        color: "#cbd5e1",
      },
    ].filter((d) => d.value > 0.01);
    return items;
  }, [results, isFDM, t]);

  // Re-derived pricing for the display-local override. Base is the
  // break-even price (= total base cost); tax/fee rates come from the
  // active tab's sales parameters.
  const overrideCalc = useMemo(() => {
    if (!results || sellOverride == null) return null;
    const sales = activeTab === "fdm" ? fdmSales : resinSales;
    return reverseFromSellPrice(
      sellOverride,
      results.breakEvenPrice,
      sales.taxPercent,
      sales.marketplaceFeePercent,
    );
  }, [results, sellOverride, activeTab, fdmSales, resinSales]);

  const displaySellPrice = results ? (sellOverride ?? results.sellPrice) : 0;
  const displayProfit = overrideCalc?.profit ?? results?.profit ?? 0;

  if (!results) return null;

  const openPriceEditor = () => {
    setPriceDraft(String(displaySellPrice));
    setPriceError(false);
    setIsEditingPrice(true);
  };

  const handleConfirmPrice = () => {
    const parsed = parseFloat(priceDraft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPriceError(true);
      return;
    }
    setPriceError(false);
    setSellOverride(roundCurrency(parsed));
    setIsEditingPrice(false);
  };

  const handleCancelPrice = () => {
    setIsEditingPrice(false);
    setPriceError(false);
  };

  const handleResetPrice = () => {
    setSellOverride(null);
  };

  const handleRegisterProduct = () => {
    let name = productName.trim();
    if (!name) {
      const asked = window.prompt(t("results.productNamePrompt"));
      if (asked == null) return;
      name = asked.trim();
      if (!name) {
        setProductMsg({ kind: "error", text: t("results.productNeedsName") });
        return;
      }
    }
    // Single-spool decision (issue #85): prefer the calculator's selected
    // spool, fall back to the first available spool for the current material.
    // Multi-filament compositions are a follow-up.
    const activeSpool =
      spools.find((s) => s.id === selectedSpoolId) ??
      availableSpools[0] ??
      null;
    const filamentType = activeSpool ? activeSpool.material : currentMaterial;
    const data = calculatorToProduct({
      productName: name,
      unitWeight: results.unitWeight,
      filamentType,
      totalCost: results.totalCost,
      displaySellPrice,
    });
    const duplicate = isDuplicateProductName(
      name,
      useProductInventory.getState().products,
    );
    useProductInventory.getState().addProduct(data);
    setProductMsg({
      kind: duplicate ? "warn" : "success",
      text: duplicate
        ? t("results.productDuplicateWarn")
        : t("results.productRegistered"),
    });
  };

  const handleGoToProducts = () => {
    window.dispatchEvent(new CustomEvent("open3dcalc:go-products"));
  };

  const handleShareLink = async () => {
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

  const handleExportQuote = () => {
    if (!results) return;
    const state = useCalculatorStore.getState();
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

  const content = (
    <>
      <div className="result-hero rounded-xl p-3 sm:p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-success)]/70">
            {t("calc.sellPrice")}
          </div>
          {!isEditingPrice && (
            <button
              type="button"
              onClick={openPriceEditor}
              aria-label={t("calc.sellPriceEdit")}
              className="p-1.5 rounded-lg text-[var(--color-success)]/70 hover:text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {isEditingPrice ? (
          <div className="flex items-center justify-center gap-2">
            <label htmlFor="sell-price-override" className="sr-only">
              {t("calc.sellPriceInputLabel")}
            </label>
            <input
              id="sell-price-override"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPrice();
                if (e.key === "Escape") handleCancelPrice();
              }}
              aria-label={t("calc.sellPriceInputLabel")}
              aria-invalid={priceError}
              aria-describedby={priceError ? "sell-price-error" : undefined}
              className="w-36 sm:w-44 px-3 py-2 rounded-xl text-center text-lg sm:text-xl font-mono font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={handleConfirmPrice}
              aria-label={t("calc.sellPriceConfirm")}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none flex items-center justify-center"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCancelPrice}
              aria-label={t("calc.sellPriceCancel")}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight leading-none text-[var(--color-text-primary)]">
            {fmtCurrency(displaySellPrice)}
          </div>
        )}
        {priceError && isEditingPrice && (
          <p
            id="sell-price-error"
            role="alert"
            className="text-xs sm:text-sm text-[var(--color-danger)] mt-2"
          >
            {t("calc.sellPriceInvalid")}
          </p>
        )}
        {overrideCalc ? (
          <div className="mt-2 space-y-1.5">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
              {t("calc.sellPriceCustom")}
            </span>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              {t("calc.profit")}: {fmtCurrency(overrideCalc.profit)} ·{" "}
              {t("calc.actualMargin")}: {overrideCalc.marginReal.toFixed(1)}% ·{" "}
              {t("calc.effectiveMarkup")}:{" "}
              {overrideCalc.markupEffective.toFixed(1)}%
            </p>
            {overrideCalc.belowBreakEven && (
              <p
                role="alert"
                className="text-xs sm:text-sm font-semibold text-[var(--color-danger)]"
              >
                {t("calc.belowBreakEven", {
                  value: fmtCurrency(results.breakEvenPrice),
                })}
              </p>
            )}
            <button
              type="button"
              onClick={handleResetPrice}
              className="text-[11px] sm:text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded"
            >
              {t("calc.sellPriceReset")}
            </button>
          </div>
        ) : (
          results.taxAmount > 0 && (
            <div className="text-xs sm:text-sm text-[var(--color-success)]/80 mt-2">
              incl. {fmtCurrency(results.taxAmount)} em taxas/marketplace
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="rounded-xl p-3 sm:p-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5 sm:mb-1">
            {t("calc.costPerGram")}
          </div>
          <div className="text-sm sm:text-lg font-black text-[var(--color-info)] font-mono">
            {results.costPerGram > 0
              ? fmtCurrency(results.costPerGram) + "/g"
              : "---"}
          </div>
        </div>
        <div className="rounded-xl p-3 sm:p-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5 sm:mb-1">
            {t("breakdown.failure")}
          </div>
          <div className="text-sm sm:text-lg font-black text-[var(--color-danger)] font-mono">
            {results.failureCost > 0 ? fmtCurrency(results.failureCost) : "---"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="rounded-xl p-3 sm:p-5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5 sm:mb-1">
            {t("calc.totalCost")}
          </div>
          <div className="text-base sm:text-xl font-black text-[var(--color-success)] font-mono">
            {fmtCurrency(results.totalCost)}
          </div>
        </div>
        <div className="rounded-xl p-3 sm:p-5 bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/30 text-center">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-warning)]/70 mb-0.5 sm:mb-1">
            {t("calc.profit")}
          </div>
          <div className="text-base sm:text-xl font-black text-[var(--color-warning)] font-mono">
            {fmtCurrency(displayProfit)}
          </div>
          <span
            tabIndex={0}
            role="note"
            title={t("calc.profitPerHourTooltip")}
            aria-label={`${t("calc.profitPerHour")}: ${fmtCurrency(results.profitPerHour ?? 0)}/h. ${t("calc.profitPerHourTooltip")}`}
            className="mt-1 inline-block text-[11px] sm:text-xs font-mono font-semibold text-[var(--color-warning)]/80 underline decoration-dotted underline-offset-2 cursor-help focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded"
          >
            {fmtCurrency(results.profitPerHour ?? 0)}/h
          </span>
        </div>
      </div>

      {chartData.length > 0 && (
        <Suspense
          fallback={
            <div className="surface-elevated rounded-xl p-4 sm:p-5">
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                {t("calc.costDistribution")}
              </div>
              <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
                {t("dashboard.loadingCharts")}
              </p>
            </div>
          }
        >
          <div className="surface-elevated rounded-xl p-3 sm:p-5">
            <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 sm:mb-4">
              {t("calc.costDistribution")}
            </div>
            <div className="space-y-1.5 sm:space-y-3">
              {chartData.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                      {item.name}
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[var(--color-text-primary)]">
                      {fmtCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${results.totalCost > 0 ? (item.value / results.totalCost) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              className={`mt-4 w-full ${isSidebar ? "hidden" : "h-48 sm:h-56"}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="40%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        stroke="rgba(0,0,0,0.3)"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => fmtCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: "var(--color-chart-tooltip-bg)",
                      borderColor: "var(--color-chart-tooltip-border)",
                      color: "var(--color-chart-tooltip-text)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "var(--color-chart-tooltip-text)" }}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", maxWidth: "42%" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Suspense>
      )}

      <button
        onClick={() => addToHistory()}
        className="w-full min-h-[44px] py-2 sm:py-3 rounded-xl text-sm sm:text-[15px] font-semibold transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
      >
        <FolderOpen className="w-4 h-4" />
        {t("calc.addHistory")}
      </button>

      <button
        onClick={handleRegisterProduct}
        className="w-full min-h-[44px] py-2 sm:py-3 rounded-xl text-sm sm:text-[15px] font-semibold transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
      >
        <PackagePlus className="w-4 h-4" />
        {t("results.registerProduct")}
      </button>

      {productMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl p-3 sm:p-4 text-center text-xs sm:text-sm font-medium border ${
            productMsg.kind === "error"
              ? "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30 text-[var(--color-danger)]"
              : productMsg.kind === "warn"
                ? "bg-[var(--color-warning-muted)] border-[var(--color-warning)]/30 text-[var(--color-warning)]"
                : "bg-emerald-600/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <p>{productMsg.text}</p>
          {productMsg.kind !== "error" && (
            <button
              type="button"
              onClick={handleGoToProducts}
              className="mt-1.5 underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded"
            >
              {t("results.viewProducts")}
            </button>
          )}
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className="surface-elevated rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
              {t("calc.history")} ({historyCount})
            </span>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[10px] sm:text-xs text-red-400/70 hover:text-red-400 transition-colors"
            >
              {t("calc.clearHistory")}
            </button>
          </div>
          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {recentEntries.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-[var(--color-bg-hover)] border border-[var(--color-border)]"
              >
                <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                  <span>
                    {new Date(item.timestamp).toLocaleDateString(
                      i18n.resolvedLanguage || i18n.language,
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </span>
                  <span className="uppercase font-bold tracking-wider">
                    {item.type}
                  </span>
                </div>
                <div className="font-medium text-[var(--color-text-primary)] text-xs truncate mb-1">
                  {item.summary}
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-400 font-mono text-xs">
                    {fmtCurrency(item.profit)}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">
                    {fmtCurrency(item.sellPrice)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div data-tutorial="export" className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            saveSettings();
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          }}
          className={`min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-1 truncate ${
            saveStatus === "saved"
              ? "bg-emerald-600 text-white"
              : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
          }`}
        >
          {saveStatus === "saved" ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Save className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">
            {saveStatus === "saved" ? t("calc.saved") : t("calc.saveSettings")}
          </span>
        </button>
        <button
          data-shortcut="export"
          onClick={async () => {
            const { exportPdf } = await import("@/shared/lib/pdfExport");
            const locale = i18n.resolvedLanguage || i18n.language || "pt-BR";
            exportPdf(results, locale, currency);
          }}
          className="min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold bg-[var(--color-bg-surface)] text-white hover:bg-[var(--color-bg-hover)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-bg-surface)] focus-visible:outline-none flex items-center justify-center gap-1 truncate"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />{" "}
          <span className="truncate">{t("calc.exportPdf")}</span>
        </button>
        <button
          onClick={async () => {
            const { exportResultToCsv, downloadCsv } =
              await import("@/shared/lib/csvExport");
            const csv = exportResultToCsv(results, productName || "open3dcalc");
            downloadCsv(csv, "open3dcalc_resultado.csv");
          }}
          className="min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold bg-[var(--color-info)] text-white hover:bg-[var(--color-info)]/80 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-info)] focus-visible:outline-none flex items-center justify-center gap-1 truncate"
        >
          <BarChart2 className="w-3.5 h-3.5 shrink-0" /> CSV
        </button>
        <button
          onClick={handleExportQuote}
          className="min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold bg-[var(--color-warning)] text-white hover:bg-[var(--color-warning)]/80 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-warning)] focus-visible:outline-none flex items-center justify-center gap-1 truncate"
        >
          <ScrollText className="w-3.5 h-3.5 shrink-0" />{" "}
          <span className="truncate">{t("results.exportQuote")}</span>
        </button>
      </div>

      {/* Share Link */}
      <button
        onClick={handleShareLink}
        className={`w-full min-h-[44px] py-2.5 rounded-xl text-[11px] font-bold transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-2 ${
          shareStatus === "copied"
            ? "bg-emerald-600 text-white"
            : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
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

      {/* Deduct from Inventory — FDM only */}
      {isFDM && (
        <div className="relative">
          <button
            ref={inventoryBtnRef}
            onClick={() => setShowInventoryDropdown((prev) => !prev)}
            className="w-full min-h-[44px] py-3 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-800/40 text-emerald-300 hover:bg-emerald-700/50 transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none flex items-center justify-center gap-1.5 relative"
            aria-label={t("results.deductFromInventory")}
            aria-expanded={showInventoryDropdown}
          >
            <Database className="w-3.5 h-3.5" />
            {deductSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />{" "}
                {t("results.deductSuccess")}
              </>
            ) : (
              t("results.deductFromInventory")
            )}
          </button>

          {showInventoryDropdown && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-2 w-full surface rounded-xl p-3 border border-[var(--color-border)] shadow-2xl animate-fade-in"
              role="listbox"
              aria-label={t("results.deductSelect")}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                {t("results.deductSelect")}
              </div>
              {availableSpools.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
                  {t("common.noData")}
                </p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {availableSpools.map((spool) => (
                    <button
                      key={spool.id}
                      onClick={() => handleDeductClick(spool)}
                      className="w-full text-left p-2.5 rounded-xl bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                      role="option"
                      aria-selected={selectedSpool?.id === spool.id}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-[var(--color-border)]"
                        style={{ backgroundColor: spool.colorHex }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-medium truncate">
                          {spool.brand} — {spool.material}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {spool.color} &middot;{" "}
                          {t("results.deductAvailable", {
                            weight: spool.weightGrams.toFixed(0),
                          })}
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400/70 whitespace-nowrap">
                        -{unitWeight.toFixed(1)}g
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  const withDialogs = (
    <>
      {content}
      <ConfirmDialog
        open={showClearConfirm}
        title={t("calc.clearHistory")}
        message={t("calc.clearConfirm")}
        variant="danger"
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          clearHistory();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
      <ConfirmDialog
        open={showDeductConfirm}
        title={t("results.deductFromInventory")}
        message={
          selectedSpool
            ? t("results.deductConfirm", {
                weight: unitWeight.toFixed(1),
                spool: `${selectedSpool.brand} - ${selectedSpool.material}`,
              })
            : ""
        }
        variant="info"
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleConfirmDeduct}
        onCancel={() => {
          setShowDeductConfirm(false);
          setSelectedSpool(null);
        }}
      />
    </>
  );

  if (isSidebar) {
    return withDialogs;
  }

  return <div className="space-y-4 2xl:hidden">{withDialogs}</div>;
}
