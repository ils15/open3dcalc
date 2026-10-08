import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { LegacyResidueDisclosure } from "@/shared/components/Privacy/LegacyResidueDisclosure";
import { useLegacyKeepReadOnlyStore } from "@/shared/stores/legacyKeepReadOnlyStore";

/**
 * Privacy screen (D1.1 S4) — ADR-002 §2.2.4.
 *
 * The privacy surface retains consent controls. Legacy inspection stays
 * deferred; desktop delete-all is disabled until an exact PII-only target plan
 * and durable authorization path can be verified.
 */

/**
 * L-2 — the way back to the legacy-migration choice.
 *
 * When the user chose "keep read-only" the decision is persisted (value-free)
 * and the prompt stops returning. This control states that plainly and removes
 * the decision so the choice is offered again. It renders nothing when no
 * decision is stored.
 */
function KeepReadOnlyControl() {
  const { t } = useTranslation();
  const keepSignature = useLegacyKeepReadOnlyStore((state) => state.signature);
  const reopen = useLegacyKeepReadOnlyStore((state) => state.reopen);
  if (keepSignature === null) return null;
  return (
    <div className="surface rounded-xl p-4 space-y-2">
      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
        {t("privacy.migration.keepReadOnlyTitle")}
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("privacy.migration.keepReadOnlyActive")}
      </p>
      <button
        type="button"
        onClick={() => reopen()}
        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      >
        {t("privacy.migration.keepReadOnlyReopen")}
      </button>
    </div>
  );
}

export function PrivacyScreen() {
  const { t } = useTranslation();
  const isDesktopRuntime =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Electron");
  const erasureApi = (
    window as unknown as {
      electronAPI?: {
        erasure?: {
          authorize: () => Promise<{ token: string }>;
          claim: (
            token: string,
          ) => Promise<{ targets: Array<{ surface: string; id: string }> }>;
          start: (
            token: string,
            rendererReport?: Record<string, unknown>,
          ) => Promise<{
            receipt: {
              stores_completed: string[];
              external_copies_notice: string[];
              rollback_unavailable?: { reason: string; at: string };
            };
            rolledBack: boolean;
          }>;
          status: () => Promise<{
            active: boolean;
            available: boolean;
            blockerCodes: string[];
          }>;
          newPii?: {
            authorize: () => Promise<{ token: string }>;
            claim: (
              token: string,
            ) => Promise<{ targets: Array<{ surface: string; id: string }> }>;
            start: (token: string) => Promise<{
              request_id: string;
              completed_at: string;
              purged: string[];
            }>;
            status: () => Promise<{
              active: boolean;
              available: boolean;
              blockerCodes: string[];
              state?: string;
              targets: Array<{ surface: string; id: string }>;
            }>;
          };
        };
      };
    }
  ).electronAPI?.erasure;
  const newPiiErasureApi = erasureApi?.newPii;

  // ── SPEC-04 consent receipt (D1.1 S8) ───────────────────────────────
  const [consentStatus, setConsentStatus] = useState<{
    status: string;
    consentGiven: boolean;
    currentPolicyVersion: string;
  } | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

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
    setWithdrawError(null);
    try {
      const { useConsentStore } = await import("@/shared/stores/consentStore");
      await useConsentStore.getState().withdrawConsent();
      await loadConsentStatus();
    } catch {
      // Honest failure: no erasure is claimed, and the retry is offered.
      setWithdrawError(t("privacy.consent_receipt.withdrawFailed"));
    } finally {
      setConsentBusy(false);
    }
  }, [loadConsentStatus, t]);

  // ── SPEC-02 delete-all saga (D1.1 S7) ───────────────────────────────
  const [erasing, setErasing] = useState(false);
  const [erasureAvailable, setErasureAvailable] = useState<boolean | null>(
    erasureApi ? null : false,
  );
  // The main process's own blocker codes for an unavailable saga. Surfaced
  // verbatim (they are what support diagnoses from) so "unavailable" is never a
  // shrug with no reason.
  const [erasureBlockers, setErasureBlockers] = useState<string[]>([]);
  const [erasureReceipt, setErasureReceipt] = useState<{
    stores_completed: string[];
    external_copies_notice: string[];
    rollback_unavailable?: { reason: string; at: string };
  } | null>(null);
  const [erasureError, setErasureError] = useState<string | null>(null);

  // ── EXACT new-namespace delete-all (Beta12 follow-up) ───────────────
  // This is the only functional erasure in this version: it targets exactly the
  // three passwordless local records. Legacy/mixed delete-all below stays
  // unavailable, and the copy says so.
  const [newPiiAvailable, setNewPiiAvailable] = useState<boolean | null>(
    newPiiErasureApi ? null : false,
  );
  const [newPiiErasing, setNewPiiErasing] = useState(false);
  const [newPiiError, setNewPiiError] = useState<string | null>(null);
  const [newPiiDone, setNewPiiDone] = useState(false);

  const refreshNewPiiStatus = useCallback(async () => {
    if (!newPiiErasureApi) return;
    try {
      const status = await newPiiErasureApi.status();
      setNewPiiAvailable(status.available === true);
    } catch {
      setNewPiiAvailable(false);
    }
  }, [newPiiErasureApi]);

  useEffect(() => {
    if (!newPiiErasureApi) return;
    let mounted = true;
    void newPiiErasureApi
      .status()
      .then((status) => {
        if (!mounted) return;
        setNewPiiAvailable(status.available === true);
      })
      .catch(() => {
        if (!mounted) return;
        setNewPiiAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, [newPiiErasureApi]);

  const handleDeleteNewPii = useCallback(async () => {
    if (!newPiiErasureApi) return;
    if (newPiiAvailable !== true) {
      setNewPiiError(t("privacy.erasure.newPiiUnavailable"));
      return;
    }
    if (!window.confirm(t("privacy.erasure.newPiiConfirm"))) return;
    setNewPiiErasing(true);
    setNewPiiError(null);
    setNewPiiDone(false);
    try {
      // Main persists the durable journal and issues the one-use nonce; if any
      // step fails, no deletion is claimed.
      const authorization = await newPiiErasureApi.authorize();
      if (!authorization || typeof authorization.token !== "string") {
        throw new Error("new-PII erasure authorization unavailable");
      }
      const plan = await newPiiErasureApi.claim(authorization.token);
      if (!plan || !Array.isArray(plan.targets)) {
        throw new Error("new-PII erasure plan unavailable");
      }
      await newPiiErasureApi.start(authorization.token);
      setNewPiiDone(true);
      await refreshNewPiiStatus();
    } catch {
      setNewPiiError(t("privacy.erasure.newPiiFailed"));
    } finally {
      setNewPiiErasing(false);
    }
  }, [newPiiErasureApi, newPiiAvailable, refreshNewPiiStatus, t]);

  useEffect(() => {
    if (!erasureApi) return;
    let mounted = true;
    void erasureApi
      .status()
      .then((status) => {
        if (!mounted) return;
        setErasureAvailable(status.available === true);
        setErasureBlockers(
          Array.isArray(status.blockerCodes) ? status.blockerCodes : [],
        );
      })
      .catch(() => {
        if (!mounted) return;
        setErasureAvailable(false);
        setErasureBlockers([]);
      });
    return () => {
      mounted = false;
    };
  }, [erasureApi]);

  const handleDeleteAll = useCallback(async () => {
    if (!erasureApi) return;
    // Defensive honesty: the control is disabled while main reports the saga
    // unavailable, and this guard keeps the handler from ever claiming success
    // (or attempting a renderer deletion) if it is invoked directly.
    if (erasureAvailable !== true) {
      setErasureError(t("privacy.erasure.unavailable"));
      return;
    }
    const confirmed = window.confirm(t("privacy.erasure.confirm"));
    if (!confirmed) return;
    setErasing(true);
    setErasureError(null);
    try {
      // Main must first persist and then consume the opaque authorization. If
      // either step fails, no renderer deletion code is loaded or invoked.
      const authorization = await erasureApi.authorize();
      if (!authorization || typeof authorization.token !== "string") {
        throw new Error("erasure authorization unavailable");
      }
      const authorizedPlan = await erasureApi.claim(authorization.token);
      if (!authorizedPlan || !Array.isArray(authorizedPlan.targets)) {
        throw new Error("erasure target plan unavailable");
      }
      const { purgeRendererStores } =
        await import("@/shared/lib/erasureSaga/rendererSweep");
      const report = await purgeRendererStores(authorizedPlan.targets);
      const { receipt } = await erasureApi.start(authorization.token, report);
      setErasureReceipt(receipt);
    } catch {
      setErasureError(t("privacy.erasure.unavailable"));
    } finally {
      setErasing(false);
    }
  }, [erasureApi, erasureAvailable, t]);

  if (!isDesktopRuntime) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
        <div className="surface rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-[var(--color-text-primary)]">
              {t("privacy.quarantine.title")}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("privacy.quarantine.desktopOnly")}
            </p>
          </div>
        </div>
        {/* T5.3 — the browser residue exists on web too: disclose it here. */}
        <LegacyResidueDisclosure />
        <KeepReadOnlyControl />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
      <section className="surface rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-[var(--color-accent)] shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {t("privacy.quarantine.title")}
            </h2>
          </div>
        </div>
        <p
          role="status"
          className="text-sm text-[var(--color-warning)] flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {t("privacy.quarantine.inspectionPaused")}
        </p>
      </section>

      {/* ── T5.3 legacy residue + vault/marker disclosure ────────────── */}
      <LegacyResidueDisclosure />
      <KeepReadOnlyControl />

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
            <p className="text-xs text-[var(--color-success)]">
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
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-danger)]/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
            >
              {t("privacy.consent_receipt.withdraw")}
            </button>
            {/* Honest scope: withdrawal removes locally reachable consent
                data and blocks gated features; it is NOT a verified erasure. */}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {t("privacy.consent_receipt.withdrawScopeNote")}
            </p>
            {withdrawError && (
              <div className="space-y-2">
                <p role="alert" className="text-xs text-[var(--color-danger)]">
                  {withdrawError}
                </p>
                <button
                  type="button"
                  onClick={() => void handleWithdraw()}
                  disabled={consentBusy}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
                >
                  {t("privacy.consent_receipt.withdrawRetry")}
                </button>
              </div>
            )}
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
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
            >
              {t("privacy.consent_receipt.grant")}
            </button>
          </div>
        )}
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {t("privacy.consent_receipt.flagsNote")}
        </p>
      </div>

      {/* ── EXACT new-namespace delete-all (functional) ─────────────── */}
      <div
        className="surface rounded-xl p-4 border border-[var(--color-danger)]/30 space-y-3"
        data-testid="new-pii-erasure"
      >
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          {t("privacy.erasure.newPiiTitle")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("privacy.erasure.newPiiDescription")}
        </p>
        {newPiiAvailable === false && (
          <p
            data-testid="new-pii-unavailable"
            className="text-xs text-[var(--color-warning)]"
          >
            {t("privacy.erasure.newPiiUnavailable")}
          </p>
        )}
        {newPiiError && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {newPiiError}
          </p>
        )}
        {newPiiDone && (
          <p
            role="status"
            className="text-xs rounded-lg px-3 py-2 border border-[var(--color-success)]/30 bg-[var(--color-success-muted)] text-[var(--color-success)]"
          >
            {t("privacy.erasure.newPiiDone")}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleDeleteNewPii()}
          disabled={
            newPiiErasing || !newPiiErasureApi || newPiiAvailable !== true
          }
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-danger-fill)] text-[var(--color-danger-fill-fg)] hover:bg-[var(--color-danger-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
        >
          {newPiiErasing
            ? t("privacy.erasure.newPiiWorking")
            : t("privacy.erasure.newPiiButton")}
        </button>
      </div>

      {/* ── SPEC-02 delete-all (legacy/mixed — stays unavailable) ───── */}
      <div className="surface rounded-xl p-4 border border-[var(--color-danger)]/30 space-y-3">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          {t("privacy.erasure.legacyScopeTitle")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("privacy.erasure.description")}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {t("privacy.erasure.legacyScopeNote")}
        </p>
        {erasureAvailable === false && (
          <div className="space-y-1">
            <p
              data-testid="erasure-unavailable"
              className="text-xs text-[var(--color-warning)]"
            >
              {t("privacy.erasure.unavailable")}
            </p>
            {/* The main process's own blocker codes, shown verbatim: they are
                what support diagnoses from, and they make the disabled control
                honest instead of an unexplained refusal. */}
            {erasureBlockers.length > 0 && (
              <p
                data-testid="erasure-blockers"
                className="text-[11px] text-[var(--color-text-muted)] font-mono break-words"
              >
                {t("privacy.erasure.blockersLabel")}{" "}
                {erasureBlockers.join(", ")}
              </p>
            )}
          </div>
        )}
        {erasureError && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {erasureError}
          </p>
        )}
        {erasureReceipt && (
          <div
            role="status"
            className="text-xs rounded-lg px-3 py-2 border border-[var(--color-success)]/30 bg-[var(--color-success-muted)] text-[var(--color-success)] space-y-1"
          >
            <p>{t("privacy.erasure.done")}</p>
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
          disabled={erasing || !erasureApi || erasureAvailable !== true}
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-danger-fill)] text-[var(--color-danger-fill-fg)] hover:bg-[var(--color-danger-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
        >
          {erasing ? t("privacy.erasure.working") : t("privacy.erasure.button")}
        </button>
      </div>
    </div>
  );
}
