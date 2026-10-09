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
    <section className="mx-auto mb-4 flex w-full max-w-7xl flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Visualização da calculadora
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
          Escolha o fluxo que combina com seu cálculo.
        </p>
      </div>
      <div
        role="group"
        aria-label="Modo da calculadora"
        className="grid w-full grid-cols-3 gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1.5 sm:flex sm:w-auto"
      >
        {MODES.map(({ mode: option, label, icon }) => {
          const isActive = mode === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onModeChange(option)}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:min-w-[6.5rem] sm:flex-row sm:gap-2 sm:px-4 sm:text-xs ${
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
