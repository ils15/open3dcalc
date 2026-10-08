import React, { useState } from "react";
import {
  Plus,
  Maximize,
  HelpCircle,
  X,
  Calculator,
  Package,
  Settings2,
  FileText,
  Sparkles,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";

interface StudioCockpitDockProps {
  onOpenMiniDash: () => void;
  onToggleFocusMode: () => void;
  onOpenShortcuts: () => void;
  onTabChange: (tab: Tab) => void;
  onOpenCopilot: () => void;
  onOpenNewQuote: () => void;
}

export const StudioCockpitDock: React.FC<StudioCockpitDockProps> = ({
  onOpenMiniDash,
  onToggleFocusMode,
  onOpenShortcuts,
  onTabChange,
  onOpenCopilot,
  onOpenNewQuote,
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);

  return (
    /*
     * WIDTH STRATEGY — why this is not `left-1/2 -translate-x-1/2`.
     *
     * That centring idiom sizes the dock to its CONTENT, and the content is
     * 426px: at a 390px viewport the dock spanned -18..408, so the Mini-Dash
     * pill lost 13px on the left and the Atalhos button lost 13px on the right.
     * Two controls were partially unreachable, and no media query can fix it —
     * a fixed 426px box cannot fit a 390px viewport, so hiding the dock would
     * remove a product feature rather than fix a layout.
     *
     * The dock is now an inset full-width track (`inset-x-0` + `px-4`) that
     * centres whatever fits, and the pill row itself is the scroll container
     * (`overflow-x-auto` + `max-w-full`). Every control stays present and
     * reachable by scrolling INSIDE the dock, and the row can never establish
     * page width again.
     *
     * `pointer-events-none` on the track with `pointer-events-auto` on the
     * children: the track spans the full viewport, so without this its
     * transparent gutters would swallow clicks on whatever is underneath —
     * including the fee form's save area the dock was reported as covering.
     */
    <div
      className="fixed inset-x-0 bottom-4 flex justify-center px-4 pointer-events-none select-none"
      style={{ zIndex: "var(--z-passive)" }}
    >
      {/* Quick actions popup menu if open */}
      {showQuickActions && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#0d1322] border border-[#212d47] rounded-2xl p-2 shadow-2xl shadow-black/80 flex flex-col gap-1 w-56 max-w-[calc(100vw-2rem)] animate-fade-up">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 text-xs font-bold text-slate-300">
            <span>Ações Rápidas</span>
            <button
              onClick={() => setShowQuickActions(false)}
              className="min-h-11 min-w-11 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              setShowQuickActions(false);
              onTabChange("calculator");
            }}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-blue-600/20 transition-colors text-left"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-400" />
            <span>Novo Cálculo 3D</span>
          </button>
          <button
            onClick={() => {
              setShowQuickActions(false);
              onTabChange("inventory");
            }}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-blue-600/20 transition-colors text-left"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>Cadastrar Carretel</span>
          </button>
          <button
            onClick={() => {
              setShowQuickActions(false);
              onTabChange("catalog");
            }}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-blue-600/20 transition-colors text-left"
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Adicionar Impressora</span>
          </button>
          <button
            onClick={() => {
              setShowQuickActions(false);
              onOpenNewQuote();
            }}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-blue-600/20 transition-colors text-left"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Emitir Orçamento PDF</span>
          </button>
          <button
            onClick={() => {
              setShowQuickActions(false);
              onOpenCopilot();
            }}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-amber-600/20 transition-colors text-left"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Assistente IA de Impressão</span>
          </button>
        </div>
      )}

      {/* The floating dock pills. `shrink-0` on each pill keeps their intrinsic
          width so the ROW scrolls instead of squashing the labels; the row
          itself is the scroll container and is capped to the viewport. */}
      <div className="pointer-events-auto flex items-center bg-[#090d18]/90 backdrop-blur-md border border-[#212c45] rounded-full p-1 shadow-2xl shadow-black/80 gap-1.5 overflow-x-auto max-w-full">
        {/* Mini-dash status indicator */}
        <button
          onClick={onOpenMiniDash}
          className="shrink-0 flex min-h-11 items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#111728] hover:bg-[#18233c] text-slate-200 border border-[#212c45] transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-emerald-400 font-bold">Mini-Dash</span>
          <span className="hidden text-slate-400 font-medium sm:inline">
            R$ 3.737,94
          </span>
          <span className="hidden text-slate-600 sm:inline">•</span>
          <span className="hidden text-cyan-400 font-medium sm:inline">
            2/6 máq.
          </span>
          <span className="hidden text-slate-600 sm:inline">•</span>
          <span className="hidden rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-400 sm:inline">
            ⚠️ 2 baixos
          </span>
        </button>

        {/* Action button */}
        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="shrink-0 flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:ring-2 hover:ring-blue-500/40 text-white transition-all shadow-md shadow-blue-600/30"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Ações Rápidas</span>
        </button>

        {/* Modo foco */}
        <button
          onClick={onToggleFocusMode}
          className="shrink-0 min-h-11 min-w-11 p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-full transition-colors"
          title="Modo Foco"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>

        {/* Atalhos */}
        <button
          onClick={onOpenShortcuts}
          className="shrink-0 min-h-11 min-w-11 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors"
          title="Atalhos (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
