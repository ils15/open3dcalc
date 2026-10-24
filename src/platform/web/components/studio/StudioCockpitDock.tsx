import React, { useState } from "react";
import {
  Plus,
  Maximize,
  HelpCircle,
  X,
  Calculator,
  Package,
  Printer,
  FileText,
  Sparkles,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { isLowStockSpool } from "@/shared/stores/spoolStore";
import { LOW_STOCK_GRAMS } from "@/shared/components/SpoolShelf/SpoolCard";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const entries = useHistoryStore((s) => s.entries);
  const spools = useFilamentInventory((s) => s.spools);
  // Dock pill mirrors the Mini-Dash summary: the same saved-history revenue
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
    ? "relative flex justify-center px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6"
    : "fixed inset-x-0 bottom-4 flex justify-center px-4";

  return (
    <>
      <div
        className={`${dockPosition} pointer-events-none select-none`}
        style={{ zIndex: "var(--z-passive)" }}
      >
        {/* Quick actions popup menu if open */}
        {showQuickActions && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-auto bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-2xl p-2 shadow-[var(--shadow-lg)] flex flex-col gap-1 w-56 max-w-[calc(100vw-2rem)] animate-fade-up">
            <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] text-xs font-bold text-[var(--color-text-secondary)]">
              <span>Ações Rápidas</span>
              <button
                onClick={() => setShowQuickActions(false)}
                className="min-h-11 min-w-11 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => {
                setShowQuickActions(false);
                onTabChange("calculator");
              }}
              className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-wash)] transition-colors text-left"
            >
              <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Novo Cálculo 3D</span>
            </button>
            <button
              onClick={() => {
                setShowQuickActions(false);
                onTabChange("inventory");
              }}
              className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-wash)] transition-colors text-left"
            >
              <Package className="w-3.5 h-3.5 text-[var(--color-warning)]" />
              <span>Cadastrar Carretel</span>
            </button>
            <button
              onClick={() => {
                setShowQuickActions(false);
                onTabChange("catalog");
              }}
              className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-wash)] transition-colors text-left"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--color-violet)]" />
              <span>Adicionar Impressora</span>
            </button>
            <button
              onClick={() => {
                setShowQuickActions(false);
                onOpenNewQuote();
              }}
              className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-wash)] transition-colors text-left"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--color-success)]" />
              <span>Emitir Orçamento PDF</span>
            </button>
            <button
              onClick={() => {
                setShowQuickActions(false);
                onOpenCopilot();
              }}
              className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-warning-subtle)] transition-colors text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--color-warning)]" />
              <span>Assistente IA de Impressão</span>
            </button>
          </div>
        )}

        {/* The floating dock pills. `shrink-0` on each pill keeps their intrinsic
          width so the ROW scrolls instead of squashing the labels; the row
          itself is the scroll container and is capped to the viewport. */}
        <div className="pointer-events-auto flex items-center bg-[var(--color-bg-elevated)] backdrop-blur-md border border-[var(--color-border)] rounded-full p-1 shadow-[var(--shadow-lg)] gap-1.5 overflow-x-auto max-w-full">
          {/* Mini-dash status indicator */}
          <button
            onClick={onOpenMiniDash}
            className="shrink-0 flex min-h-11 items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)] transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--color-positive)] animate-pulse"></span>
            <span className="text-[var(--color-positive)] font-bold">
              Mini-Dash
            </span>
            <span className="hidden text-[var(--color-text-secondary)] font-medium sm:inline">
              {revenueLabel}
            </span>
            <span className="hidden text-[var(--color-text-muted)] sm:inline">
              •
            </span>
            <span className="hidden text-[var(--color-info)] font-medium sm:inline">
              {t("minidash.calculations", { count: entries.length })}
            </span>
            {lowCount > 0 && (
              <>
                <span className="hidden text-[var(--color-text-muted)] sm:inline">
                  •
                </span>
                <span className="hidden rounded border border-[var(--color-warning-muted)] bg-[var(--color-warning-subtle)] px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-warning)] sm:inline">
                  {t("minidash.dockLowStock", { count: lowCount })}
                </span>
              </>
            )}
          </button>

          {/* Action button */}
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            aria-expanded={showQuickActions}
            className="shrink-0 flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--color-accent-fill)] hover:bg-[var(--color-accent-fill-hover)] text-[var(--color-accent-fill-fg)] transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Ações Rápidas</span>
          </button>

          {/* Modo foco */}
          <button
            onClick={onToggleFocusMode}
            aria-label="Modo Foco"
            className="shrink-0 min-h-11 min-w-11 p-1.5 text-[var(--color-violet)] hover:text-[var(--color-violet)] hover:bg-[var(--color-violet-muted)] rounded-full transition-colors"
            title="Modo Foco"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          {/* Atalhos */}
          <button
            onClick={onOpenShortcuts}
            aria-label="Atalhos de teclado"
            className="shrink-0 min-h-11 min-w-11 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"
            title="Atalhos (?)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {!isBetaChannel && (
        <div
          data-testid="cockpit-dock-clearance"
          aria-hidden="true"
          className="h-[calc(6rem+env(safe-area-inset-bottom))] shrink-0"
        />
      )}
    </>
  );
};
