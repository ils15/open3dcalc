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
