import React, { useEffect, useState } from "react";
import {
  Plus,
  Maximize,
  Keyboard,
  X,
  Calculator,
  Package,
  Printer,
  FileText,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { isLowStockSpool } from "@/shared/stores/spoolStore";
import { LOW_STOCK_GRAMS } from "@/shared/components/SpoolShelf/SpoolCard";
import { APP_VERSION } from "@/shared/version";
import { useTranslation } from "react-i18next";

interface StudioCockpitDockProps {
  onOpenMiniDash: () => void;
  onToggleFocusMode: () => void;
  onOpenShortcuts: () => void;
  onTabChange: (tab: Tab) => void;
  onOpenCopilot: () => void;
  onOpenNewQuote: () => void;
}

const QUICK_ACTION_CLASS =
  "flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-wash)] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

const ICON_BUTTON_CLASS =
  "shrink-0 flex items-center justify-center min-h-11 min-w-11 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

/**
 * The Studio's unified bottom bar.
 *
 * It used to be a floating pill that sat over a large in-page footer card, and
 * the two competed for the same strip of screen. Everything that footer card
 * carried that is worth having on every screen (version, changelog, source,
 * local-first status) now lives here, in one fixed, edge-to-edge status bar in
 * the IDE pattern: status on the left, the primary action centered, utilities
 * on the right. Navigation stays in the sidebar, so nothing is duplicated.
 */
export const StudioCockpitDock: React.FC<StudioCockpitDockProps> = ({
  onOpenMiniDash,
  onToggleFocusMode,
  onOpenShortcuts,
  onTabChange,
  onOpenCopilot,
  onOpenNewQuote,
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const { t } = useTranslation();
  const entries = useHistoryStore((s) => s.entries);
  const spools = useFilamentInventory((s) => s.spools);
  // The bar mirrors the Mini-Dash summary: the same saved-history revenue
  // and low-stock count, never fabricated machine state.
  const revenue = entries.reduce((sum, entry) => sum + entry.sellPrice, 0);
  const lowCount = spools.filter((spool) =>
    isLowStockSpool(spool, LOW_STOCK_GRAMS),
  ).length;
  const revenueLabel = revenue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const dockPosition = isBetaChannel
    ? "relative px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6"
    : "fixed inset-x-0 bottom-0";

  useEffect(() => {
    if (!showQuickActions) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowQuickActions(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showQuickActions]);

  const runAction = (action: () => void) => {
    setShowQuickActions(false);
    action();
  };

  return (
    <>
      <div
        data-testid="studio-cockpit-bar"
        className={`${dockPosition} pointer-events-none select-none`}
        style={{ zIndex: "var(--z-passive)" }}
      >
        {/* Quick actions menu, anchored above the centered trigger. */}
        {showQuickActions && (
          <div
            role="group"
            aria-label="Menu de ações rápidas"
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-auto bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-2xl p-2 shadow-[var(--shadow-lg)] w-[22rem] max-w-[calc(100vw-1.5rem)] animate-fade-up"
          >
            <div className="flex items-center justify-between pl-3 pr-1 pb-1 mb-1 border-b border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)]">
              <span>Ações Rápidas</span>
              <button
                type="button"
                onClick={() => setShowQuickActions(false)}
                aria-label="Fechar ações rápidas"
                className={ICON_BUTTON_CLASS}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => runAction(() => onTabChange("calculator"))}
                className={QUICK_ACTION_CLASS}
              >
                <Calculator className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
                <span>Novo Cálculo 3D</span>
              </button>
              <button
                type="button"
                onClick={() => runAction(onOpenNewQuote)}
                className={QUICK_ACTION_CLASS}
              >
                <FileText className="w-4 h-4 shrink-0 text-[var(--color-success)]" />
                <span>Emitir Orçamento PDF</span>
              </button>
              <button
                type="button"
                onClick={() => runAction(() => onTabChange("inventory"))}
                className={QUICK_ACTION_CLASS}
              >
                <Package className="w-4 h-4 shrink-0 text-[var(--color-warning)]" />
                <span>Cadastrar Carretel</span>
              </button>
              <button
                type="button"
                onClick={() => runAction(() => onTabChange("catalog"))}
                className={QUICK_ACTION_CLASS}
              >
                <Printer className="w-4 h-4 shrink-0 text-[var(--color-violet)]" />
                <span>Adicionar Impressora</span>
              </button>
              <button
                type="button"
                onClick={() => runAction(onOpenCopilot)}
                className={`${QUICK_ACTION_CLASS} sm:col-span-2`}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-[var(--color-warning)]" />
                <span>Assistente IA de Impressão</span>
              </button>
            </div>
          </div>
        )}

        {/* The bar itself: status | primary action | utilities. */}
        <div
          role="toolbar"
          aria-label="Barra do Studio"
          className="pointer-events-auto w-full border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] backdrop-blur-md shadow-[var(--shadow-lg)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto w-full max-w-[100rem] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 sm:px-4 py-1.5">
            {/* Left: live status */}
            <div className="min-w-0 flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenMiniDash}
                title="Abrir Mini-Dash (M)"
                className="min-w-0 max-w-full flex min-h-11 items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] transition-colors overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <span className="w-2 h-2 shrink-0 rounded-full bg-[var(--color-positive)] animate-pulse"></span>
                <span className="shrink-0 text-[var(--color-positive)] font-bold">
                  Mini-Dash
                </span>
                <span className="hidden truncate text-[var(--color-text-secondary)] font-medium md:inline">
                  {revenueLabel}
                </span>
                <span className="hidden text-[var(--color-text-muted)] lg:inline">
                  •
                </span>
                <span className="hidden truncate text-[var(--color-info)] font-medium lg:inline">
                  {t("minidash.calculations", { count: entries.length })}
                </span>
                {lowCount > 0 && (
                  <span className="hidden shrink-0 rounded border border-[var(--color-warning-muted)] bg-[var(--color-warning-subtle)] px-1.5 text-[10px] font-bold text-[var(--color-warning)] xl:inline">
                    {t("minidash.dockLowStock", { count: lowCount })}
                  </span>
                )}
              </button>
            </div>

            {/* Center: the one primary action */}
            <button
              type="button"
              onClick={() => setShowQuickActions(!showQuickActions)}
              aria-expanded={showQuickActions}
              aria-haspopup="true"
              aria-label="Ações Rápidas"
              className="shrink-0 flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--color-accent-fill)] hover:bg-[var(--color-accent-fill-hover)] text-[var(--color-accent-fill-fg)] transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Plus
                className={`w-4 h-4 stroke-[2.5] transition-transform ${showQuickActions ? "rotate-45" : ""}`}
              />
              <span className="hidden sm:inline">Ações Rápidas</span>
            </button>

            {/* Right: product info + utilities */}
            <div className="min-w-0 flex items-center justify-end gap-1">
              <span
                className="hidden xl:inline-flex items-center gap-1.5 px-2 text-[11px] text-[var(--color-text-muted)]"
                title="Local-First: seus dados e arquivos nunca saem deste computador"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-positive)]" />
                Local-First
              </span>
              <button
                type="button"
                onClick={() => onTabChange("changelog")}
                title="Notas de versão"
                className="hidden md:inline-flex min-h-11 items-center gap-1.5 px-2.5 rounded-lg font-mono text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                v{APP_VERSION}
              </button>
              <a
                href="https://github.com/ils15/open3dcalc"
                target="_blank"
                rel="noreferrer"
                aria-label="Código aberto no GitHub"
                title="Código aberto no GitHub"
                className={`hidden sm:flex ${ICON_BUTTON_CLASS}`}
              >
                <BrandIcon brand="github" className="w-4 h-4" />
              </a>
              <div
                className="hidden sm:block h-5 w-px bg-[var(--color-border)] shrink-0 mx-0.5"
                aria-hidden="true"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleFocusMode}
                  aria-label="Modo Foco"
                  title="Modo Foco"
                  className={ICON_BUTTON_CLASS}
                >
                  <Maximize className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenShortcuts}
                  aria-label="Atalhos de teclado"
                  title="Atalhos (?)"
                  className={ICON_BUTTON_CLASS}
                >
                  <Keyboard className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {!isBetaChannel && (
        <div
          data-testid="cockpit-dock-clearance"
          aria-hidden="true"
          className="h-[calc(3.5rem+1px+env(safe-area-inset-bottom))] shrink-0"
        />
      )}
    </>
  );
};
