import type { LucideIcon } from "lucide-react";

import { StepBadge } from "@/shared/components/ui/StepBadge";

export interface SectionHeaderProps {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** 1-based step over the sections visible at the current level. */
  step?: number;
}

/** Presentational section heading; field disclosure has one surface-level owner. */
export function SectionHeader({
  Icon,
  title,
  subtitle,
  step,
}: SectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--border-default)]">
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
    </div>
  );
}
