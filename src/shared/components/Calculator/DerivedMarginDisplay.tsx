import {
  deriveRealMarginPercent,
  formatRealMarginPercent,
} from "@/shared/lib/realMargin";

export interface DerivedMarginDisplayProps {
  readonly profit: number | null | undefined;
  readonly sellPrice: number | null | undefined;
  readonly label: string;
  readonly helper: string;
  readonly locale?: string;
  readonly testId?: string;
  readonly className?: string;
}

/** Read-only, display-only margin over the customer's sell price. */
export function DerivedMarginDisplay({
  profit,
  sellPrice,
  label,
  helper,
  locale = "pt-BR",
  testId,
  className = "",
}: DerivedMarginDisplayProps): React.ReactElement {
  const margin = deriveRealMarginPercent(profit ?? Number.NaN, sellPrice ?? Number.NaN);
  const value = formatRealMarginPercent(margin, locale);
  const toneClass =
    margin === null
      ? "text-[var(--text-primary)]"
      : margin < 0
        ? "text-[var(--margin-negative)]"
        : "text-[var(--margin)]";

  return (
    <div data-testid={testId} className={`rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3 ${className}`}>
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      <p
        aria-label={`${label}: ${value}`}
        className={`mt-1 break-words text-sm font-bold ${toneClass}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{helper}</p>
    </div>
  );
}
