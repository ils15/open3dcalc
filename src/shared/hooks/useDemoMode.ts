import { useEffect } from "react";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";

/**
 * Guarda do modo demo para componentes de exportação (JSON/PDF/orçamento).
 *
 * Enquanto ativo, a exportação deve ser bloqueada ou claramente marcada — os
 * dados são ficcionais e efêmeros, não faz sentido emitir documento com eles.
 *
 * Wiring completo da UI é Fase 1; Fase 0 fornece apenas o seletor.
 */
export function useIsDemoMode(): boolean {
  return useDemoModeStore((s) => s.isActive);
}

const BASE_TITLE =
  typeof document !== "undefined" ? document.title : "Open3DCalc";

/**
 * Marca o estado do demo no título da aba ("[DEMO] · …") enquanto a sessão
 * durar — a forma mais barata de impedir que a pessoa confunda a janela do
 * demo com a do dado real quando há mais de uma aba aberta.
 */
export function useDemoWindowTitle(): void {
  const isActive = useDemoModeStore((s) => s.isActive);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isActive) {
      document.title = `[DEMO] ${BASE_TITLE || "Open3DCalc"}`;
    } else if (document.title.startsWith("[DEMO] ")) {
      document.title = BASE_TITLE;
    }
    return () => {
      if (document.title.startsWith("[DEMO] ")) {
        document.title = BASE_TITLE;
      }
    };
  }, [isActive]);
}
