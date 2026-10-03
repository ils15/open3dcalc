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
      <div className="bg-[#0b0f19] border border-[#1e2a44] rounded-2xl w-full max-w-md shadow-2xl p-5 flex flex-col gap-4 text-slate-100 animate-fade-up">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Atalhos de Teclado</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {shortcuts.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-[#101726] border border-[#1e2a44] text-xs"
            >
              <span className="text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 font-mono font-bold text-slate-200 border border-slate-700 text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:ring-2 hover:ring-blue-500/40 text-white text-xs font-semibold"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
