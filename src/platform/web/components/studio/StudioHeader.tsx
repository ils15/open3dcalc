import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
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
  Home,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { DemoModeButton } from "@/shared/components/DemoMode/DemoModeButton";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  useCurrencyPreference,
  useSetCurrency,
} from "@/shared/contexts/CurrencyContext";
import type { CurrencySetting } from "@/shared/lib/currency";
import { StudioSubHeader } from "./StudioSubHeader";

interface StudioHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  activeTechnology: "fdm" | "resin";
  onOpenQuoteModal: () => void;
  currentProjectName?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onTabChange,
  activeTechnology,
  onOpenQuoteModal,
  currentProjectName,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useTranslation();
  const { currencySetting } = useCurrencyPreference();
  const { currency: resolvedCurrency } = useCurrency();
  const setCurrency = useSetCurrency();

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
          icon: (
            <BarChart3 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: "Dashboard Geral",
          subtitle: "Indicadores financeiros e status da oficina",
        };
      case "calculator":
        return {
          icon: (
            <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: "Calculadora 3D",
          subtitle: "Cálculo de custos, tempos e preço de venda",
        };
      case "inventory":
        return {
          icon: <Package className="w-3.5 h-3.5 text-[var(--color-warning)]" />,
          title: "Estoque de Carretéis",
          subtitle: "Controle de filamentos e preços por kg",
        };
      case "catalog":
        return {
          icon: (
            <Settings2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: "Frota de Impressoras",
          subtitle: "Gerenciamento de máquinas e custos/hora",
        };
      case "marketplace":
        return {
          icon: (
            <Settings2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: t("marketplaceBrowse.title"),
          subtitle: t("marketplaceBrowse.subtitle"),
        };
      case "history":
        return {
          icon: <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: "Histórico & Pedidos",
          subtitle: "Histórico de orçamentos gerados e status de produção",
        };
      case "infill":
        return {
          icon: <Grid3x3 className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: "Calculadora de Infill",
          subtitle: "Densidade volumétrica e padrões de preenchimento",
        };
      case "customers":
        return {
          icon: <Users className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: "Clientes",
          subtitle: "Gestão de contatos e pedidos recorrentes",
        };
      default:
        return {
          icon: (
            <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: "Open3DCalc Studio",
          subtitle: "Layouts de impressão e precificação",
        };
    }
  };

  const breadcrumb = getBreadcrumbInfo();

  const handleWhatsApp = () => {
    if (guardExport()) return;
    const text = encodeURIComponent(
      `*Orçamento - Open3DCalc Studio*\n` +
        `Projeto: *${currentProjectName || "Projeto 3D"}*\n` +
        `Emitido via Open3DCalc Studio.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-16 flex-col items-stretch justify-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)] select-none sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-1">
      {/* Global navigation and page hierarchy stay in the shell on every module. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <nav aria-label="Navegação global" className="shrink-0">
          <button
            type="button"
            onClick={() => onTabChange("dashboard")}
            aria-label="Ir para o Dashboard"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
        <ChevronRight
          className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold tracking-tight text-[var(--color-text-primary)] sm:text-base">
            {breadcrumb.icon}
            <span className="truncate">{breadcrumb.title}</span>
          </h1>
          <p className="hidden truncate text-[11px] leading-tight text-[var(--color-text-secondary)] lg:block">
            {breadcrumb.subtitle}
          </p>
        </div>
      </div>

      {/* The selector writes to the persisted calculator preference; all
          calculator surfaces subscribe through useCurrency(). */}
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
        {activeTab === "calculator" && (
          <div
            role="status"
            aria-label="Tecnologia ativa"
            title={
              activeTechnology === "resin"
                ? "Tecnologia ativa: Resina (MSLA)"
                : "Tecnologia ativa: Filamento (FDM)"
            }
            className="flex min-h-11 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1.5 text-[10px] font-semibold text-[var(--color-text-secondary)] sm:px-2 sm:text-[11px]"
          >
            {activeTechnology === "resin" ? "Resina" : "FDM"}
          </div>
        )}

        <label className="sr-only" htmlFor="studio-currency">
          Moeda base
        </label>
        <select
          id="studio-currency"
          aria-label="Moeda base"
          aria-describedby="studio-currency-status"
          value={currencySetting}
          onChange={(event) =>
            setCurrency(event.currentTarget.value as CurrencySetting)
          }
          className="min-h-11 w-[4.5rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1.5 text-xs font-semibold text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:w-24 sm:px-2"
        >
          <option value="auto">Auto</option>
          <option value="BRL">BRL</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
        <span
          id="studio-currency-status"
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          Moeda ativa: {resolvedCurrency}
        </span>

        {/* Modo Demo Button (only appears when not in demo mode) */}
        <DemoModeButton />

        <StudioSubHeader onOpenQuoteModal={onOpenQuoteModal} />

        {/* Proposta WhatsApp button */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex min-h-11 min-w-11 items-center gap-1.5 px-1.5 py-1.5 rounded-lg bg-[var(--color-positive-fill)] hover:opacity-90 text-[var(--color-positive-fill-fg)] font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:px-3"
          title="Gerar proposta rápida para WhatsApp"
          aria-label="Proposta WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Proposta WhatsApp</span>
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="min-h-11 min-w-11 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
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
