import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookmarkPlus, Check, Copy, GitCompareArrows } from "lucide-react";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useScenarioComparisonStore } from "@/shared/stores/scenarioComparisonStore";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function QuickResultActionsBar(): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const results = useCalculatorStore((s) => s.results);
  const productName = useCalculatorStore((s) => s.productName);
  const activeTab = useCalculatorStore((s) => s.activeTab);
  const fdmMaterial = useCalculatorStore((s) => s.fdmMaterial);
  const resinMaterial = useCalculatorStore((s) => s.resinMaterial);
  const addToHistory = useCalculatorStore((s) => s.addToHistory);

  const pinnedScenario = useScenarioComparisonStore((s) => s.pinnedScenario);
  const pinFromCalculator = useScenarioComparisonStore(
    (s) => s.pinFromCalculator,
  );

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justPinned, setJustPinned] = useState(false);

  if (!results) return null;

  const handleCopySummary = async () => {
    const materialName =
      activeTab === "fdm" ? fdmMaterial.type : resinMaterial.type;
    const title = productName.trim() || "Open3DCalc";
    const summaryText = [
      `📦 ${title} (${activeTab.toUpperCase()} · ${materialName})`,
      `• ${t("results.totalCost")}: ${formatCurrency(results.totalCost)}`,
      `• ${t("results.sellPrice")}: ${formatCurrency(results.sellPrice)}`,
      `• ${t("results.netProfit")}: ${formatCurrency(results.profit)} (${results.actualMargin.toFixed(1)}%)`,
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      }
    } catch {
      // Clipboard fallback ignored in restricted contexts
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePinScenario = () => {
    pinFromCalculator(productName.trim() || undefined);
    setJustPinned(true);
    window.setTimeout(() => setJustPinned(false), 2000);
  };

  const handleQuickSave = () => {
    addToHistory();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      data-testid="quick-result-actions-bar"
      role="group"
      aria-label={t("workshop.quickActionsLabel")}
      className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1.5"
    >
      <button
        type="button"
        data-testid="quick-result-copy-btn"
        title={t("workshop.quickCopySummary")}
        onClick={handleCopySummary}
        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          copied
            ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="max-w-full truncate">
          {copied ? t("workshop.quickCopied") : t("workshop.quickCopySummary")}
        </span>
      </button>

      <button
        type="button"
        data-testid="quick-result-pin-btn"
        aria-pressed={Boolean(pinnedScenario)}
        title={
          pinnedScenario
            ? t("workshop.quickPinned")
            : t("workshop.quickPinScenario")
        }
        onClick={handlePinScenario}
        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          pinnedScenario || justPinned
            ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        {justPinned ? (
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <GitCompareArrows
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        )}
        <span className="max-w-full truncate">
          {pinnedScenario
            ? t("workshop.quickPinned")
            : t("workshop.quickPinScenario")}
        </span>
      </button>

      <button
        type="button"
        data-testid="quick-result-save-btn"
        title={t("workshop.quickSaveHistory")}
        onClick={handleQuickSave}
        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          saved
            ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        {saved ? (
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="max-w-full truncate">
          {saved ? t("workshop.quickSaved") : t("workshop.quickSaveHistory")}
        </span>
      </button>
    </div>
  );
}
