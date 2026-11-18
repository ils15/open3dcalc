import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Maximize2,
  Minimize2,
  Calculator,
  BarChart3,
  Warehouse,
  Clock,
  Spool,
  Store,
  Grid3x3,
  Users,
  ChevronRight,
  Home,
  FileText,
  Package,
  ShieldCheck,
  BookOpen,
  Search,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { isWorkshopRoute, Tab } from "@/shared/components/AppShell/tabs";
import { DemoModeButton } from "@/shared/components/DemoMode/DemoModeButton";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  useCurrencyPreference,
  useSetCurrency,
} from "@/shared/contexts/CurrencyContext";
import type { CurrencySetting } from "@/shared/lib/currency";
import { DataSyncButton } from "@/shared/components/ui/DataSyncButton";
import { StudioSubHeader } from "./StudioSubHeader";
import { useSafeStudioTheme } from "./useSafeStudioTheme";

interface StudioHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  activeTechnology: "fdm" | "resin";
  onOpenQuoteModal: () => void;
  onOpenWhatsAppModal?: () => void;
  onOpenCommandPalette?: () => void;
  currentProjectName?: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onTabChange,
  activeTechnology,
  onOpenQuoteModal,
  onOpenWhatsAppModal,
  onOpenCommandPalette,
  currentProjectName,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t, i18n } = useTranslation();
  const isEn = Boolean(i18n?.language?.startsWith("en"));
  const { theme, toggleTheme } = useSafeStudioTheme();
  const isDark = theme === "dark";
  const { currencySetting } = useCurrencyPreference();
  const { currency: resolvedCurrency } = useCurrency();
  const setCurrency = useSetCurrency();

  const tr = (key: string, ptFallback: string, enFallback: string): string => {
    const resolved = t(key);
    if (resolved && resolved !== key) return resolved;
    return isEn ? enFallback : ptFallback;
  };

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

  const toggleLanguage = () => {
    const next = isEn ? "pt-BR" : "en-US";
    if (typeof i18n?.changeLanguage === "function") {
      void i18n.changeLanguage(next);
    }
  };

  const getBreadcrumbInfo = () => {
    switch (activeTab) {
      case "dashboard":
        return {
          icon: (
            <BarChart3 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: tr(
            "studio.dashboardTitle",
            "Dashboard Geral",
            "Overview Dashboard",
          ),
          subtitle: tr(
            "studio.dashboardSub",
            "Resumo dos cálculos salvos e da estrutura da oficina",
            "Summary of saved calculations and workshop setup",
          ),
        };
      case "calculator":
        return {
          icon: (
            <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: tr("studio.calcTitle", "Calculadora 3D", "3D Calculator"),
          subtitle: tr(
            "studio.calcSub",
            "Cálculo de custos, tempos e preço de venda",
            "Cost, print time and selling price breakdown",
          ),
        };
      case "catalog":
        return {
          icon: (
            <Warehouse className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: t("workshop.title"),
          subtitle: t("workshop.subtitle"),
        };
      case "inventory":
        return {
          icon: <Spool className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: t("workshop.title"),
          subtitle: t("workshop.stock"),
        };
      case "marketplace":
        return {
          icon: <Store className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: t("workshop.title"),
          subtitle: t("workshop.salesChannels"),
        };
      case "history":
        return {
          icon: <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: tr(
            "studio.historyTitle",
            "Histórico & Pedidos",
            "History & Orders",
          ),
          subtitle: tr(
            "studio.historySub",
            "Histórico de orçamentos gerados e status de produção",
            "Generated quotes history and production status",
          ),
        };
      case "infill":
        return {
          icon: <Grid3x3 className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: tr(
            "studio.infillTitle",
            "Calculadora de Infill",
            "Infill Calculator",
          ),
          subtitle: tr(
            "studio.infillSub",
            "Densidade volumétrica e padrões de preenchimento",
            "Volumetric density and infill pattern comparison",
          ),
        };
      case "customers":
        return {
          icon: <Users className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: t("tabs.customers"),
          subtitle: tr(
            "studio.customersSub",
            "Gestão de contatos e pedidos recorrentes",
            "Contact management and repeat orders",
          ),
        };
      case "quotes":
        return {
          icon: <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: t("tabs.quotes"),
          subtitle: tr(
            "studio.quotesSub",
            "Gestão comercial, propostas em PDF e acompanhamento",
            "Commercial management, PDF proposals and follow-ups",
          ),
        };
      case "products":
        return {
          icon: <Package className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: t("tabs.products"),
          subtitle: tr(
            "studio.productsSub",
            "Itens finalizados e histórico de precificação",
            "Finished items and pricing history",
          ),
        };
      case "privacy":
        return {
          icon: (
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: tr(
            "studio.privacyTitle",
            "Privacidade & Dados",
            "Privacy & Data",
          ),
          subtitle: tr(
            "studio.privacySub",
            "Armazenamento local e portabilidade de dados",
            "Local-first storage and data portability",
          ),
        };
      case "wiki":
        return {
          icon: <BookOpen className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: tr(
            "studio.wikiTitle",
            "Documentação & Wiki",
            "Documentation & Wiki",
          ),
          subtitle: tr(
            "studio.wikiSub",
            "Guias, fórmulas e referências técnicas de impressão 3D",
            "Guides, formulas and 3D printing technical references",
          ),
        };
      case "changelog":
        return {
          icon: <FileText className="w-3.5 h-3.5 text-[var(--color-accent)]" />,
          title: tr(
            "studio.changelogTitle",
            "Notas de Versão",
            "Release Notes",
          ),
          subtitle: tr(
            "studio.changelogSub",
            "Histórico de lançamentos e novidades do Open3DCalc",
            "Release history and what's new in Open3DCalc",
          ),
        };
      default:
        return {
          icon: (
            <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          ),
          title: "Open3DCalc Studio",
          subtitle: tr(
            "studio.defaultSub",
            "Layouts de impressão e precificação",
            "Print layouts and pricing",
          ),
        };
    }
  };

  const breadcrumb = getBreadcrumbInfo();
  const trimmedProject = currentProjectName?.trim();

  const handleWhatsApp = () => {
    if (guardExport()) return;
    if (onOpenWhatsAppModal) {
      onOpenWhatsAppModal();
      return;
    }
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
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
        <nav aria-label="Navegação global" className="shrink-0">
          <button
            type="button"
            onClick={() => onTabChange("dashboard")}
            aria-label="Ir para o Dashboard"
            title="Ir para o Dashboard"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
        <ChevronRight
          className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)]">
          {breadcrumb.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-bold tracking-tight text-[var(--color-text-primary)] sm:text-base">
              {breadcrumb.title}
            </h1>
            {activeTab === "calculator" && trimmedProject && (
              <span
                title={trimmedProject}
                className="hidden xl:inline-flex max-w-[11rem] truncate rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]"
              >
                {trimmedProject}
              </span>
            )}
            {isWorkshopRoute(activeTab) && (
              <div
                role="group"
                aria-label={tr(
                  "studio.headerWorkshopQuickNav",
                  "Atalhos da Oficina",
                  "Workshop Quick Links",
                )}
                className="hidden 2xl:inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-0.5"
              >
                {(
                  [
                    {
                      id: "catalog" as Tab,
                      label: tr(
                        "nav.workshopSubPrinters",
                        "Impressoras & Materiais",
                        "Printers & Materials",
                      ),
                    },
                    {
                      id: "inventory" as Tab,
                      label: tr(
                        "nav.workshopSubInventory",
                        "Estoque de Carretéis",
                        "Spool Inventory",
                      ),
                    },
                    {
                      id: "marketplace" as Tab,
                      label: tr(
                        "nav.workshopSubMarketplace",
                        "Canais & Taxas",
                        "Sales Channels & Fees",
                      ),
                    },
                  ] as const
                ).map((item) => {
                  const isSubActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      aria-pressed={isSubActive}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                        isSubActive
                          ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="hidden truncate text-[11px] leading-tight text-[var(--color-text-secondary)] xl:block">
            {breadcrumb.subtitle}
          </p>
        </div>
      </div>

      {/* Zone 2 (Utilities & Preferences) + Zone 3 (Commercial Output CTAs).
          Direct parent of #studio-currency keeps gap-1 sm:gap-2 (8px at >=640px). */}
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-keyshortcuts="Control+K"
            aria-label={tr(
              "studio.cmdTriggerAria",
              "Abrir busca rápida e comandos (Ctrl+K)",
              "Open quick search and commands (Ctrl+K)",
            )}
            title={tr(
              "studio.cmdTriggerAria",
              "Abrir busca rápida e comandos (Ctrl+K)",
              "Open quick search and commands (Ctrl+K)",
            )}
            className="hidden md:inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Search className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
            <span className="hidden 2xl:inline text-[var(--color-text-muted)]">
              {tr("studio.cmdTrigger", "Buscar...", "Search...")}
            </span>
            <kbd className="hidden lg:inline-block rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--color-text-muted)]">
              ⌘K
            </kbd>
          </button>
        )}

        {activeTab === "calculator" && (
          <div
            role="status"
            aria-label="Tecnologia ativa"
            title={
              activeTechnology === "resin"
                ? "Tecnologia ativa: Resina (MSLA)"
                : "Tecnologia ativa: Filamento (FDM)"
            }
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1.5 text-[10px] font-semibold text-[var(--color-text-secondary)] sm:px-2.5 sm:text-[11px]"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shrink-0"
            />
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
          className="min-h-11 w-[5.25rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1.5 text-xs font-semibold text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:w-[5.5rem] sm:px-2"
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

        {/* Language Toggle (Desktop/Laptop; also available in Command Palette & Dock) */}
        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={tr("nav.language", "Mudar idioma", "Change language")}
          title={tr("nav.language", "Mudar idioma", "Change language")}
          className="hidden xl:inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[11px] font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isEn ? "PT" : "EN"}</span>
        </button>

        {/* Theme Toggle (Tablet/Desktop; also available in Dock Quick Actions for mobile) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            isDark ? "Alternar para modo claro" : "Alternar para modo escuro"
          }
          title={
            isDark ? "Alternar para modo claro" : "Alternar para modo escuro"
          }
          className="hidden md:inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Dados & Backup Modal Quick Access (compact icon-only button matching ThemeToggle) */}
        <DataSyncButton
          variant="icon"
          hideLabel
          className="min-h-11 min-w-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]"
        />

        {/* Modo Demo Button (only appears when not in demo mode) */}
        <DemoModeButton />

        <div
          aria-hidden="true"
          className="hidden sm:block h-5 w-px bg-[var(--color-border)] shrink-0"
        />

        <StudioSubHeader onOpenQuoteModal={onOpenQuoteModal} />

        {/* Proposta WhatsApp button */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-positive-fill)] bg-[var(--color-positive-fill)] px-1.5 py-1.5 font-semibold text-[var(--color-positive-fill-fg)] shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:px-3"
          title="Gerar proposta rápida para WhatsApp"
          aria-label="Proposta WhatsApp"
        >
          <BrandIcon brand="whatsapp" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Proposta WhatsApp</span>
        </button>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="hidden sm:inline-flex items-center justify-center min-h-11 min-w-11 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          title="Alternar Tela Cheia"
          aria-label="Alternar Tela Cheia"
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
