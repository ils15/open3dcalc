import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileWarning,
  Lock,
  Trash2,
  X,
} from "lucide-react";
import { useConsentStore } from "@/shared/stores/consentStore";
import {
  migrateLegacyPlaintextPiiToVault,
  type LegacyPiiRehomeStatus,
} from "@/shared/lib/migration/legacyPiiRehome";
import { isPiiSyncAvailable } from "@/shared/lib/dataSync";
import {
  detectLegacyPlaintextPii,
  type LegacyPiiPlaintextReport,
} from "@/shared/lib/legacyPiiPlaintext";

/**
 * T5.2 — the legacy plaintext PII choice dialog (ADR-002 §2.2).
 *
 * Five explicit exits, no implicit acceptance and no silent destruction:
 *
 *  - migrate   — grants migration consent, then re-homes COPY-WITHOUT-DELETE and
 *                reports exactly what happened (migrated / locked vault /
 *                nothing to migrate / incomplete).
 *  - keep      — does not migrate; discloses that the residue stays plaintext.
 *  - export    — opens the existing export flow, but refuses (with a message)
 *                while the vault is locked, because an export would be empty.
 *  - delete    — DESTRUCTIVE and therefore disabled: there is no verified
 *                key-scoped erasure for these keys yet, so the honest answer is
 *                "not available", never a quiet delete.
 *  - cancel    — closes without action.
 */
export interface LegacyMigrationDialogProps {
  open: boolean;
  onRequestClose: () => void;
  /** Opens the existing export flow (DataSyncModal) when the vault is ready. */
  onOpenExport: () => void;
  /**
   * Records the user's explicit "keep read-only" choice. The choice is
   * value-free and persisted by the caller so the prompt is not re-shown while
   * the residue is unchanged (L-2).
   */
  onKeepReadOnly?: () => void;
  /** Injectable for tests; defaults to a live detection of the residue. */
  report?: LegacyPiiPlaintextReport;
}

type Outcome =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "result"; status: LegacyPiiRehomeStatus }
  | { kind: "kept_read_only" }
  | { kind: "export_blocked" };

/** The honest message for each value-free re-home outcome. */
const RESULT_KEYS: Record<LegacyPiiRehomeStatus, string> = {
  migrated: "privacy.migration.resultMigrated",
  vault_unavailable: "privacy.migration.resultVaultLocked",
  no_residue: "privacy.migration.resultNothingToMigrate",
  already_migrated: "privacy.migration.resultNothingToMigrate",
  consent_required: "privacy.migration.resultIncomplete",
  source_unavailable: "privacy.migration.resultIncomplete",
  incomplete: "privacy.migration.resultIncomplete",
};

function isSuccess(status: LegacyPiiRehomeStatus): boolean {
  return status === "migrated";
}

function isNothingToDo(status: LegacyPiiRehomeStatus): boolean {
  return status === "no_residue" || status === "already_migrated";
}

export function LegacyMigrationDialog({
  open,
  onRequestClose,
  onOpenExport,
  onKeepReadOnly,
  report,
}: LegacyMigrationDialogProps) {
  const { t } = useTranslation();
  const grantMigrationConsent = useConsentStore((s) => s.grantMigrationConsent);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  // Reset the per-open outcome when the dialog transitions to open, so a
  // reopened dialog never shows a stale result. Adjusting state during render
  // (rather than in an effect) avoids a cascading re-render and is the pattern
  // React documents for "reset state when a prop changes".
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setOutcome({ kind: "idle" });
  }

  const reportData = report ?? detectLegacyPlaintextPii();

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => cancelRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onRequestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onRequestClose]);

  if (!open) return null;

  const handleMigrate = async () => {
    if (outcome.kind === "working") return;
    setOutcome({ kind: "working" });
    // Consent first: the re-home refuses without a grant, and the grant is the
    // user's explicit, receipt-backed decision to copy this data.
    await grantMigrationConsent();
    const result = await migrateLegacyPlaintextPiiToVault();
    setOutcome({ kind: "result", status: result.status });
  };

  const handleKeepReadOnly = () => {
    // Persist the value-free decision before showing the confirmation, so the
    // prompt can stop re-asking while the residue is unchanged (L-2).
    onKeepReadOnly?.();
    setOutcome({ kind: "kept_read_only" });
  };

  const handleExport = () => {
    if (!isPiiSyncAvailable()) {
      setOutcome({ kind: "export_blocked" });
      return;
    }
    onOpenExport();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("privacy.migration.title")}
    >
      <div
        ref={dialogRef}
        className="surface rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-in"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 rounded-full bg-[var(--color-accent)]/10">
            <FileWarning className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {t("privacy.migration.title")}
            </h2>
          </div>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-5">
          {t("privacy.migration.intro", { count: reportData.total })}
        </p>

        <div className="space-y-3">
          {/* migrate */}
          <OptionButton
            onClick={() => void handleMigrate()}
            disabled={outcome.kind === "working"}
            icon={<FileWarning className="w-4 h-4" aria-hidden="true" />}
            label={t("privacy.migration.optionMigrate")}
            hint={t("privacy.migration.optionMigrateHint")}
            primary
          />
          {/* keep read-only */}
          <OptionButton
            onClick={handleKeepReadOnly}
            icon={<X className="w-4 h-4" aria-hidden="true" />}
            label={t("privacy.migration.optionKeep")}
            hint={t("privacy.migration.optionKeepHint")}
          />
          {/* export */}
          <OptionButton
            onClick={handleExport}
            icon={<Download className="w-4 h-4" aria-hidden="true" />}
            label={t("privacy.migration.optionExport")}
            hint={t("privacy.migration.optionExportHint")}
          />
          {/* delete — destructive, disabled until a verified key-scoped erasure exists */}
          <OptionButton
            onClick={() => undefined}
            disabled
            destructive
            icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
            label={t("privacy.migration.optionDelete")}
            hint={t("privacy.migration.optionDeleteHint")}
            describedBy="legacy-migration-delete-reason"
          />
          <p
            id="legacy-migration-delete-reason"
            className="flex items-start gap-2 text-xs text-[var(--color-warning)] leading-relaxed"
          >
            <AlertTriangle
              className="w-4 h-4 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            {t("privacy.migration.deleteUnavailable")}
          </p>
        </div>

        <OutcomePanel outcome={outcome} />

        <div className="flex justify-end gap-3 mt-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onRequestClose}
            className="px-5 py-2.5 rounded-xl text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t("privacy.migration.optionCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OptionButtonProps {
  onClick: () => void;
  label: string;
  hint: string;
  icon: React.ReactNode;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  describedBy?: string;
}

function OptionButton({
  onClick,
  label,
  hint,
  icon,
  disabled = false,
  primary = false,
  destructive = false,
  describedBy,
}: OptionButtonProps) {
  const tone = primary
    ? "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] hover:bg-[var(--accent-fill-hover)]"
    : destructive
      ? "bg-[var(--color-danger-fill)] text-[var(--color-danger-fill-fg)]"
      : "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      className={`w-full text-left rounded-xl px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${tone}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="block text-xs opacity-80 mt-1 leading-relaxed">
        {hint}
      </span>
    </button>
  );
}

function OutcomePanel({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation();
  if (outcome.kind === "idle") return null;

  if (outcome.kind === "working") {
    return (
      <p
        role="status"
        className="mt-5 flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
      >
        <span
          className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        {t("privacy.migration.working")}
      </p>
    );
  }

  if (outcome.kind === "kept_read_only") {
    return (
      <p
        role="status"
        className="mt-5 flex items-start gap-2 text-sm text-[var(--color-text-secondary)] leading-relaxed"
      >
        <AlertTriangle
          className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]"
          aria-hidden="true"
        />
        {t("privacy.migration.keptReadOnly")}
      </p>
    );
  }

  if (outcome.kind === "export_blocked") {
    return (
      <p
        role="status"
        className="mt-5 flex items-start gap-2 text-sm text-[var(--color-warning)] leading-relaxed"
      >
        <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        {t("privacy.migration.exportBlocked")}
      </p>
    );
  }

  const success = isSuccess(outcome.status);
  const neutral = isNothingToDo(outcome.status);
  const tone = success
    ? "text-[var(--color-success)]"
    : neutral
      ? "text-[var(--color-text-secondary)]"
      : "text-[var(--color-warning)]";
  return (
    <p
      role="status"
      className={`mt-5 flex items-start gap-2 text-sm leading-relaxed ${tone}`}
    >
      {success ? (
        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {t(RESULT_KEYS[outcome.status])}
    </p>
  );
}
