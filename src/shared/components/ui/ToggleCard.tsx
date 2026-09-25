import type { ReactNode } from "react";

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: (val: boolean) => void;
  title?: string;
  showLabels?: boolean;
}

export function ToggleSwitch({
  enabled,
  onToggle,
  title,
  showLabels = false,
}: ToggleSwitchProps) {
  if (showLabels) {
    return (
      <button
        onClick={() => onToggle(!enabled)}
        className={`flex h-11 w-28 items-center justify-center rounded-lg text-xs font-bold tracking-wider transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
          enabled
            ? "bg-[var(--color-accent)] text-[var(--color-text-primary)]"
            : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] shadow-inner opacity-70 hover:opacity-100"
        }`}
        title={title || (enabled ? "Desativar" : "Ativar")}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${enabled ? "bg-white" : "bg-gray-600"}`}
          />
          {enabled ? "ATIVO" : "INATIVO"}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`relative h-5 w-9 rounded-full shrink-0 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
        enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-hover)]"
      }`}
      title={title || (enabled ? "Desativar" : "Ativar")}
      aria-pressed={enabled}
    >
      <span
        className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
          enabled ? "left-[19px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

interface ToggleCardProps {
  title: string;
  icon?: ReactNode;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  children: ReactNode;
  theme?: "indigo" | "sky";
}

export function ToggleCard({
  title,
  icon,
  enabled,
  onToggle,
  children,
  theme = "indigo",
}: ToggleCardProps) {
  return (
    <div className="surface rounded-xl overflow-hidden transition-all duration-300">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <span
              className={`text-base ${theme === "sky" ? "text-sky-400" : "text-[var(--color-accent)]"}`}
            >
              {icon}
            </span>
          )}
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
            {title}
          </h3>
        </div>
        <ToggleSwitch
          enabled={enabled}
          onToggle={onToggle}
          title={enabled ? "Desativar seção" : "Ativar seção"}
        />
      </div>
      <div
        className={`px-5 py-4 transition-all duration-300 ${enabled ? "" : "opacity-40 pointer-events-none"}`}
      >
        {children}
      </div>
    </div>
  );
}
