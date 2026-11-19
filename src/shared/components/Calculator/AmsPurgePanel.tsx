import { useMemo, useState, type ReactElement } from "react";
import { ChevronDown, ChevronUp, Layers, Palette, Sparkles } from "lucide-react";
import { computeAmsPurge } from "@/shared/lib/amsPurge";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

/**
 * Interactive Multi-Color Purge ("Poop") & Full-Plate Dilution Simulator for
 * AMS / CFS / ACE Pro / MMU3 workflows.
 *
 * Computes real per-unit filament waste without modifying the frozen core
 * `calculator.ts` engine: clicking "Apply to Calculator" writes the diluted
 * total weight per part and batch quantity into `useCalculatorStore`.
 */
export function AmsPurgePanel(): ReactElement {
  const { format: formatCurrency } = useCurrency();
  const fdmMaterial = useCalculatorStore((s) => s.fdmMaterial);
  const quantity = useCalculatorStore((s) => s.quantity);
  const setFdmMaterial = useCalculatorStore((s) => s.setFdmMaterial);
  const setQuantity = useCalculatorStore((s) => s.setQuantity);

  const [isOpen, setIsOpen] = useState(false);
  const [colorCount, setColorCount] = useState(4);
  const [filamentChanges, setFilamentChanges] = useState(80);
  const [purgeGramsPerSwap, setPurgeGramsPerSwap] = useState(0.65);
  const [primeTowerGrams, setPrimeTowerGrams] = useState(12);
  const [batchQuantity, setBatchQuantity] = useState(
    Math.max(1, quantity || 1),
  );
  const [appliedNotice, setAppliedNotice] = useState(false);

  const partWeightGrams = Math.max(0, fdmMaterial?.weightUsed ?? 0);
  const filamentCostPerKg = Math.max(0, fdmMaterial?.costPerKg ?? 0);

  const summary = useMemo(
    () =>
      computeAmsPurge({
        colorCount,
        filamentChanges,
        purgeGramsPerSwap,
        primeTowerGrams,
        partWeightGrams,
        batchQuantity,
        filamentCostPerKg,
      }),
    [
      colorCount,
      filamentChanges,
      purgeGramsPerSwap,
      primeTowerGrams,
      partWeightGrams,
      batchQuantity,
      filamentCostPerKg,
    ],
  );

  const handleApplyToCalculator = () => {
    setFdmMaterial({
      ...fdmMaterial,
      weightUsed: summary.totalFilamentPerUnitGrams,
    });
    setQuantity(summary.batchQuantity);
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2200);
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-sunken overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-surface-overlay/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Palette className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary block truncate">
              Simulador Multi-Cor (AMS / CFS / ACE / MMU)
            </span>
            <span className="text-[11px] text-text-secondary block truncate">
              Purga ("poop"), torre de prime e diluição em mesa cheia
            </span>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border-subtle p-3.5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Cores
              </span>
              <input
                type="number"
                min={2}
                max={16}
                value={colorCount}
                onChange={(e) =>
                  setColorCount(Math.max(2, Number(e.target.value) || 2))
                }
                className="w-full rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Trocas
              </span>
              <input
                type="number"
                min={0}
                value={filamentChanges}
                onChange={(e) =>
                  setFilamentChanges(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Purga/Troca (g)
              </span>
              <input
                type="number"
                min={0}
                step="0.05"
                value={purgeGramsPerSwap}
                onChange={(e) =>
                  setPurgeGramsPerSwap(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Torre Prime (g)
              </span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={primeTowerGrams}
                onChange={(e) =>
                  setPrimeTowerGrams(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Peças na Mesa
              </span>
              <input
                type="number"
                min={1}
                value={batchQuantity}
                onChange={(e) =>
                  setBatchQuantity(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-2.5">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Desperdício na Mesa
              </span>
              <span className="text-sm font-bold font-mono text-warning">
                {summary.totalWastePerPlateGrams} g
              </span>
              <span className="text-[10px] text-text-secondary block">
                {summary.totalPurgeGrams}g purga + {summary.primeTowerGrams}g
                torre
              </span>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface-raised p-2.5">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Peso Real por Peça
              </span>
              <span className="text-sm font-bold font-mono text-text-primary">
                {summary.totalFilamentPerUnitGrams} g
              </span>
              <span className="text-[10px] text-text-secondary block">
                {partWeightGrams}g modelo + {summary.wastePerUnitGrams}g perda (
                {summary.wasteSharePercent}%)
              </span>
            </div>

            <div className="rounded-lg border border-positive/30 bg-positive-subtle p-2.5">
              <span className="text-[10px] font-mono uppercase text-positive block font-bold">
                1 Peça vs. Mesa Cheia ({summary.batchQuantity}x)
              </span>
              <span className="text-sm font-bold font-mono text-positive">
                {summary.batchQuantity > 1
                  ? `-${summary.savingsGramsPerUnit}g / peça`
                  : "Adicione + peças"}
              </span>
              <span className="text-[10px] text-text-secondary block">
                {summary.batchQuantity > 1
                  ? `Economia de ${formatCurrency(summary.savingsCostPerUnit)} (${summary.savingsPercentVsSingle}%)`
                  : `Sozinha consome ${summary.singleUnitTotalGrams}g`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-text-secondary inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-info" />
              Custo real de filamento/peça:{" "}
              <strong className="font-mono text-text-primary">
                {formatCurrency(summary.totalMaterialCostPerUnit)}
              </strong>
            </span>
            <button
              type="button"
              onClick={handleApplyToCalculator}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--color-accent-fill)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-accent-fill-fg)] hover:brightness-110 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {appliedNotice
                  ? "Peso & Lote Aplicados!"
                  : `Aplicar ${summary.totalFilamentPerUnitGrams}g na Calculadora`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
