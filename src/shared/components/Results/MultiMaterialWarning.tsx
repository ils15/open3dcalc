import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { isMultiMaterialActive } from "@/shared/lib/multiMaterial";

/**
 * Non-blocking honesty notice for the beta multi-material surface.
 *
 * The beta stores a partial slot cost for display, but does not include it in
 * the aggregate result. The notice keeps that limitation visible next to the
 * financial cards instead of presenting derived values as complete.
 */
export function MultiMaterialWarning(): React.ReactElement | null {
  const { t } = useTranslation();
  const fdmAmsEnabled = useCalculatorStore((state) => state.fdmAmsEnabled);
  const fdmAmsSlots = useCalculatorStore((state) => state.fdmAmsSlots);

  if (!isMultiMaterialActive(fdmAmsEnabled, fdmAmsSlots)) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      data-testid="multi-material-warning"
      className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-subtle)] p-3 text-left sm:p-4"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-[var(--warning)]"
      />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--warning)]">
          {t("calc.multiMaterialWarningTitle")}
        </p>
        <p className="mt-1 text-sm text-[var(--text-primary)]">
          {t("calc.multiMaterialWarningMessage")}
        </p>
      </div>
    </div>
  );
}
