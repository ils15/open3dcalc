import { Layers, LayoutGrid, ListOrdered } from "lucide-react";

type CalculatorLayout = "classic" | "bento" | "guided";

interface CalculatorModeControlProps {
  layoutMode: CalculatorLayout;
  onChange: (layoutMode: CalculatorLayout) => void;
}

interface ModelPresetControlProps {
  selectedModel: string;
  modelNames: readonly string[];
  onSelect: (modelName: string) => void;
}

export function CalculatorModeControl({
  layoutMode,
  onChange,
}: CalculatorModeControlProps): React.ReactElement {
  return (
    <div
      data-testid="calculator-layout-control"
      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1"
    >
      <span className="px-2 text-[10px] font-mono font-bold uppercase text-[var(--text-muted)]">
        MODO:
      </span>
      <button
        type="button"
        onClick={() => onChange("classic")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
          layoutMode === "classic"
            ? "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] shadow-sm"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
        }`}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        Clássico
      </button>
      <button
        type="button"
        onClick={() => onChange("bento")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
          layoutMode === "bento"
            ? "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] shadow-sm"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        Bento
      </button>
      <button
        type="button"
        onClick={() => onChange("guided")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
          layoutMode === "guided"
            ? "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] shadow-sm"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
        }`}
      >
        <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        Guiado
      </button>
    </div>
  );
}

export function ModelPresetControl({
  selectedModel,
  modelNames,
  onSelect,
}: ModelPresetControlProps): React.ReactElement {
  return (
    <div
      data-testid="model-preset-control"
      className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs xl:flex"
    >
      <span className="font-medium text-[var(--text-muted)]">Modelo:</span>
      <select
        aria-label="Modelo"
        value={selectedModel}
        onChange={(event) => onSelect(event.target.value)}
        className="cursor-pointer bg-transparent pr-2 font-medium text-[var(--text-primary)] focus:outline-none"
      >
        {modelNames.map((modelName) => (
          <option
            key={modelName}
            value={modelName}
            className="bg-[var(--surface-raised)] text-[var(--text-primary)]"
          >
            {modelName}
          </option>
        ))}
      </select>
    </div>
  );
}
