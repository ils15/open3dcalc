import React from "react";

export type StudioKpiTone =
  "default" | "positive" | "warning" | "accent" | "info";

export interface StudioKpiItem {
  id: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  tone?: StudioKpiTone;
  actionLabel?: string;
  onAction?: () => void;
}

const VALUE_TONE_CLASS: Record<StudioKpiTone, string> = {
  default: "text-text-primary",
  positive: "text-positive",
  warning: "text-warning",
  accent: "text-accent",
  info: "text-info",
};

const SUBTITLE_TONE_CLASS: Record<StudioKpiTone, string> = {
  default: "text-text-muted",
  positive: "text-positive font-medium",
  warning: "text-warning font-medium",
  accent: "text-accent font-medium",
  info: "text-info font-medium",
};

export const StudioKpiStrip: React.FC<{
  items: StudioKpiItem[];
  className?: string;
}> = ({ items, className = "" }) => {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {items.map((item) => {
        const tone = item.tone ?? "default";
        return (
          <div
            key={item.id}
            className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between gap-2 transition-colors hover:border-border"
          >
            <div className="flex items-center justify-between gap-2 text-text-secondary">
              <span className="text-[10px] font-mono uppercase font-semibold tracking-wider truncate">
                {item.label}
              </span>
              <span className="shrink-0">{item.icon}</span>
            </div>

            <div className="my-0.5 flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-2xl font-extrabold tracking-tight ${VALUE_TONE_CLASS[tone]}`}
              >
                {item.value}
              </span>
              {item.unit ? (
                <span className="text-xs text-text-secondary font-medium">
                  {item.unit}
                </span>
              ) : null}
            </div>

            {item.onAction && item.actionLabel ? (
              <button
                type="button"
                onClick={item.onAction}
                className="min-h-11 text-[11px] font-bold text-left text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
              >
                {item.actionLabel}
              </button>
            ) : item.subtitle ? (
              <div className={`text-[10px] ${SUBTITLE_TONE_CLASS[tone]}`}>
                {item.subtitle}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
