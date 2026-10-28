import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";

export interface BreakEvenMachineCardProps {
  /** Acquisition cost of the active machine (PrinterProfile.value). */
  machineCost: number;
  /** Net profit per unit of the current calculation. */
  netProfit: number;
}

/**
 * Break-Even da Máquina — the Example reference's quick ROI indicator:
 * how many units of this project pay off the machine's acquisition cost.
 * Informational only; it derives everything from the two numbers above.
 */
export function BreakEvenMachineCard({
  machineCost,
  netProfit,
}: BreakEvenMachineCardProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();

  if (!(machineCost > 0)) return null;
  const pieces = netProfit > 0 ? Math.ceil(machineCost / netProfit) : null;

  return (
    <div
      data-testid="break-even-machine"
      className="rounded-xl border border-[var(--info)]/30 bg-[var(--info)]/5 p-2.5 text-[11px] text-[var(--text-secondary)] space-y-1"
    >
      <div className="flex items-center justify-between text-[var(--info)]">
        <span className="flex items-center gap-1 text-xs font-semibold">
          <TrendingUp size={12} aria-hidden="true" />
          {t("results.breakEven.title")}
        </span>
        <span className="font-mono font-bold text-[var(--positive)]">
          {pieces !== null
            ? t("results.breakEven.pieces", { count: pieces })
            : "—"}
        </span>
      </div>
      <p className="text-[10px] leading-tight">
        {t("results.breakEven.description", {
          count: pieces ?? 0,
          value: fmtCurrency(machineCost),
        })}
      </p>
    </div>
  );
}
