import React from "react";
import { Search, X } from "lucide-react";

interface StudioViewToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export const StudioViewToolbar: React.FC<StudioViewToolbarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  filters,
  actions,
}) => {
  return (
    <div className="bg-surface-raised border border-border-subtle rounded-2xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
      <div className="relative w-full xl:max-w-sm">
        <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel ?? searchPlaceholder}
          className="w-full min-h-11 bg-surface-sunken border border-border-subtle rounded-xl pl-9 pr-9 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Limpar busca"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 w-full xl:w-auto">
        {filters ? (
          <div className="flex flex-wrap items-center gap-2">{filters}</div>
        ) : null}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
};
