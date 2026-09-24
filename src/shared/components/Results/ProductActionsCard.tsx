import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { FolderOpen, PackagePlus } from "lucide-react";

import {
  isFilamentSpoolNotFoundError,
  isInsufficientFilamentStockError,
} from "@/shared/lib/filamentStock";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useProductInventory } from "@/shared/stores/productInventory";
import {
  calculatorToProduct,
  isDuplicateProductName,
} from "@/shared/lib/calculatorToProduct";

export interface ProductActionsCardProps {
  /** Sell price currently displayed (honors the display-local override). */
  displaySellPrice: number;
}

/**
 * "Add to history" + "Register product" actions and their feedback banner.
 *
 * Hosts the calculator → product inventory bridge (issue #85 single-spool
 * decision) so the orchestrator stays free of store plumbing.
 */
export function ProductActionsCard({ displaySellPrice }: ProductActionsCardProps) {
  const { t } = useTranslation();
  const [productMsg, setProductMsg] = useState<{
    kind: "success" | "warn" | "error";
    text: string;
  } | null>(null);

  const {
    results,
    productName,
    addToHistory,
    activeTab,
    fdmType,
    resinType,
    selectedSpoolId,
  } = useCalculatorStore(
    useShallow((s) => ({
      results: s.results,
      productName: s.productName,
      addToHistory: s.addToHistory,
      activeTab: s.activeTab,
      fdmType: s.fdmMaterial.type,
      resinType: s.resinMaterial.type,
      selectedSpoolId: s.selectedSpoolId,
    })),
  );
  const spools = useFilamentInventory((s) => s.spools);

  if (!results) return null;

  const currentMaterial = activeTab === "fdm" ? fdmType : resinType;
  const unitWeight = results.unitWeight;
  const availableSpools = spools.filter(
    (s) =>
      s.status === "in_stock" &&
      s.material.toLowerCase() === currentMaterial.toLowerCase() &&
      s.weightGrams >= unitWeight,
  );

  const handleAddToHistory = () => {
    try {
      addToHistory();
      setProductMsg(null);
    } catch (error) {
      if (isInsufficientFilamentStockError(error)) {
        setProductMsg({
          kind: "error",
          text: t("results.insufficientStock", {
            required: error.required?.toFixed(2) ?? results.unitWeight.toFixed(2),
            available: error.available?.toFixed(2) ?? "0",
          }),
        });
        return;
      }
      if (isFilamentSpoolNotFoundError(error)) {
        setProductMsg({ kind: "error", text: t("results.spoolNotFound") });
        return;
      }
      throw error;
    }
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

  return (
    <>
      <button
        type="button"
        onClick={handleAddToHistory}
        className="w-full min-h-[44px] py-2 sm:py-3 rounded-xl text-sm sm:text-[15px] font-semibold transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
      >
        <FolderOpen className="w-4 h-4" />
        {t("calc.addHistory")}
      </button>

      <button
        type="button"
        onClick={handleRegisterProduct}
        className="w-full min-h-[44px] py-2 sm:py-3 rounded-xl text-sm sm:text-[15px] font-semibold transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
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
              ? "bg-[var(--critical)]/10 border-[var(--critical)]/30 text-[var(--critical)]"
              : productMsg.kind === "warn"
                ? "bg-[var(--warning-subtle)] border-[var(--warning)]/30 text-[var(--warning)]"
                : "bg-[var(--positive-subtle)] border-[var(--positive)]/30 text-[var(--positive)]"
          }`}
        >
          <p>{productMsg.text}</p>
          {productMsg.kind !== "error" && (
            <button
              type="button"
              onClick={handleGoToProducts}
              className="mt-1.5 underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded"
            >
              {t("results.viewProducts")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
