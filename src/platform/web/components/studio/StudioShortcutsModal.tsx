import React from "react";
import { X, Keyboard } from "lucide-react";

interface StudioShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudioShortcutsModal: React.FC<StudioShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "1", desc: "Ir para Calculadora 3D" },
    { key: "2", desc: "Ir para Dashboard Geral" },
    { key: "3", desc: "Ir para Frota de Impressoras" },
    { key: "4", desc: "Ir para Estoque de Carretéis" },
    { key: "M", desc: "Abrir / Fechar Mini-Dash" },
    { key: "F", desc: "Alternar Modo Foco" },
    { key: "Esc", desc: "Fechar modais abertos" },
    { key: "?", desc: "Abrir esta tela de atalhos" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-overlay border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl p-5 flex flex-col gap-4 text-text-primary animate-fade-up">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-info" />
            <h3 className="font-bold text-sm text-text-primary">
              Atalhos de Teclado
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {shortcuts.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-raised border border-border-subtle text-xs"
            >
              <span className="text-text-secondary">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-surface-sunken font-mono font-bold text-text-secondary border border-border-subtle text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-semibold"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
