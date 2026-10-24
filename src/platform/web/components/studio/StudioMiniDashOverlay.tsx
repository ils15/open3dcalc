import React from "react";
import { X, AlertTriangle, ArrowUpRight, Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { isLowStockSpool } from "@/shared/stores/spoolStore";
import { LOW_STOCK_GRAMS } from "@/shared/components/SpoolShelf/SpoolCard";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";

interface StudioMiniDashOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tab: Tab) => void;
}

/**
 * Mini-Dash summarises the same saved-history and spool-inventory data the
 * full dashboard reads — no fabricated machine state or fixed totals. Every
 * row links to the surface that owns the records.
 */
export const StudioMiniDashOverlay: React.FC<StudioMiniDashOverlayProps> = ({
  isOpen,
  onClose,
  onTabChange,
}) => {
  const { t } = useTranslation();
  const isDemoMode = useIsDemoMode();
  const entries = useHistoryStore((s) => s.entries);
  const spools = useFilamentInventory((s) => s.spools);

  if (!isOpen) return null;

  const revenue = entries.reduce((sum, entry) => sum + entry.sellPrice, 0);
  const profit = entries.reduce((sum, entry) => sum + entry.profit, 0);
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const lowSpools = spools.filter((spool) =>
    isLowStockSpool(spool, LOW_STOCK_GRAMS),
  );

  const revenueLabel = isDemoMode
    ? t("minidash.demoLabel")
    : revenue.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
  const profitLabel = isDemoMode
    ? t("minidash.demoLabel")
    : profit.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-overlay border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl p-5 flex flex-col gap-4 text-text-primary animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-text-primary">
              {t("minidash.title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("minidash.close")}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Main KPIs: derived from the saved-history store */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              {t("minidash.revenue")}
            </span>
            <span className="text-sm font-extrabold text-text-primary block mt-1">
              {revenueLabel}
            </span>
            <span className="text-[10px] text-text-secondary flex items-center gap-0.5 mt-0.5">
              <ArrowUpRight className="w-2.5 h-2.5" />{" "}
              {t("minidash.calculations", { count: entries.length })}
            </span>
          </div>

          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              {t("minidash.netProfit")}
            </span>
            <span className="text-sm font-extrabold text-positive block mt-1">
              {profitLabel}
            </span>
            <span className="text-[10px] text-text-secondary">
              {t("minidash.margin", { margin: Math.round(marginPct) })}
            </span>
          </div>

          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              {t("minidash.spools")}
            </span>
            <span className="text-sm font-extrabold text-info block mt-1">
              {spools.length}
            </span>
            <span className="text-[10px] text-text-secondary">
              {t("minidash.registeredSpools")}
            </span>
          </div>
        </div>

        {/* Alerts: real low-stock records only; no fabricated machine status */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase text-text-secondary font-bold">
            {t("minidash.alerts")}
          </span>

          {lowSpools.length > 0 && (
            <div
              onClick={() => {
                onClose();
                onTabChange("inventory");
              }}
              className="flex items-center justify-between p-2.5 rounded-xl bg-warning-subtle border border-warning/30 text-xs text-warning cursor-pointer hover:bg-warning-subtle transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <span>
                  {t("minidash.lowStock", { count: lowSpools.length })}
                </span>
              </div>
              <span className="text-warning font-bold text-[10px] underline">
                {t("minidash.seeStock")}
              </span>
            </div>
          )}
          {lowSpools.length === 0 && (
            <div
              onClick={() => {
                onClose();
                onTabChange("history");
              }}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-raised border border-border-subtle text-xs text-text-secondary cursor-pointer hover:bg-surface-overlay transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-accent shrink-0" />
                <span>
                  {isDemoMode
                    ? t("minidash.demoSession")
                    : t("minidash.noAlerts", { count: entries.length })}
                </span>
              </div>
              <span className="text-info font-bold text-[10px] underline">
                {t("minidash.seeHistory")}
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <button
            onClick={() => {
              onClose();
              onTabChange("dashboard");
            }}
            className="text-xs text-info hover:underline font-semibold"
          >
            {t("minidash.goDashboard")}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-primary text-xs font-semibold"
          >
            {t("minidash.close")}
          </button>
        </div>
      </div>
    </div>
  );
};
