import type { ReactElement } from "react";
import { Layers, LayoutGrid, ListOrdered } from "lucide-react";

import type { LayoutMode } from "@/shared/stores/layoutStore";

interface StudioCalculatorModeSelectorProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
  compact?: boolean;
}

const MODES: ReadonlyArray<{
  mode: LayoutMode;
  label: string;
  icon: ReactElement;
}> = [
  {
    mode: "classic",
    label: "Clássico",
    icon: <Layers className="size-4" aria-hidden="true" />,
  },
  {
    mode: "bento",
    label: "Bento",
    icon: <LayoutGrid className="size-4" aria-hidden="true" />,
  },
  {
    mode: "guided",
    label: "Guiado",
    icon: <ListOrdered className="size-4" aria-hidden="true" />,
  },
];

/** Calculator-only view controls. Kept with the calculator, not global chrome. */
export function StudioCalculatorModeSelector({
  mode,
  onModeChange,
  compact = false,
}: StudioCalculatorModeSelectorProps): ReactElement {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-medium text-[var(--color-text-muted)]">
          Modo
        </span>
        <div
          role="group"
          aria-label="Modo da calculadora"
          className="flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
        >
          {MODES.map(({ mode: option, label, icon }) => {
            const isActive = mode === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isActive}
                onClick={() => onModeChange(option)}
                className={`flex min-h-8 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  isActive
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto mb-4 flex w-full max-w-7xl flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3.5">
      <div className="min-w-0">
        <h2 className="text-xs font-semibold text-[var(--color-text-primary)] sm:text-sm">
          Layout
        </h2>
      </div>
      <div
        role="group"
        aria-label="Modo da calculadora"
        className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1 sm:flex sm:w-auto sm:gap-1.5 sm:p-1.5"
      >
        {MODES.map(({ mode: option, label, icon }) => {
          const isActive = mode === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onModeChange(option)}
              className={`flex min-h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-[10px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:min-h-12 sm:min-w-[6.5rem] sm:flex-row sm:gap-2 sm:px-4 sm:text-xs ${
                isActive
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-md"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
