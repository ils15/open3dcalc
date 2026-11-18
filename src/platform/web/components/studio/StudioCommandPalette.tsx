import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Calculator,
  BarChart3,
  Warehouse,
  Spool,
  Store,
  FileText,
  Clock,
  Users,
  Package,
  Grid3x3,
  BookOpen,
  ShieldCheck,
  Layers,
  LayoutGrid,
  ListOrdered,
  Printer,
  FlaskConical,
  Sparkles,
  Maximize,
  Sun,
  Moon,
  Globe,
  Keyboard,
  CornerDownLeft,
  Check,
  X,
} from "lucide-react";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { Tab } from "@/shared/components/AppShell/tabs";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { useLayoutStore, type LayoutMode } from "@/shared/stores/layoutStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useSafeStudioTheme } from "./useSafeStudioTheme";

export interface StudioCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onOpenQuoteModal: () => void;
  onOpenWhatsAppModal: () => void;
  onOpenCopilot: () => void;
  onOpenMiniDash: () => void;
  onToggleFocusMode: () => void;
  onOpenShortcuts: () => void;
}

interface CommandItem {
  id: string;
  group: "nav" | "calc" | "actions";
  label: string;
  hint?: string;
  keywords: string;
  icon: React.ReactElement;
  shortcut?: string;
  isActive?: boolean;
  onSelect: () => void;
}

export const StudioCommandPalette: React.FC<StudioCommandPaletteProps> = (
  props,
) => {
  if (!props.isOpen) return null;
  return <StudioCommandPaletteDialog {...props} />;
};

const StudioCommandPaletteDialog: React.FC<StudioCommandPaletteProps> = ({
  onClose,
  activeTab,
  onTabChange,
  onOpenQuoteModal,
  onOpenWhatsAppModal,
  onOpenCopilot,
  onOpenMiniDash,
  onToggleFocusMode,
  onOpenShortcuts,
}) => {
  const { t, i18n } = useTranslation();
  const isEn = Boolean(i18n?.language?.startsWith("en"));
  const { theme, toggleTheme } = useSafeStudioTheme();
  const layoutMode = useLayoutStore((s) => s.layoutMode);
  const setLayoutMode = useLayoutStore((s) => s.setLayoutMode);
  const calcTech = useCalculatorStore((s) => s.activeTab);
  const setCalcTech = useCalculatorStore((s) => s.setActiveTab);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const items = useMemo<CommandItem[]>(() => {
    const goTab = (tab: Tab) => {
      onTabChange(tab);
      onClose();
    };
    const switchMode = (mode: LayoutMode) => {
      onTabChange("calculator");
      setLayoutMode(mode);
      onClose();
    };
    const switchTech = (tech: "fdm" | "resin") => {
      onTabChange("calculator");
      setCalcTech(tech);
      onClose();
    };

    const navItems: CommandItem[] = [
      {
        id: "nav-calculator",
        group: "nav",
        label: isEn ? "3D Calculator" : "Calculadora 3D",
        hint: isEn
          ? "Cost, print time & pricing"
          : "Custos, tempo e preço de venda",
        keywords: "calculadora calculo preco custo peca 3d calculator pricing",
        icon: <Calculator className="w-4 h-4 text-accent" />,
        shortcut: "1",
        isActive: activeTab === "calculator",
        onSelect: () => goTab("calculator"),
      },
      {
        id: "nav-dashboard",
        group: "nav",
        label: isEn ? "Overview Dashboard" : "Dashboard Geral",
        hint: isEn
          ? "KPIs, revenue & production charts"
          : "Indicadores, lucro e gráficos",
        keywords: "dashboard painel visao geral graficos lucro kpi",
        icon: <BarChart3 className="w-4 h-4 text-info" />,
        shortcut: "2",
        isActive: activeTab === "dashboard",
        onSelect: () => goTab("dashboard"),
      },
      {
        id: "nav-catalog",
        group: "nav",
        label: isEn
          ? "My Workshop (Printers & Materials)"
          : "Minha Oficina (Impressoras & Materiais)",
        hint: isEn
          ? "Fleet, filaments, profiles"
          : "Frota, materiais e parâmetros",
        keywords:
          "oficina impressoras materiais cadastros workshop printers fleet",
        icon: <Warehouse className="w-4 h-4 text-accent" />,
        shortcut: "3",
        isActive: activeTab === "catalog",
        onSelect: () => goTab("catalog"),
      },
      {
        id: "nav-inventory",
        group: "nav",
        label: isEn ? "Filament Spool Stock" : "Estoque de Carretéis",
        hint: isEn
          ? "Track spool weights & low stock"
          : "Controle de peso e alertas de reposição",
        keywords: "estoque carreteis filamento spool stock inventory",
        icon: <Spool className="w-4 h-4 text-warning" />,
        shortcut: "4",
        isActive: activeTab === "inventory",
        onSelect: () => goTab("inventory"),
      },
      {
        id: "nav-marketplace",
        group: "nav",
        label: isEn ? "Sales Channels & Fees" : "Canais de Venda & Taxas",
        hint: isEn
          ? "Shopee, Mercado Livre, Etsy fees"
          : "Taxas de marketplaces e lojas",
        keywords: "canais venda marketplace taxas shopee mercado livre loja",
        icon: <Store className="w-4 h-4 text-positive" />,
        isActive: activeTab === "marketplace",
        onSelect: () => goTab("marketplace"),
      },
      {
        id: "nav-quotes",
        group: "nav",
        label: isEn ? "Quotes & Proposals" : "Orçamentos & Propostas",
        hint: isEn
          ? "Commercial pipeline & PDF quotes"
          : "Propostas comerciais e acompanhamento",
        keywords: "orcamentos propostas comercial vendas quotes pdf",
        icon: <FileText className="w-4 h-4 text-positive" />,
        isActive: activeTab === "quotes",
        onSelect: () => goTab("quotes"),
      },
      {
        id: "nav-history",
        group: "nav",
        label: isEn ? "Saved History" : "Histórico de Cálculos",
        hint: isEn
          ? "Compare & reload past prints"
          : "Comparar e recarregar impressões salvas",
        keywords: "historico pedidos salvos history prints",
        icon: <Clock className="w-4 h-4 text-info" />,
        isActive: activeTab === "history",
        onSelect: () => goTab("history"),
      },
      {
        id: "nav-customers",
        group: "nav",
        label: isEn ? "Customers" : "Clientes",
        hint: isEn
          ? "Contacts & order history"
          : "Contatos e pedidos recorrentes",
        keywords: "clientes contatos crm customers",
        icon: <Users className="w-4 h-4 text-accent" />,
        isActive: activeTab === "customers",
        onSelect: () => goTab("customers"),
      },
      {
        id: "nav-products",
        group: "nav",
        label: isEn ? "Product Catalog" : "Catálogo de Produtos",
        hint: isEn
          ? "Ready-to-sell SKUs & margins"
          : "Peças prontas e margens por item",
        keywords: "produtos catalogo skus pecas products",
        icon: <Package className="w-4 h-4 text-warning" />,
        isActive: activeTab === "products",
        onSelect: () => goTab("products"),
      },
      {
        id: "nav-infill",
        group: "nav",
        label: isEn ? "Infill Calculator" : "Calculadora de Infill",
        hint: isEn
          ? "Weight & cost impact by infill %"
          : "Impacto de % de preenchimento no peso e custo",
        keywords: "infill preenchimento densidade peso volume",
        icon: <Grid3x3 className="w-4 h-4 text-info" />,
        isActive: activeTab === "infill",
        onSelect: () => goTab("infill"),
      },
      {
        id: "nav-wiki",
        group: "nav",
        label: isEn ? "Documentation & Wiki" : "Documentação & Wiki",
        hint: isEn
          ? "Formulas & 3D printing guides"
          : "Guias técnicos e fórmulas de custo",
        keywords: "wiki documentacao ajuda guia formulas docs",
        icon: <BookOpen className="w-4 h-4 text-text-secondary" />,
        isActive: activeTab === "wiki",
        onSelect: () => goTab("wiki"),
      },
      {
        id: "nav-changelog",
        group: "nav",
        label: isEn ? "Release Notes" : "Notas de Versão",
        hint: isEn
          ? "What changed in each version"
          : "Novidades e histórico de versões",
        keywords: "changelog novidades versao notas release",
        icon: <FileText className="w-4 h-4 text-text-secondary" />,
        isActive: activeTab === "changelog",
        onSelect: () => goTab("changelog"),
      },
    ];

    if (!isBetaChannel) {
      navItems.push({
        id: "nav-privacy",
        group: "nav",
        label: isEn ? "Privacy & Local Data" : "Privacidade & Dados Locais",
        hint: isEn
          ? "Local-first storage & portability"
          : "Armazenamento local e backup",
        keywords: "privacidade dados lgpd backup local privacy",
        icon: <ShieldCheck className="w-4 h-4 text-positive" />,
        isActive: activeTab === "privacy",
        onSelect: () => goTab("privacy"),
      });
    }

    const calcItems: CommandItem[] = [
      {
        id: "mode-classic",
        group: "calc",
        label: isEn
          ? "Calculator Mode: Classic"
          : "Modo da Calculadora: Clássico",
        hint: isEn
          ? "Full technical sections"
          : "Formulário técnico completo por seções",
        keywords: "modo classico classic formulario completo",
        icon: <Layers className="w-4 h-4 text-accent" />,
        isActive: activeTab === "calculator" && layoutMode === "classic",
        onSelect: () => switchMode("classic"),
      },
      {
        id: "mode-bento",
        group: "calc",
        label: isEn ? "Calculator Mode: Bento" : "Modo da Calculadora: Bento",
        hint: isEn
          ? "Compact visual card grid"
          : "Grade visual rápida em cartões",
        keywords: "modo bento cards grade compacto",
        icon: <LayoutGrid className="w-4 h-4 text-accent" />,
        isActive: activeTab === "calculator" && layoutMode === "bento",
        onSelect: () => switchMode("bento"),
      },
      {
        id: "mode-guided",
        group: "calc",
        label: isEn ? "Calculator Mode: Guided" : "Modo da Calculadora: Guiado",
        hint: isEn ? "Step-by-step wizard" : "Assistente passo a passo",
        keywords: "modo guiado wizard passo a passo guided",
        icon: <ListOrdered className="w-4 h-4 text-accent" />,
        isActive: activeTab === "calculator" && layoutMode === "guided",
        onSelect: () => switchMode("guided"),
      },
      {
        id: "tech-fdm",
        group: "calc",
        label: isEn
          ? "Technology: FDM (Filament)"
          : "Tecnologia: Impressão FDM (Filamento)",
        hint: isEn ? "PLA, PETG, ABS, Nylon, TPU" : "PLA, PETG, ABS, ASA, TPU",
        keywords: "fdm filamento pla petg abs impressora",
        icon: <Printer className="w-4 h-4 text-info" />,
        isActive: calcTech === "fdm",
        onSelect: () => switchTech("fdm"),
      },
      {
        id: "tech-resin",
        group: "calc",
        label: isEn
          ? "Technology: Resin (SLA/MSLA)"
          : "Tecnologia: Impressão em Resina (MSLA)",
        hint: isEn ? "UV Resin, wash & cure" : "Resina UV, lavagem IPA e cura",
        keywords: "resina sla msla uv dlp resin",
        icon: <FlaskConical className="w-4 h-4 text-warning" />,
        isActive: calcTech === "resin",
        onSelect: () => switchTech("resin"),
      },
    ];

    const actionItems: CommandItem[] = [
      {
        id: "act-quote",
        group: "actions",
        label: isEn
          ? "Generate PDF Quote / Proposal"
          : "Emitir Orçamento Comercial (PDF)",
        hint: isEn
          ? "Open commercial proposal generator"
          : "Abrir gerador de proposta e relatório",
        keywords: "gerar emitir orcamento pdf proposta relatorio quote",
        icon: <FileText className="w-4 h-4 text-positive" />,
        onSelect: () => {
          onClose();
          onOpenQuoteModal();
        },
      },
      {
        id: "act-whatsapp",
        group: "actions",
        label: isEn
          ? "Quick WhatsApp Proposal"
          : "Enviar Proposta via WhatsApp",
        hint: isEn
          ? "Format & share quote message"
          : "Formatar mensagem comercial rápida",
        keywords: "whatsapp zap enviar mensagem proposta",
        icon: <BrandIcon brand="whatsapp" className="w-4 h-4 text-positive" />,
        onSelect: () => {
          onClose();
          onOpenWhatsAppModal();
        },
      },
      {
        id: "act-copilot",
        group: "actions",
        label: isEn
          ? "3D Printing AI Assistant"
          : "Assistente IA de Impressão (Copilot)",
        hint: isEn
          ? "Analyze slicer params & margins"
          : "Dicas técnicas e revisão de precificação",
        keywords: "ia copilot assistente inteligencia artificial dicas",
        icon: <Sparkles className="w-4 h-4 text-warning" />,
        onSelect: () => {
          onClose();
          onOpenCopilot();
        },
      },
      {
        id: "act-theme",
        group: "actions",
        label:
          theme === "dark"
            ? isEn
              ? "Switch to Light Theme"
              : "Alternar para Modo Claro"
            : isEn
              ? "Switch to Dark Theme"
              : "Alternar para Modo Escuro",
        hint: isEn
          ? "Toggle Studio appearance"
          : "Mudar aparência clara/escura do Studio",
        keywords: "tema modo claro escuro dark light theme aparencia",
        icon:
          theme === "dark" ? (
            <Sun className="w-4 h-4 text-warning" />
          ) : (
            <Moon className="w-4 h-4 text-accent" />
          ),
        onSelect: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: "act-lang",
        group: "actions",
        label: isEn
          ? "Mudar idioma para Português (PT-BR)"
          : "Switch language to English (EN-US)",
        hint: isEn ? "Current: English" : "Atual: Português (Brasil)",
        keywords: "idioma lingua portugues ingles language english pt en",
        icon: <Globe className="w-4 h-4 text-info" />,
        onSelect: () => {
          if (typeof i18n?.changeLanguage === "function") {
            void i18n.changeLanguage(isEn ? "pt-BR" : "en-US");
          }
          onClose();
        },
      },
      {
        id: "act-minidash",
        group: "actions",
        label: isEn
          ? "Open Mini-Dash Summary"
          : "Abrir Resumo Rápido (Mini-Dash)",
        keywords: "minidash resumo rapido status",
        icon: <BarChart3 className="w-4 h-4 text-positive" />,
        shortcut: "M",
        onSelect: () => {
          onClose();
          onOpenMiniDash();
        },
      },
      {
        id: "act-focus",
        group: "actions",
        label: isEn ? "Toggle Focus Mode" : "Alternar Modo Foco",
        keywords: "modo foco tela cheia focus maximizar",
        icon: <Maximize className="w-4 h-4 text-text-secondary" />,
        shortcut: "F",
        onSelect: () => {
          onClose();
          onToggleFocusMode();
        },
      },
      {
        id: "act-shortcuts",
        group: "actions",
        label: isEn ? "Keyboard Shortcuts Reference" : "Ver Atalhos de Teclado",
        keywords: "atalhos teclado teclas shortcuts help",
        icon: <Keyboard className="w-4 h-4 text-text-secondary" />,
        shortcut: "?",
        onSelect: () => {
          onClose();
          onOpenShortcuts();
        },
      },
    ];

    return [...navItems, ...calcItems, ...actionItems];
  }, [
    activeTab,
    calcTech,
    i18n,
    isEn,
    layoutMode,
    onClose,
    onOpenCopilot,
    onOpenMiniDash,
    onOpenQuoteModal,
    onOpenShortcuts,
    onOpenWhatsAppModal,
    onTabChange,
    onToggleFocusMode,
    setCalcTech,
    setLayoutMode,
    theme,
    toggleTheme,
  ]);

  const filteredItems = useMemo(() => {
    const normalized = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!normalized) return items;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const haystack = `${item.label} ${item.hint ?? ""} ${item.keywords}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return tokens.every((tk) => haystack.includes(tk));
    });
  }, [items, query]);

  const safeIndex =
    filteredItems.length === 0
      ? 0
      : Math.min(selectedIndex, filteredItems.length - 1);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${safeIndex}"]`,
    );
    if (typeof activeEl?.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [safeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(
        filteredItems.length === 0 ? 0 : (safeIndex + 1) % filteredItems.length,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        filteredItems.length === 0
          ? 0
          : (safeIndex - 1 + filteredItems.length) % filteredItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = filteredItems[safeIndex];
      if (chosen) chosen.onSelect();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const trGroup = (key: string, ptFallback: string, enFallback: string) => {
    const resolved = t(key);
    if (resolved && resolved !== key) return resolved;
    return isEn ? enFallback : ptFallback;
  };

  const groupLabels: Record<CommandItem["group"], string> = {
    nav: trGroup(
      "studio.cmdGroupNav",
      "Módulos & Destinos",
      "Modules & Destinations",
    ),
    calc: trGroup(
      "studio.cmdGroupCalc",
      "Calculadora & Visualização",
      "Calculator & View Mode",
    ),
    actions: trGroup(
      "studio.cmdGroupActions",
      "Ações Rápidas & Preferências",
      "Quick Actions & Preferences",
    ),
  };

  let flatCursor = -1;
  const groupsOrder: CommandItem["group"][] = ["nav", "calc", "actions"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? "Navigation & Commands" : "Navegação & Comandos"}
      style={{ zIndex: "var(--z-dropdown)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 bg-overlay-scrim backdrop-blur-xs flex items-start justify-center pt-[10vh] px-3 sm:px-4"
    >
      <div className="w-full max-w-xl rounded-2xl border border-border-default bg-surface-overlay text-text-primary shadow-2xl overflow-hidden animate-fade-up">
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-3.5 py-2.5 bg-surface-raised">
          <Search className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={
              isEn
                ? "Search modules, modes, workshop or actions..."
                : "Buscar módulos, modos, oficina ou ações..."
            }
            aria-label={
              isEn
                ? "Search modules, modes, workshop or actions"
                : "Buscar módulos, modos, oficina ou ações"
            }
            className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none py-1.5"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              aria-label={isEn ? "Clear search" : "Limpar busca"}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-sunken transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={
              isEn ? "Close command palette" : "Fechar paleta de comandos"
            }
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <kbd className="px-1.5 py-0.5 rounded bg-surface-sunken border border-border-subtle font-mono text-[10px] font-semibold text-text-muted">
              Esc
            </kbd>
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          role="listbox"
          aria-label={isEn ? "Available commands" : "Comandos disponíveis"}
          className="max-h-[60vh] overflow-y-auto p-2 space-y-2"
        >
          {filteredItems.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-text-muted">
              {isEn
                ? "No matching command or destination found."
                : "Nenhum comando ou destino encontrado."}
            </div>
          ) : (
            groupsOrder.map((grp) => {
              const groupEntries = filteredItems.filter((i) => i.group === grp);
              if (groupEntries.length === 0) return null;
              return (
                <div key={grp} className="space-y-0.5">
                  <div className="px-2.5 pt-1 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                    {groupLabels[grp]}
                  </div>
                  {groupEntries.map((item) => {
                    flatCursor += 1;
                    const idx = flatCursor;
                    const isHighlighted = idx === safeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        data-cmd-index={idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={item.onSelect}
                        className={`w-full min-h-11 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isHighlighted
                            ? "bg-[var(--color-accent-wash)] text-text-primary border border-[var(--color-border-accent)]"
                            : "text-text-secondary hover:bg-surface-raised hover:text-text-primary border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken border border-border-subtle">
                            {item.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary truncate">
                              <span className="truncate">{item.label}</span>
                              {item.isActive && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-subtle px-1.5 py-0.5 text-[9px] font-mono font-bold text-accent border border-border-accent shrink-0">
                                  <Check className="w-2.5 h-2.5" />
                                  {isEn ? "Active" : "Ativo"}
                                </span>
                              )}
                            </div>
                            {item.hint && (
                              <div className="text-[11px] text-text-muted truncate">
                                {item.hint}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.shortcut && (
                            <kbd className="px-1.5 py-0.5 rounded bg-surface-sunken border border-border-subtle font-mono text-[10px] font-bold text-text-secondary">
                              {item.shortcut}
                            </kbd>
                          )}
                          {isHighlighted && (
                            <CornerDownLeft
                              className="w-3.5 h-3.5 text-accent"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-raised px-3.5 py-2 text-[10px] text-text-muted">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-border-subtle font-mono font-semibold">
                ↑↓
              </kbd>
              <span>{isEn ? "Navigate" : "Navegar"}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-surface-sunken border border-border-subtle font-mono font-semibold">
                ↵
              </kbd>
              <span>{isEn ? "Select" : "Selecionar"}</span>
            </span>
          </div>
          <span className="font-mono font-semibold text-accent">Ctrl + K</span>
        </div>
      </div>
    </div>
  );
};
