import React, { useState } from "react";
import {
  MessageCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  Calculator,
  BarChart3,
  Settings2,
  Clock,
  Package,
  Grid3x3,
  Users,
  ChevronRight,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { DemoModeButton } from "@/shared/components/DemoMode/DemoModeButton";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";

interface StudioHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onOpenCopilot: () => void;
  demoTemplate: "fdm" | "resin";
  onSelectDemoTemplate: (template: "fdm" | "resin") => void;
  currentProjectName?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenCopilot,
  demoTemplate,
  onSelectDemoTemplate,
  currentProjectName,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDemoMode = useIsDemoMode();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const getBreadcrumbInfo = () => {
    switch (activeTab) {
      case "dashboard":
        return {
          icon: <BarChart3 className="w-3.5 h-3.5 text-blue-400" />,
          title: "Dashboard Geral",
          subtitle: "Indicadores financeiros e status da oficina",
        };
      case "calculator":
        return {
          icon: <Calculator className="w-3.5 h-3.5 text-blue-400" />,
          title: "Calculadora 3D",
          subtitle: "Cálculo de custos, tempos e preço de venda",
        };
      case "inventory":
        return {
          icon: <Package className="w-3.5 h-3.5 text-amber-400" />,
          title: "Estoque de Carretéis",
          subtitle: "Controle de filamentos e preços por kg",
        };
      case "catalog":
        return {
          icon: <Settings2 className="w-3.5 h-3.5 text-blue-400" />,
          title: "Frota de Impressoras",
          subtitle: "Gerenciamento de máquinas e custos/hora",
        };
      case "history":
        return {
          icon: <Clock className="w-3.5 h-3.5 text-blue-400" />,
          title: "Histórico & Pedidos",
          subtitle: "Histórico de orçamentos gerados e status de produção",
        };
      case "infill":
        return {
          icon: <Grid3x3 className="w-3.5 h-3.5 text-blue-400" />,
          title: "Calculadora de Infill",
          subtitle: "Densidade volumétrica e padrões de preenchimento",
        };
      case "customers":
        return {
          icon: <Users className="w-3.5 h-3.5 text-blue-400" />,
          title: "Clientes",
          subtitle: "Gestão de contatos e pedidos recorrentes",
        };
      default:
        return {
          icon: <Calculator className="w-3.5 h-3.5 text-blue-400" />,
          title: "Open3DCalc Studio",
          subtitle: "Layouts de impressão e precificação",
        };
    }
  };

  const breadcrumb = getBreadcrumbInfo();

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `*Orçamento - Open3DCalc Studio*\n` +
        `Projeto: *${currentProjectName || "Projeto 3D"}*\n` +
        `Emitido via Open3DCalc Studio.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <header className="h-12 bg-[#090d16] border-b border-[#1b2438] px-4 flex items-center justify-between text-xs select-none sticky top-0 z-40">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-slate-300">
        <button
          onClick={() => onTabChange("calculator")}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <span className="text-slate-400 font-medium">Oficina 3D</span>
        </button>
        <ChevronRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center gap-1.5 font-semibold text-slate-100">
          {breadcrumb.icon}
          <span>{breadcrumb.title}</span>
        </div>
        <span className="text-slate-600 hidden md:inline">|</span>
        <span className="text-slate-400 hidden md:inline truncate max-w-[320px] 2xl:max-w-md">
          {breadcrumb.subtitle}
        </span>
      </div>

      {/* Center: Branding */}
      <div className="hidden lg:flex items-center gap-2 text-slate-400 font-medium tracking-wide">
        <span className="text-slate-300 font-bold tracking-tight">
          Open3DCalc
        </span>
        <span className="text-slate-500">Studio</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Template selector ONLY visible in Demo Mode */}
        {isDemoMode && (
          <div className="hidden sm:flex items-center gap-1 bg-[#151226] border border-purple-500/40 rounded-lg p-0.5 text-xs">
            <span className="text-[10px] font-mono text-purple-300 font-bold px-1.5 uppercase">
              Demo:
            </span>
            <button
              type="button"
              onClick={() => onSelectDemoTemplate("fdm")}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                demoTemplate === "fdm"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🖨️ Filamento (FDM)
            </button>
            <button
              type="button"
              onClick={() => onSelectDemoTemplate("resin")}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                demoTemplate === "resin"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              💧 Resina (MSLA)
            </button>
          </div>
        )}

        {/* Modo Demo Button (only appears when not in demo mode) */}
        <DemoModeButton />

        {/* Proposta WhatsApp button */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-all shadow-sm shadow-emerald-950/40"
          title="Gerar proposta rápida para WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
          <span className="hidden xs:inline">Proposta WhatsApp</span>
        </button>

        {/* Copilot IA button */}
        <button
          type="button"
          onClick={onOpenCopilot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-sm shadow-amber-950/40"
          title="Abrir Copilot IA"
        >
          <Sparkles className="w-3.5 h-3.5 fill-slate-950/20" />
          <span>Copilot IA</span>
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Alternar Tela Cheia"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
};
