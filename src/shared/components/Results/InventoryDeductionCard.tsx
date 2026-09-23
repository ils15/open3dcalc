import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle2, Database } from "lucide-react";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import {
  useFilamentInventory,
  type FilamentSpool,
} from "@/shared/stores/filamentInventory";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";

/**
 * FDM-only "deduct from inventory" dropdown with its confirmation dialog.
 *
 * Owns the dropdown open/close interactions (click-outside + Escape), the
 * success auto-hide and the auto-deduction feedback triggered by
 * `addToHistory`, reading everything from the stores directly.
 */
export function InventoryDeductionCard() {
  const { t } = useTranslation();

  const {
    activeTab,
    fdmType,
    resinType,
    lastDeductedInfo,
    setLastDeductedInfo,
  } = useCalculatorStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      fdmType: s.fdmMaterial.type,
      resinType: s.resinMaterial.type,
      lastDeductedInfo: s.lastDeductedInfo,
      setLastDeductedInfo: s.setLastDeductedInfo,
    })),
  );
  const results = useCalculatorStore((s) => s.results);
  const { spools, deductWeight: deductWeightFromSpool } = useFilamentInventory(
    useShallow((s) => ({ spools: s.spools, deductWeight: s.deductWeight })),
  );

  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
  const [selectedSpool, setSelectedSpool] = useState<FilamentSpool | null>(
    null,
  );
  const [showDeductConfirm, setShowDeductConfirm] = useState(false);
  const [deductSuccess, setDeductSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inventoryBtnRef = useRef<HTMLButtonElement>(null);

  const isFDM = activeTab === "fdm";
  const currentMaterial = isFDM ? fdmType : resinType;
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

  if (!isFDM || !results) return null;

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

  return (
    <>
      <div className="relative">
        <button
          ref={inventoryBtnRef}
          type="button"
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
                    type="button"
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
}
