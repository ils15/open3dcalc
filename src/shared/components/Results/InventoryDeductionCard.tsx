import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle2, Database, PackagePlus } from "lucide-react";

import {
  assertSufficientFilamentStock,
  createFilamentStockError,
  FILAMENT_SPOOL_NOT_FOUND,
  isFilamentSpoolNotFoundError,
  isInsufficientFilamentStockError,
} from "@/shared/lib/filamentStock";
import { isInvalidCalculationStateError } from "@/shared/lib/calculationState";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import {
  useFilamentInventory,
  type FilamentSpool,
} from "@/shared/stores/filamentInventory";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import {
  SpoolForm,
  type SpoolFormInitialValues,
  type SpoolFormValues,
} from "@/shared/components/SpoolShelf/SpoolForm";

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
    fdmMaterial,
    resinType,
    lastDeductedInfo,
    setLastDeductedInfo,
    selectedSpoolId,
    setSelectedSpoolId,
    quantity,
    calculationIssues,
  } = useCalculatorStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      fdmMaterial: s.fdmMaterial,
      resinType: s.resinMaterial.type,
      lastDeductedInfo: s.lastDeductedInfo,
      setLastDeductedInfo: s.setLastDeductedInfo,
      selectedSpoolId: s.selectedSpoolId,
      setSelectedSpoolId: s.setSelectedSpoolId,
      quantity: s.quantity,
      calculationIssues: s.calculationIssues,
    })),
  );
  const results = useCalculatorStore((s) => s.results);
  const { spools, deductWeight: deductWeightFromSpool, addSpool } =
    useFilamentInventory(
      useShallow((s) => ({
        spools: s.spools,
        deductWeight: s.deductWeight,
        addSpool: s.addSpool,
      })),
    );

  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
  const [selectedSpool, setSelectedSpool] = useState<FilamentSpool | null>(
    null,
  );
  const [showDeductConfirm, setShowDeductConfirm] = useState(false);
  const [deductSuccess, setDeductSuccess] = useState(false);
  const [deductError, setDeductError] = useState<string | null>(null);
  const [showSpoolForm, setShowSpoolForm] = useState(false);
  const [shelfMessage, setShelfMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inventoryBtnRef = useRef<HTMLButtonElement>(null);

  const isFDM = activeTab === "fdm";
  const currentMaterial = isFDM ? fdmMaterial.type : resinType;
  const unitWeight = results?.unitWeight ?? 0;
  const requiredWeight = unitWeight * quantity;

  const selectedSpoolForForm = useMemo(
    () => spools.find((spool) => spool.id === selectedSpoolId) ?? null,
    [selectedSpoolId, spools],
  );
  const calculationInitialValues = useMemo<SpoolFormInitialValues>(() => {
    const values: SpoolFormInitialValues = {
      material: currentMaterial,
      weightGrams: unitWeight,
      costPerKg: fdmMaterial.costPerKg,
    };
    if (!selectedSpoolForForm) return values;
    return {
      ...values,
      brand: selectedSpoolForForm.brand,
      color: selectedSpoolForForm.color,
      colorHex: selectedSpoolForForm.colorHex,
      originalWeightGrams: selectedSpoolForForm.originalWeightGrams,
      diameterMm: selectedSpoolForForm.diameterMm,
    };
  }, [currentMaterial, fdmMaterial.costPerKg, selectedSpoolForForm, unitWeight]);

  const availableSpools = useMemo(
    () =>
      spools.filter(
        (s) =>
          s.status === "in_stock" &&
          s.material.toLowerCase() === currentMaterial.toLowerCase() &&
          s.weightGrams >= requiredWeight,
      ),
    [spools, currentMaterial, requiredWeight],
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
    setDeductError(null);
    setShowInventoryDropdown(false);
    setShowDeductConfirm(true);
  };

  const handleConfirmDeduct = () => {
    if (!selectedSpool) return;
    try {
      const currentSpool = spools.find((spool) => spool.id === selectedSpool.id);
      if (!currentSpool) {
        throw createFilamentStockError(FILAMENT_SPOOL_NOT_FOUND);
      }
      assertSufficientFilamentStock(currentSpool.weightGrams, requiredWeight);
      deductWeightFromSpool(currentSpool.id, requiredWeight, {
        calculationIssues,
        quantity,
      });
      setDeductError(null);
      setShowDeductConfirm(false);
      setSelectedSpool(null);
      setDeductSuccess(true);
    } catch (error) {
      if (isInsufficientFilamentStockError(error)) {
        setDeductError(
          t("results.insufficientStock", {
            required: error.required?.toFixed(2) ?? requiredWeight.toFixed(2),
            available: error.available?.toFixed(2) ?? "0",
          }),
        );
        setShowDeductConfirm(false);
        setSelectedSpool(null);
        return;
      }
      if (isFilamentSpoolNotFoundError(error)) {
        setDeductError(t("results.spoolNotFound"));
        setShowDeductConfirm(false);
        setSelectedSpool(null);
        return;
      }
      if (isInvalidCalculationStateError(error)) {
        setDeductError(t("results.invalidCalculationState"));
        setShowDeductConfirm(false);
        setSelectedSpool(null);
        return;
      }
      throw error;
    }
  };

  const openAddToShelf = () => {
    setShowInventoryDropdown(false);
    setShelfMessage(null);
    setShowSpoolForm(true);
  };

  const handleAddToShelf = (values: SpoolFormValues) => {
    addSpool(values);
    setShowSpoolForm(false);
    setShelfMessage(t("results.addedToShelf"));
  };

  const handleUseExisting = (spool: FilamentSpool) => {
    setSelectedSpoolId(spool.id);
    setShowSpoolForm(false);
    setShelfMessage(
      t("results.usingExistingSpool", {
        spool: `${spool.brand} - ${spool.material}`,
      }),
    );
  };

  return (
    <>
      <div className="relative">
        <button
          ref={inventoryBtnRef}
          type="button"
          onClick={() => setShowInventoryDropdown((prev) => !prev)}
          className="w-full min-h-[44px] py-3 rounded-xl text-[11px] sm:text-xs font-bold bg-[var(--positive-subtle)] text-[var(--positive)] hover:bg-[var(--positive)]/15 transition-all focus-visible:ring-2 focus-visible:ring-[var(--positive)] focus-visible:outline-none flex items-center justify-center gap-1.5 relative"
          aria-label={t("results.deductFromInventory")}
          aria-expanded={showInventoryDropdown}
        >
          <Database className="w-3.5 h-3.5" />
          {deductSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />{" "}
              {t("results.deductSuccess")}
            </>
          ) : (
            t("results.deductFromInventory")
          )}
        </button>

        {showInventoryDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-2 w-full surface rounded-xl p-3 border border-[var(--border-default)] shadow-2xl animate-fade-in"
            role="listbox"
            aria-label={t("results.deductSelect")}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
              {t("results.deductSelect")}
            </div>
            {availableSpools.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                {t("common.noData")}
              </p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {availableSpools.map((spool) => (
                  <button
                    key={spool.id}
                    type="button"
                    onClick={() => handleDeductClick(spool)}
                    className="w-full text-left p-2.5 rounded-xl bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] transition-colors flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-[var(--positive)] focus-visible:outline-none"
                    role="option"
                    aria-selected={selectedSpool?.id === spool.id}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-[var(--border-default)]"
                      style={{ backgroundColor: spool.colorHex }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[var(--text-primary)] font-medium truncate">
                        {spool.brand} — {spool.material}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {spool.color} &middot;{" "}
                        {t("results.deductAvailable", {
                          weight: spool.weightGrams.toFixed(0),
                        })}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-[var(--positive)]/70 whitespace-nowrap">
                      -{requiredWeight.toFixed(1)}g
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {deductError && (
        <p role="alert" className="text-xs text-[var(--critical)] text-center">
          {deductError}
        </p>
      )}

      <button
        type="button"
        onClick={openAddToShelf}
        className="w-full min-h-[44px] py-3 rounded-xl text-[11px] sm:text-xs font-bold bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-sunken)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none flex items-center justify-center gap-1.5"
        aria-label={t("results.addToShelf")}
      >
        <PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />
        {t("results.addToShelf")}
      </button>

      {shelfMessage && (
        <p role="status" className="text-xs text-emerald-600 dark:text-[var(--positive)] text-center">
          {shelfMessage}
        </p>
      )}

      <SpoolForm
        open={showSpoolForm}
        initial={null}
        initialValues={calculationInitialValues}
        compatibleSpools={spools}
        onUseExisting={handleUseExisting}
        onSubmit={handleAddToShelf}
        onClose={() => setShowSpoolForm(false)}
      />

      <ConfirmDialog
        open={showDeductConfirm}
        title={t("results.deductFromInventory")}
        message={
          selectedSpool
            ? t("results.deductConfirm", {
                weight: requiredWeight.toFixed(1),
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
