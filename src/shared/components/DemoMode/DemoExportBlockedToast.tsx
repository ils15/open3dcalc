import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { ToastContainer, type ToastItem } from "@/shared/components/ui/Toast";
import { subscribeBlockedExport } from "@/shared/lib/demoExportGuard";

/**
 * Feedback global da recusa de exportação no modo demo.
 *
 * Assina o sink de `demoExportGuard`: toda vez que um choke point
 * (`downloadBlob`, `pdfExport`, `quoteApi`, handlers de aba) bloqueia uma
 * exportação, a mensagem explicativa chega aqui e vira um toast — a recusa
 * nunca é silenciosa, venha de onde vier (B1..B5 ou qualquer path futuro).
 *
 * Montado nos dois shells (web + desktop) ao lado do `DemoModeIndicator`:
 * sobrevive a toda troca de aba, exatamente como o banner persistente.
 * Sem sink registrado o bloqueio ainda acontece — este componente é só a camada
 * de UI, nunca um dependência funcional do guard.
 *
 * Renderiza `null` quando ocioso para não deixar uma região `aria-live` vazia
 * na árvore.
 */
export function DemoExportBlockedToast(): ReactElement | null {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return subscribeBlockedExport((message) => {
      nextId.current += 1;
      setItems((prev) => [
        ...prev,
        { id: nextId.current, message, type: "info" },
      ]);
    });
  }, []);

  if (items.length === 0) {
    return null;
  }

  return <ToastContainer items={items} onDismiss={dismiss} />;
}
