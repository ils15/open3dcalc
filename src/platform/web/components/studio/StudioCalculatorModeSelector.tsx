import type { ReactElement } from "react";
import { Layers, LayoutGrid, ListOrdered } from "lucide-react";

import type { LayoutMode } from "@/shared/stores/layoutStore";

interface StudioCalculatorModeSelectorProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

const MODES: ReadonlyArray<{
  mode: LayoutMode;
  label: string;
  icon: ReactElement;
}> = [
  { mode: "classic", label: "Clássico", icon: <Layers aria-hidden="true" /> },
  {
    mode: "bento",
    label: "Bento",
    icon: <LayoutGrid aria-hidden="true" />,
  },
  {
    mode: "guided",
    label: "Guiado",
    icon: <ListOrdered aria-hidden="true" />,
  },
];

/** Calculator-only view controls. Kept with the calculator, not global chrome. */
export function StudioCalculatorModeSelector({
  mode,
  onModeChange,
}: StudioCalculatorModeSelectorProps): ReactElement {
  return (
    <section className="mx-auto mb-4 flex w-full max-w-7xl flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
        Visualização da calculadora
      </h2>
      <div
        role="group"
        aria-label="Modo da calculadora"
        className="flex w-full flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1 sm:w-auto"
      >
        {MODES.map(({ mode: option, label, icon }) => {
          const isActive = mode === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onModeChange(option)}
              className={`flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:flex-none ${
                isActive
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
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
