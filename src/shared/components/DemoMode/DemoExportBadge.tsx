import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { useIsDemoMode } from "@/shared/hooks/useDemoMode";

/**
 * Marca uma área de exportação enquanto a sessão demo está ativa.
 *
 * Espelha exatamente o badge do `ResultsPanel` (mesmo seletor, mesma chave de
 * i18n, mesmas classes violeta) — a sinalização é idêntica em toda a app, então
 * o usuário reconhece "aqui não exporta" em qualquer aba, não só no painel de
 * resultados. `role="status"` torna o aviso anunciável por leitores de tela.
 *
 * Renderiza `null` fora do demo — não vaza estado visual para a sessão real.
 */
export function DemoExportBadge(): ReactElement | null {
  const { t } = useTranslation();
  const isActive = useIsDemoMode();

  if (!isActive) {
    return null;
  }

  return (
    <div
      role="status"
      className="col-span-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-violet-muted)] border border-[var(--color-violet)]/30 text-[11px] font-semibold text-[var(--color-violet)]"
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{t("demo.export.badge")}</span>
    </div>
  );
}
