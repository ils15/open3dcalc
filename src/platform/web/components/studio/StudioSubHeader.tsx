import React from "react";
import {
  Calculator,
  BarChart3,
  Clock,
  Settings2,
  Package,
  Grid3x3,
  FileText,
  Users,
  ShoppingBag,
  ShieldCheck,
  Maximize,
  Sparkles,
  HelpCircle,
  Briefcase,
  Layers,
  LayoutGrid,
  ListOrdered,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { LayoutMode } from "@/shared/stores/layoutStore";

interface StudioSubHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenMiniDash: () => void;
  onOpenCopilot: () => void;
  onOpenShortcuts: () => void;
  onOpenQuoteModal: () => void;
}

export const StudioSubHeader: React.FC<StudioSubHeaderProps> = ({
  activeTab,
  onTabChange,
  layoutMode,
  onLayoutChange,
  currency,
  onCurrencyChange,
  focusMode,
  onToggleFocusMode,
  onOpenMiniDash,
  onOpenCopilot,
  onOpenShortcuts,
  onOpenQuoteModal,
}) => {
  const primaryTabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    dot?: boolean;
  }[] = [
    {
      id: "calculator",
      label: "Calculadora",
      icon: <Calculator className="w-3.5 h-3.5" />,
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
    {
      id: "infill",
      label: "Calc. Infill",
      icon: <Grid3x3 className="w-3.5 h-3.5" />,
    },
    {
      id: "inventory",
      label: "Insumos",
      icon: <Package className="w-3.5 h-3.5" />,
    },
    {
      id: "catalog",
      label: "Cadastros",
      icon: <Settings2 className="w-3.5 h-3.5" />,
    },
    {
      id: "history",
      label: "Histórico",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      id: "quotes",
      label: "Orçamentos",
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      id: "customers",
      label: "Clientes",
      icon: <Users className="w-3.5 h-3.5" />,
    },
    {
      id: "products",
      label: "Produtos",
      icon: <ShoppingBag className="w-3.5 h-3.5" />,
    },
    {
      id: "privacy",
      label: "Privacidade",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="h-11 bg-surface-raised border-b border-border-subtle px-4 flex items-center justify-between text-xs select-none sticky top-12 z-30">
      {/* Left: Primary tabs & Mode selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {primaryTabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[#18233c] text-blue-400 border border-blue-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#111728]"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/30">
                  {t.badge}
                </span>
              )}
              {t.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              )}
            </button>
          );
        })}

        {/* Mode selector when in calculator */}
        {activeTab === "calculator" && (
          <div className="hidden md:flex shrink-0 items-center gap-1 ml-3 pl-3 border-l border-slate-700/60">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">
              MODO:
            </span>
            <div className="flex items-center bg-[#111728] p-0.5 rounded-lg border border-[#212c45]">
              <button
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

      {/* Right controls */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {/* Modo Foco */}
        <button
          onClick={onToggleFocusMode}
          className={`flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
            focusMode
              ? "bg-purple-600/20 text-purple-300 border-purple-500/50"
              : "text-purple-400 hover:bg-purple-950/40 border-purple-500/30"
          }`}
          title="Alternar Modo Foco"
        >
          <Maximize className="w-3 h-3 text-purple-400" />
          <span>Modo Foco</span>
        </button>

        {/* Estúdio Pro Pill */}
        <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          Estúdio Pro
        </span>

        {/* Mini-Dash Button */}
        <button
          onClick={onOpenMiniDash}
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-950/60 transition-colors"
          title="Abrir Mini-Dash (tecla M)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Mini-Dash</span>
          <kbd className="text-[9px] bg-emerald-900/50 px-1 rounded text-emerald-300 border border-emerald-600/30 font-mono">
            M
          </kbd>
        </button>

        {/* Currency Switcher */}
        <div className="flex shrink-0 items-center bg-[#111728] border border-[#212c45] rounded-lg p-0.5">
          {["BRL", "USD", "EUR"].map((curr) => {
            const sym = curr === "BRL" ? "R$" : curr === "USD" ? "$" : "€";
            const isCurr = currency === curr;
            return (
              <button
                key={curr}
                onClick={() => onCurrencyChange(curr)}
                className={`min-h-11 min-w-11 shrink-0 px-2 py-0.5 text-[11px] font-bold rounded ${
                  isCurr
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>

        {/* Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="min-h-11 min-w-11 shrink-0 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Atalhos de teclado (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* IA Button */}
        <button
          onClick={onOpenCopilot}
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          title="Assistente IA"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>IA</span>
        </button>

        {/* Orçamento Button */}
        <button
          onClick={onOpenQuoteModal}
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:ring-2 hover:ring-blue-500/40 text-white transition-colors shadow-sm"
          title="Gerar Proposta & Orçamento"
        >
          <Briefcase className="w-3 h-3" />
          <span>Orçamento</span>
        </button>
      </div>
    </div>
  );
};
