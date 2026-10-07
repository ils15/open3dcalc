import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { LegacyResidueDisclosure } from "@/shared/components/Privacy/LegacyResidueDisclosure";
import { isElectronRuntime } from "@/shared/lib/migration/desktopLegacyRows";

/**
 * Privacy screen. The quarantine report and actions are intentionally not
 * invoked while their IPC surface is disabled; unavailable is not absence.
 * Legacy-data inspection is a separate, explicit user action in its disclosure.
 */

export function PrivacyScreen() {
  const { t } = useTranslation();
  const electronAPI = (window as unknown as { electronAPI?: unknown })
    .electronAPI;
  const desktopRuntime = isElectronRuntime() || electronAPI !== undefined;
  const erasureApi = (
    window as unknown as {
      electronAPI?: {
        erasure?: {
          start: (rendererReport?: Record<string, unknown>) => Promise<{
            receipt: {
              stores_completed: string[];
              external_copies_notice: string[];
              rollback_unavailable?: { reason: string; at: string };
            };
            rolledBack: boolean;
          }>;
        };
      };
    }
  ).electronAPI?.erasure;

  // ── SPEC-04 consent receipt (D1.1 S8) ───────────────────────────────
  const [consentStatus, setConsentStatus] = useState<{
    status: string;
    consentGiven: boolean;
    currentPolicyVersion: string;
  } | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);

  const loadConsentStatus = useCallback(async () => {
    const { useConsentStore } = await import("@/shared/stores/consentStore");
    const { receipt, receiptDigest: digest } = useConsentStore.getState();
    const { evaluateReceipt } = await import("@/shared/lib/consentReceipt");
    const evaluation = await evaluateReceipt(
      receipt && digest ? { receipt, digest } : null,
    );
    setConsentStatus({
      status: evaluation.status,
      consentGiven: evaluation.consentGiven,
      currentPolicyVersion: evaluation.currentPolicyVersion,
    });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadConsentStatus();
    });
  }, [loadConsentStatus]);

  const handleGrant = useCallback(async () => {
    setConsentBusy(true);
    try {
      const { useConsentStore } = await import("@/shared/stores/consentStore");
      await useConsentStore.getState().giveConsent();
      await loadConsentStatus();
    } finally {
      setConsentBusy(false);
    }
  }, [loadConsentStatus]);

  const handleWithdraw = useCallback(async () => {
    setConsentBusy(true);
    try {
      const { useConsentStore } = await import("@/shared/stores/consentStore");
      await useConsentStore.getState().withdrawConsent();
      await loadConsentStatus();
    } finally {
      setConsentBusy(false);
    }
  }, [loadConsentStatus]);

  // ── SPEC-02 delete-all saga (D1.1 S7) ───────────────────────────────
  const [erasing, setErasing] = useState(false);
  const [erasureReceipt, setErasureReceipt] = useState<{
    stores_completed: string[];
    external_copies_notice: string[];
    rollback_unavailable?: { reason: string; at: string };
  } | null>(null);
  const [erasureError, setErasureError] = useState<string | null>(null);

  const handleDeleteAll = useCallback(async () => {
    if (!erasureApi) return;
    const confirmed = window.confirm(t("privacy.erasure.confirm"));
    if (!confirmed) return;
    setErasing(true);
    setErasureError(null);
    try {
      // The renderer purges its own surfaces first (localStorage sweep,
      // IndexedDB, OPFS, caches) and hands the report to the main-process
      // saga, which covers every durable surface.
      const { purgeRendererStores } =
        await import("@/shared/lib/erasureSaga/rendererSweep");
      const report = await purgeRendererStores();
      const { receipt } = await erasureApi.start(report);
      setErasureReceipt(receipt);
    } catch {
      setErasureError(t("privacy.erasure.failed"));
    } finally {
      setErasing(false);
    }
  }, [erasureApi, t]);

  if (!desktopRuntime) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
        <div className="surface rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-[var(--color-text-primary)]">
              {t("privacy.quarantine.title")}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t(
                isElectronRuntime()
                  ? "privacy.quarantine.unavailable"
                  : "privacy.quarantine.desktopOnly",
              )}
            </p>
          </div>
        </div>
        {/* T5.3 — the browser residue exists on web too: disclose it here. */}
        <LegacyResidueDisclosure />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-[var(--color-accent)] shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {t("privacy.quarantine.title")}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("privacy.quarantine.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <p
        role="status"
        className="surface rounded-xl p-4 text-sm text-[var(--color-warning)] flex items-start gap-2"
      >
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        {t("privacy.quarantine.unavailable")}
      </p>

      {/* ── T5.3 legacy residue + vault/marker disclosure ────────────── */}
      <LegacyResidueDisclosure />

      {/* ── SPEC-04 consent receipt ─────────────────────────────────── */}
      {/* Every string below reads `privacy.consent_receipt.*`, NOT
          `privacy.consent.*`. The two namespaces both exist and both are
          translated, and they are DIFFERENT screens: `privacy.consent.*` is
          the first-run ConsentModal (its `title` is literally "Your Data
          Privacy"). Asking it for a receipt string resolves to nothing and
          renders the raw key — which is what these six call sites did, in both
          locales, with a complete pt-BR translation already sitting one
          namespace over. The heading was wrong the same way, more quietly: it
          resolved, so it rendered the ConsentModal's heading over a
          consent-RECEIPT panel. Repointed, not duplicated. */}
      <div className="surface rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          {t("privacy.consent_receipt.title")}
        </h3>
        {consentStatus === null ? (
          <p className="text-xs text-[var(--color-text-muted)]">…</p>
        ) : consentStatus.consentGiven ? (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400">
              {t("privacy.consent_receipt.granted", {
                version: consentStatus.currentPolicyVersion,
              })}
            </p>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(t("privacy.consent_receipt.withdrawConfirm"))
                ) {
                  void handleWithdraw();
                }
              }}
              disabled={consentBusy}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-red-400 hover:bg-[var(--color-bg-hover)] border border-red-500/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
            >
              {t("privacy.consent_receipt.withdraw")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("privacy.consent_receipt.absent")}
            </p>
            <button
              type="button"
              onClick={() => void handleGrant()}
              disabled={consentBusy}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-fill)] text-white hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
            >
              {t("privacy.consent_receipt.grant")}
            </button>
          </div>
        )}
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {t("privacy.consent_receipt.flagsNote")}
        </p>
      </div>

      {/* ── SPEC-02 delete-all ──────────────────────────────────────── */}
      <div className="surface rounded-xl p-4 border border-red-500/30 space-y-3">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          {t("privacy.erasure.title")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("privacy.erasure.description")}
        </p>
        {erasureError && (
          <p role="alert" className="text-xs text-red-400">
            {erasureError}
          </p>
        )}
        {erasureReceipt && (
          <div
            role="status"
            className="text-xs rounded-lg px-3 py-2 border border-amber-500/30 bg-amber-500/10 text-[var(--color-text-secondary)] space-y-1"
          >
            <p>{t("privacy.erasure.done")}</p>
            <p>{t("privacy.erasure.processedStores")}</p>
            <ul className="list-disc list-inside">
              {erasureReceipt.stores_completed.map((store) => (
                <li key={store}>{store}</li>
              ))}
            </ul>
            <p className="text-[var(--color-text-secondary)]">
              {t("privacy.erasure.externalCopies")}
            </p>
            <ul className="list-disc list-inside">
              {erasureReceipt.external_copies_notice.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </div>
        )}
        {/* contrast-site: privacy-screen-delete-all-button */}
        <button
          type="button"
          onClick={() => void handleDeleteAll()}
          disabled={erasing}
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/90 text-white hover:bg-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
        >
          {erasing ? t("privacy.erasure.working") : t("privacy.erasure.button")}
        </button>
      </div>
    </div>
  );
}
