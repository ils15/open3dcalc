import React from "react";
import { X, Printer, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";

interface StudioMiniDashOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tab: Tab) => void;
}

export const StudioMiniDashOverlay: React.FC<StudioMiniDashOverlayProps> = ({
  isOpen,
  onClose,
  onTabChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-overlay border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl p-5 flex flex-col gap-4 text-text-primary animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-positive animate-pulse"></span>
            <h3 className="font-bold text-sm text-text-primary">
              Mini-Dash & Visão Rápida da Oficina
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Main KPIs */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              FATURAMENTO
            </span>
            <span className="text-sm font-extrabold text-text-primary block mt-1">
              R$ 3.737,94
            </span>
            <span className="text-[10px] text-positive font-semibold flex items-center gap-0.5 mt-0.5">
              <ArrowUpRight className="w-2.5 h-2.5" /> 9 orçamentos
            </span>
          </div>

          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              LUCRO LÍQUIDO
            </span>
            <span className="text-sm font-extrabold text-positive block mt-1">
              R$ 1.980,05
            </span>
            <span className="text-[10px] text-text-secondary">Margem 53%</span>
          </div>

          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              MÁQUINAS
            </span>
            <span className="text-sm font-extrabold text-info block mt-1">
              2 / 6
            </span>
            <span className="text-[10px] text-positive font-semibold">
              imprimindo
            </span>
          </div>
        </div>

        {/* Alerts & Quick Status */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase text-text-secondary font-bold">
            ALERTAS DO ESTÚDIO
          </span>

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
                2 carretéis com estoque abaixo de 150g (TPU Laranja e Resina
                Azul)
              </span>
            </div>
            <span className="text-warning font-bold text-[10px] underline">
              Ver Estoque
            </span>
          </div>

          <div
            onClick={() => {
              onClose();
              onTabChange("catalog");
            }}
            className="flex items-center justify-between p-2.5 rounded-xl bg-surface-raised border border-border-subtle text-xs text-text-secondary cursor-pointer hover:bg-surface-overlay transition-colors"
          >
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-accent shrink-0" />
              <span>Ender 3 V3 SE em manutenção (lubrificação do eixo Z)</span>
            </div>
            <span className="text-info font-bold text-[10px] underline">
              Ver Frota
            </span>
          </div>
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
            Ir para Dashboard Completo →
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-primary text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
