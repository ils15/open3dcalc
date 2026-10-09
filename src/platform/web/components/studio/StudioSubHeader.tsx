import React from "react";
import { Briefcase, Layers, LayoutGrid, ListOrdered } from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { LayoutMode } from "@/shared/stores/layoutStore";

interface StudioSubHeaderProps {
  activeTab: Tab;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onOpenQuoteModal: () => void;
}

export const StudioSubHeader: React.FC<StudioSubHeaderProps> = ({
  activeTab,
  layoutMode,
  onLayoutChange,
  onOpenQuoteModal,
}) => (
  <div className="h-11 min-w-0 bg-surface-raised border-b border-border-subtle px-4 flex items-center justify-between text-xs select-none sticky top-12 z-30">
    {/* Module navigation and global tools have a single owner: the sidebar and
        cockpit dock. This strip is reserved for calculator presentation mode. */}
    <div className="flex min-w-0 flex-1 items-center">
      {activeTab === "calculator" && (
        <div
          aria-label="Modo da calculadora"
          className="hidden md:flex shrink-0 items-center gap-1"
        >
          <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">
            MODO:
          </span>
          <div className="flex items-center bg-[#111728] p-0.5 rounded-lg border border-[#212c45]">
            <button
              type="button"
              aria-pressed={layoutMode === "classic"}
              onClick={() => onLayoutChange("classic")}
              className={`flex min-h-11 min-w-11 shrink-0 items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                layoutMode === "classic"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3 h-3" />
              Clássico
            </button>
            <button
              type="button"
              aria-pressed={layoutMode === "bento"}
              onClick={() => onLayoutChange("bento")}
              className={`flex min-h-11 min-w-11 shrink-0 items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                layoutMode === "bento"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              Bento
            </button>
            <button
              type="button"
              aria-pressed={layoutMode === "guided"}
              onClick={() => onLayoutChange("guided")}
              className={`flex min-h-11 min-w-11 shrink-0 items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                layoutMode === "guided"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListOrdered className="w-3 h-3" />
              Guiado
            </button>
          </div>
        </div>
      )}
    </div>

    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={onOpenQuoteModal}
        aria-label="Orçamento"
        title="Gerar Proposta & Orçamento"
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white shadow-sm transition-colors hover:ring-2 hover:ring-blue-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Orçamento</span>
      </button>
    </div>
  </div>
);
