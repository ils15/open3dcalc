import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  HelpCircle,
  RotateCcw,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import {
  getPiiStoreAccessState,
  getPiiStoreRuntimeOptions,
  hasExistingPiiProfile,
  installPiiStoreRuntimeEnvironment,
  rehydratePiiStoresIfUnlocked,
  unlockPiiStoresAndRehydrate,
  type PiiVaultAccessState,
} from "@/shared/lib/crypto/piiStoreHydration";
import type { PiiStoreDenialReason } from "@/shared/lib/crypto/piiStoreCapability";

const VAULT_HINT_KEY = "open3dcalc_vault_hint";
const PASSPHRASE_INPUT_ID = "pii-vault-passphrase";
const CONFIRM_INPUT_ID = "pii-vault-passphrase-confirm";
const NOTE_ID = "pii-vault-note";
const IRRECOVERABLE_ID = "pii-vault-irrecoverable";

type ProfileMode = "detecting" | "create" | "unlock";

function refusalCode(error: unknown): string {
  const reason = (error as { reason?: unknown } | null)?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : "unknown";
}

type FormError = { kind: "mismatch" } | { kind: "unlock"; reason: string };

export function PiiLockedShell(): ReactElement | null {
  const { t } = useTranslation();
  const [access, setAccess] = useState<PiiVaultAccessState>(() => {
    installPiiStoreRuntimeEnvironment();
    return getPiiStoreAccessState();
  });
  const [mode, setMode] = useState<ProfileMode>("detecting");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  // Recovery & Reset states
  const [showRecoveryHint, setShowRecoveryHint] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  // The hint is read once, lazily, instead of via an effect: an effect that
  // only mirrors localStorage into state forces a second render pass on every
  // mount for a value that cannot change underneath us. `handleResetVault` is
  // the one place that clears it, and it sets the state directly.
  const [storedHint, setStoredHint] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(VAULT_HINT_KEY);
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Startup rehydrate check
  useEffect(() => {
    let cancelled = false;
    void rehydratePiiStoresIfUnlocked().then((outcomes) => {
      if (cancelled || outcomes === null) return;
      const next = getPiiStoreAccessState();
      setAccess((current) => (current.status === next.status ? current : next));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Check if profile exists
  useEffect(() => {
    if (access.status !== "locked") return;
    let cancelled = false;
    void hasExistingPiiProfile().then((exists) => {
      if (!cancelled) setMode(exists ? "unlock" : "create");
    });
    return () => {
      cancelled = true;
    };
  }, [access.status]);

  // Autofocus on first appearance
  useEffect(() => {
    if (
      access.status === "locked" &&
      mode !== "detecting" &&
      document.activeElement === document.body
    ) {
      inputRef.current?.focus();
    }
  }, [access.status, mode]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (busy || mode === "detecting" || passphrase.length === 0) return;

    if (mode === "create" && passphrase !== confirmation) {
      setFormError({ kind: "mismatch" });
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await unlockPiiStoresAndRehydrate(
        passphrase,
        getPiiStoreRuntimeOptions(),
      );

      // Save password hint if in create mode
      if (mode === "create" && passwordHint.trim().length > 0) {
        localStorage.setItem(VAULT_HINT_KEY, passwordHint.trim());
        setStoredHint(passwordHint.trim());
      }

      setPassphrase("");
      setConfirmation("");
      setPasswordHint("");
      setAccess(getPiiStoreAccessState());
    } catch (caught) {
      setPassphrase("");
      setConfirmation("");
      setFormError({ kind: "unlock", reason: refusalCode(caught) });
      setAccess(getPiiStoreAccessState());
    } finally {
      setBusy(false);
    }
  }

  // Reset local encrypted vault
  async function handleResetVault(): Promise<void> {
    setBusy(true);
    try {
      await new Promise<void>((resolve) => {
        if (typeof window !== "undefined" && window.indexedDB) {
          const req = window.indexedDB.deleteDatabase("open3dcalc_pii_vault");
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        } else {
          resolve();
        }
      });

      localStorage.removeItem(VAULT_HINT_KEY);
      setStoredHint(null);
      setMode("create");
      setPassphrase("");
      setConfirmation("");
      setPasswordHint("");
      setFormError(null);
      setShowResetModal(false);
      setShowRecoveryHint(false);
    } catch (err) {
      console.error("Erro ao redefinir cofre local:", err);
    } finally {
      setBusy(false);
    }
  }

  if (access.status === "hydrated") return null;
  if (access.status === "unavailable" && access.reason === "demo_session") {
    return null;
  }

  const unavailableReason: PiiStoreDenialReason | null =
    access.status === "unavailable" ? access.reason : null;
  const creating = unavailableReason === null && mode === "create";

  const ready = unavailableReason === null && mode !== "detecting";
  const canSubmit =
    ready &&
    !busy &&
    passphrase.length > 0 &&
    (mode !== "create" || confirmation.length > 0);

  const title =
    unavailableReason !== null
      ? t("privacy.vault.unavailableTitle")
      : creating
        ? t("privacy.vault.createTitle")
        : t("privacy.vault.lockedTitle");

  const message =
    unavailableReason !== null
      ? t("privacy.vault.unavailableMessage")
      : creating
        ? t("privacy.vault.createMessage")
        : t("privacy.vault.lockedMessage");

  return (
    <>
      <section
        aria-label={t("privacy.vault.ariaLabel")}
        className="w-full border-b bg-[#12192b] border-amber-500/40 text-slate-200 select-none"
      >
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-12 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Icon & Title */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {unavailableReason !== null || creating ? (
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                <Lock className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <strong className="text-xs sm:text-sm font-bold text-white">
                  {title}
                </strong>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                  {creating ? "PRIMEIRO ACESSO" : "CRIPTOGRAFIA LOCAL"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug">
                {message}
              </p>
            </div>
          </div>

          {/* Right: Form & Recovery Actions */}
          {ready && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
              <form
                onSubmit={(event) => void handleSubmit(event)}
                className="flex flex-wrap items-center gap-2 shrink-0"
              >
                {/* Passphrase Input with Eye toggle */}
                <div className="relative">
                  {/* A placeholder is not an accessible name — it vanishes the
                      moment the field is typed into. The vault gate is only
                      usable with a screen reader if the label is real. */}
                  <label htmlFor={PASSPHRASE_INPUT_ID} className="sr-only">
                    {t("privacy.vault.passphraseLabel")}
                  </label>
                  <input
                    ref={inputRef}
                    id={PASSPHRASE_INPUT_ID}
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    aria-describedby={NOTE_ID}
                    aria-invalid={formError !== null ? true : undefined}
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    placeholder={
                      creating
                        ? t("privacy.vault.createPassphrasePlaceholder")
                        : t("privacy.vault.passphrasePlaceholder")
                    }
                    className="h-9 w-36 sm:w-44 px-3 pr-8 rounded-lg text-xs bg-[#0b101c] text-white border border-[#21304f] focus:border-amber-400 focus:outline-none placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    title={
                      showPassword
                        ? t("privacy.vault.hidePassphrase")
                        : t("privacy.vault.showPassphrase")
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {creating && (
                  <>
                    <label htmlFor={CONFIRM_INPUT_ID} className="sr-only">
                      {t("privacy.vault.confirmPassphraseLabel")}
                    </label>
                    <input
                      id={CONFIRM_INPUT_ID}
                      type={showPassword ? "text" : "password"}
                      autoComplete="off"
                      aria-describedby={IRRECOVERABLE_ID}
                      aria-invalid={
                        formError?.kind === "mismatch" ? true : undefined
                      }
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      placeholder={t(
                        "privacy.vault.confirmPassphrasePlaceholder",
                      )}
                      className="h-9 w-36 sm:w-44 px-3 rounded-lg text-xs bg-[#0b101c] text-white border border-[#21304f] focus:border-amber-400 focus:outline-none placeholder-slate-500"
                    />

                    <input
                      type="text"
                      value={passwordHint}
                      onChange={(e) => setPasswordHint(e.target.value)}
                      placeholder="Dica de senha (opcional)..."
                      className="h-9 w-40 sm:w-48 px-3 rounded-lg text-xs bg-[#0b101c] text-white border border-[#21304f] focus:border-blue-400 focus:outline-none placeholder-slate-500"
                    />
                  </>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center h-9 px-4 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm disabled:opacity-50"
                >
                  {busy ? (
                    <span>{t("privacy.vault.unlocking")}</span>
                  ) : (
                    <span>
                      {creating
                        ? t("privacy.vault.create")
                        : t("privacy.vault.unlock")}
                    </span>
                  )}
                </button>
              </form>

              {/* Recovery & Reset Buttons for Unlock Mode */}
              {!creating && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryHint(!showRecoveryHint)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-amber-300 text-[11px] font-semibold transition-colors border border-amber-500/20"
                    title="Ver dica de senha"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Dica</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 text-[11px] font-semibold transition-colors border border-slate-700 hover:border-rose-500/40"
                    title="Esqueci minha senha / Redefinir cofre local"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Esqueci a Senha</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Irrecoverability is stated BEFORE a passphrase is chosen, not after
            it fails: by then the user already typed a secret they cannot
            recover. Referenced by the confirm field's aria-describedby. */}
        {creating && (
          <p
            id={IRRECOVERABLE_ID}
            className="mt-1.5 text-[11px] text-amber-200/90"
          >
            {t("privacy.vault.irrecoverableNotice")}
          </p>
        )}

        {/* Display Recovery Password Hint Banner if requested */}
        {showRecoveryHint && !creating && (
          <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-12 pb-2.5 animate-fade-in">
            <div className="bg-[#0b101c] border border-amber-500/30 p-2.5 rounded-lg flex items-center justify-between text-xs text-amber-200">
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                {storedHint ? (
                  <span>
                    Sua dica de senha cadastrada é:{" "}
                    <strong className="text-white underline">
                      {storedHint}
                    </strong>
                  </span>
                ) : (
                  <span>
                    Nenhuma dica de senha foi cadastrada anteriormente para este
                    perfil.
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowRecoveryHint(false)}
                className="text-slate-400 hover:text-white px-1.5"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Form Error alert */}
        {formError !== null && (
          <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-12 pb-2">
            <p
              role="alert"
              className="text-xs font-semibold text-rose-400 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {formError.kind === "mismatch"
                ? t("privacy.vault.mismatchError")
                : t("privacy.vault.unlockError")}
            </p>
          </div>
        )}
      </section>

      {/* Confirmation Modal: Reset Local Vault Password */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1220] border border-[#21304f] rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-200 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Redefinir Senha do Perfil Local
                </h3>
                <span className="text-[11px] text-slate-400">
                  Recuperação e recriação do cofre seguro
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 flex flex-col gap-2.5 leading-relaxed bg-[#070b14] p-3.5 rounded-xl border border-[#1b253b]">
              <p>
                A proteção do Open3DCalc utiliza{" "}
                <strong>criptografia local AES-256 bits</strong> diretamente no
                seu navegador (sem servidores externos para total privacidade
                LGPD).
              </p>
              <p>
                Se você não lembra sua senha antiga, você pode{" "}
                <strong>redefinir o cofre local agora</strong>. Isso permitirá
                que você crie uma nova senha imediatamente e continue salvando
                novos orçamentos e clientes sem nenhum travamento ou erro de
                bloqueio.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b253b]">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleResetVault()}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-700 hover:ring-2 hover:ring-amber-500/40 transition-colors shadow-md disabled:opacity-50"
              >
                {busy ? "Redefinindo..." : "Redefinir e Criar Nova Senha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
