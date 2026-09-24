import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CalculationValidationIssue } from "@/shared/stores/calculatorStore.validation";

export interface CalculationErrorStateProps {
  /** Boundary issues reported by the calculator store. */
  readonly issues: readonly CalculationValidationIssue[];
  /** Whether a finite result is available alongside any issues. */
  readonly hasResult: boolean;
  /** Invalid chart paths detected by the financial breakdown. */
  readonly additionalPaths?: readonly string[];
}

/**
 * One fail-high notice shared by Classic and Bento.
 *
 * A missing result is fatal and receives focus once. A finite result with a
 * boundary issue stays visible as a live warning while the numbers remain
 * available, so the user can correct the input without losing context.
 */
export function CalculationErrorState({
  issues,
  hasResult,
  additionalPaths = [],
}: CalculationErrorStateProps): React.ReactElement | null {
  const { t } = useTranslation();
  const noticeRef = useRef<HTMLDivElement>(null);
  const wasFatal = useRef(false);

  const paths = Array.from(
    new Set([
      ...issues.map((issue) => issue.path),
      ...additionalPaths,
    ]),
  );
  const isVisible = !hasResult || paths.length > 0;
  const isFatal = !hasResult;

  useEffect(() => {
    if (isVisible && isFatal && !wasFatal.current) {
      noticeRef.current?.focus();
    }
    wasFatal.current = isFatal;
  }, [isFatal, isVisible]);

  if (!isVisible) return null;

  const title = t("calc.invalidCalculationTitle");
  const path = paths[0] ?? "results";
  const message = t("calc.invalidCalculation", { path });

  return (
    <div
      ref={noticeRef}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-label={`${title}: ${message}`}
      tabIndex={-1}
      data-testid="calculation-error"
      className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--critical)]/30 bg-[var(--critical-subtle)] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--critical)] focus-visible:ring-offset-2 sm:p-4"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-[var(--critical)]"
      />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--critical)]">{title}</p>
        <p className="mt-1 break-words text-sm text-[var(--text-primary)]">
          {message}
        </p>
      </div>
    </div>
  );
}
