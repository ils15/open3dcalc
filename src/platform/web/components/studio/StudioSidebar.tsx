import React from "react";
import {
  Box,
  Calculator,
  BarChart3,
  Grid3x3,
  Package,
  Settings2,
  Clock,
  Users,
  BookOpen,
  FileText,
  ShoppingBag,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { BrandIcon } from "@/platform/web/BrandIcon";

interface StudioSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  /** Optional per-module decoration (static hint and/or live count). */
  modules?: StudioModule[];
}

interface StudioModule {
  id: Tab;
  label: string;
  icon: React.ReactElement;
  /** Small static hint rendered after the label (e.g. "beta"). */
  badge?: string;
  /** Live count badge, e.g. the number of quotes awaiting action. */
  countBadge?: number;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  currency,
  onCurrencyChange,
  modules,
}) => {
  const allModules: StudioModule[] = [
    {
      id: "calculator" as Tab,
      label: "Calculadora",
      icon: <Calculator className="w-4 h-4" />,
    },
    {
      id: "dashboard" as Tab,
      label: "Dashboard",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: "infill" as Tab,
      label: "Calc. Infill",
      icon: <Grid3x3 className="w-4 h-4" />,
    },
    {
      id: "inventory" as Tab,
      label: "Insumos",
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: "catalog" as Tab,
      label: "Cadastros",
      icon: <Settings2 className="w-4 h-4" />,
    },
    {
      id: "history" as Tab,
      label: "Histórico",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      id: "quotes" as Tab,
      label: "Orçamentos",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: "customers" as Tab,
      label: "Clientes",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "products" as Tab,
      label: "Produtos",
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      id: "privacy" as Tab,
      label: "Privacidade",
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: "marketplace" as Tab,
      label: "Marketplace",
      icon: <Search className="w-4 h-4" />,
    },
  ];

  // The caller may override a module to attach a badge/count; unknown ids fall
  // back to the default entry so a typo degrades to a plain item instead of
  // dropping a navigation destination.
  const resolvedModules = allModules.map(
    (m) => modules?.find((o) => o.id === m.id) ?? m,
  );

  const resources = [
    {
      label: "Documentação / Wiki",
      icon: <BookOpen className="w-3.5 h-3.5" />,
      tab: "wiki" as Tab,
    },
    {
      label: "Notas de Versão",
      icon: <FileText className="w-3.5 h-3.5" />,
      tab: "changelog" as Tab,
    },
    {
      label: "Código no GitHub",
      icon: <BrandIcon brand="github" className="w-3.5 h-3.5" />,
      href: "https://github.com/ils15/open3dcalc",
    },
    {
      label: "Comunidade Telegram",
      icon: <BrandIcon brand="telegram" className="w-3.5 h-3.5" />,
      href: "https://t.me/open3dcalc",
    },
  ];

  return (
    <aside
      className={`bg-[#090d16] border-r border-[#1a2337] flex flex-col justify-between select-none shrink-0 transition-all duration-200 z-30 sticky top-0 h-screen ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Top branding */}
      <div>
        <div className="h-12 border-b border-[#1a2337] px-4 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Box className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-extrabold text-sm text-slate-100 tracking-tight">
                Open3DCalc
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                v2.5
              </span>
            </div>
          )}
        </div>

        {/* Modules Section */}
        <div className="px-3 py-3">
          {!collapsed && (
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
              MÓDULOS
            </p>
          )}
          <nav className="flex flex-col gap-1">
            {resolvedModules.map((m) => {
              const isActive = activeTab === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onTabChange(m.id)}
                  title={m.label}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#121828]"
                  }`}
                >
                  <span
                    className={isActive ? "text-blue-400" : "text-slate-400"}
                  >
                    {m.icon}
                  </span>
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between overflow-hidden text-left">
                      <span className="truncate">{m.label}</span>
                      {m.badge && (
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700/60">
                          {m.badge}
                        </span>
                      )}
                      {m.countBadge && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-1.5 py-0.2 rounded-full border border-blue-500/30">
                          {m.countBadge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Resources Section */}
        <div className="px-3 py-2 border-t border-[#1a2337]/60">
          {!collapsed && (
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
              RECURSOS
            </p>
          )}
          <nav className="flex flex-col gap-1">
            {resources.map((r, i) => {
              if (r.href) {
                return (
                  <a
                    key={i}
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    title={r.label}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#121828] transition-colors"
                  >
                    {r.icon}
                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between text-left">
                        <span className="truncate">{r.label}</span>
                        <ExternalLink className="w-3 h-3 text-slate-600" />
                      </div>
                    )}
                  </a>
                );
              }
              const isActive = activeTab === r.tab;
              return (
                <button
                  key={i}
                  onClick={() => r.tab && onTabChange(r.tab)}
                  title={r.label}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#121828]"
                  }`}
                >
                  {r.icon}
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between text-left">
                      <span className="truncate">{r.label}</span>
                      <ExternalLink className="w-3 h-3 text-slate-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom: Currency and Collapse toggle */}
      <div className="p-3 border-t border-[#1a2337]">
        {!collapsed && (
          <div className="mb-3 px-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span>Moeda Base</span>
              <span className="font-bold text-slate-300">{currency}</span>
            </div>
            <div className="flex items-center bg-[#111728] border border-[#212c45] rounded-lg p-0.5 w-full">
              {["BRL", "USD", "EUR"].map((curr) => {
                const sym = curr === "BRL" ? "R$" : curr === "USD" ? "$" : "€";
                const isCurr = currency === curr;
                return (
                  <button
                    key={curr}
                    onClick={() => onCurrencyChange(curr)}
                    className={`flex-1 py-1 text-[11px] font-bold rounded text-center transition-colors ${
                      isCurr
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#121828] border border-slate-800 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Recolher Painel</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
