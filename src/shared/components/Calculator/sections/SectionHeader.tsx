import type { LucideIcon } from "lucide-react";

import { StepBadge } from "@/shared/components/ui/StepBadge";

export interface SectionHeaderProps {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** 1-based step over the sections visible at the current level. */
  step?: number;
  /**
   * Live section total shown at the heading's right edge. Sections without a
   * computed total omit it, and the header renders exactly as it did before
   * the prop existed (see the byte-identical baseline assertions in tests).
   */
  metric?: React.ReactNode;
}

/** Presentational section heading; field disclosure has one surface-level owner. */
export function SectionHeader({
  Icon,
  title,
  subtitle,
  step,
  metric,
}: SectionHeaderProps): React.ReactElement {
  const heading = (
    <>
      {step !== undefined && <StepBadge step={step} size="md" />}
      <Icon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
      <div className="flex-1 min-w-0">
        <h2 className="text-xs font-bold text-[var(--text-primary)] truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[10px] text-[var(--text-muted)] truncate">
            {subtitle}
          </p>
        )}
      </div>
    </>
  );

  const hasMetric = metric !== undefined && metric !== null;

  return (
    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--border-default)]">
      {hasMetric ? (
        <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
          {heading}
          <span className="shrink-0 text-[10px] font-mono text-[var(--text-secondary)]">
            {metric}
          </span>
        </div>
      ) : (
        heading
      )}
    </div>
  );
}
