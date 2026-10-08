/**
 * Guarda de exportação no choke point (onboarding Fase 1 — B1..B5).
 *
 * Adaptação não-React de `useDemoExportGuard`: a mesma lógica (mesmo seletor
 * do store, mesma chave de i18n, mesmo feedback explicativo), mas chamável de
 * funções puras — `pdfExport`, `csvExport`, `quoteApi`, `download` — onde não
 * há hook disponível.
 *
 * O bloqueio é exaustivo por construção: toda função que emite um arquivo ao
 * disco passa por aqui, então paths de export futuros ficam cobertos
 * automaticamente sem precisar de wiring manual handler-a-handler.
 */
import i18n from "i18next";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";

const BLOCKED_MESSAGE_KEY = "demo.export.blockedTitle";

type BlockedExportSink = (message: string) => void;

const sinks = new Set<BlockedExportSink>();

/**
 * Registra um sink de UI (toast) que explica a recusa. Retorna unsubscribe.
 * A app shell registra um sink global; sem sink registrado o bloqueio mesmo
 * assim acontece — apenas sem feedback visível (safe by default).
 */
export function subscribeBlockedExport(sink: BlockedExportSink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

/** Verdadeiro enquanto a sessão demo efêmera está ativa. */
export function isDemoExportBlocked(): boolean {
  return useDemoModeStore.getState().isActive;
}

/** Mensagem explicativa — a mesma chave usada pelo hook React (UX idêntica). */
export function blockedExportMessage(): string {
  const messageKey = isBetaChannel
    ? "privacy.betaFirstRun.noExport"
    : BLOCKED_MESSAGE_KEY;
  return i18n.isInitialized ? i18n.t(messageKey) : messageKey;
}

/**
 * Choke point de toda exportação/compartilhamento. Retorna `true` no modo demo
 * ou Beta; nesses casos publica a mensagem explicativa nos sinks registrados,
 * para o usuário receber feedback em vez de um no-op silencioso. Retorna
 * `false` quando a exportação pode seguir normalmente.
 */
export function guardExport(): boolean {
  if (!isBetaChannel && !isDemoExportBlocked()) {
    return false;
  }
  const message = blockedExportMessage();
  for (const sink of sinks) {
    sink(message);
  }
  return true;
}
