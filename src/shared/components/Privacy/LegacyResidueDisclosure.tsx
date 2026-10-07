import { useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  HardDrive,
  History,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  type HistoryMarkerState,
  type LegacyPiiDisclosure,
  type RehomeDisclosureState,
} from "@/shared/lib/migration/legacyPiiDisclosure";
import type { PiiVaultAccessState } from "@/shared/lib/crypto/piiStoreHydration";
import {
  useLegacyPiiDisclosure,
  type LegacyPiiInspectionStatus,
} from "@/shared/hooks/useLegacyPiiDisclosure";
import { isElectronRuntime } from "@/shared/lib/migration/desktopLegacyRows";

/**
 * T5.3 — the honest, value-free legacy-residue disclosure panel.
 *
 * ADR-002 §2.2 requires the plaintext residue to be surfaced, never silently
 * migrated and never silently deleted. This panel states, in one place:
 *
 *  (a) which legacy plaintext PII keys still hold data and how many records,
 *  (b) the vault access state (`hydrated | locked | unavailable`),
 *  (c) the re-home state (`migrated | pending | incomplete`), the
 *      history-migration marker state, and whether the legacy PII-bearing
 *      marker still holds PLAINTEXT residue (a value an old build wrote that
 *      the current code never writes and copy-without-delete never erases).
 *
 * It renders KEY NAMES, COUNTS and STATES only. No record value and no marker
 * value is ever read into — or rendered by — this component: the derivation
 * (`getLegacyPiiDisclosure`) is value-free by construction, and the marker is
 * exposed as a key name plus a state.
 *
 * The section is a labelled `region` with `aria-live="polite"`, so a screen
 * reader announces the disclosure when it is reached or updated.
 */

const VAULT_LABEL_KEYS: Record<PiiVaultAccessState["status"], string> = {
  hydrated: "privacy.residue.vaultHydrated",
  locked: "privacy.residue.vaultLocked",
  unavailable: "privacy.residue.vaultUnavailable",
};

const REHOME_LABEL_KEYS: Record<RehomeDisclosureState, string> = {
  migrated: "privacy.residue.rehomeMigrated",
  pending: "privacy.residue.rehomePending",
  incomplete: "privacy.residue.rehomeIncomplete",
};

const HISTORY_LABEL_KEYS: Record<HistoryMarkerState, string> = {
  absent: "privacy.residue.historyAbsent",
  complete: "privacy.residue.historyComplete",
  resumable: "privacy.residue.historyResumable",
};

const HEADING_ID = "privacy-residue-heading";

export interface LegacyResidueDisclosureProps {
  /** Injectable derived disclosure (tests); defaults to a live derivation. */
  disclosure?: LegacyPiiDisclosure;
}

export function LegacyResidueDisclosure({
  disclosure,
}: LegacyResidueDisclosureProps = {}): ReactElement {
  const { t } = useTranslation();
  const [inspectionRequested, setInspectionRequested] = useState(false);
  const [revision, setRevision] = useState(0);
  const desktopRuntime = isElectronRuntime();
  const inspection = useLegacyPiiDisclosure(
    disclosure === undefined && inspectionRequested,
    revision,
  );
  const data = disclosure ?? inspection.disclosure;

  const presentKeys = data?.residue.keys.filter((entry) => entry.present) ?? [];
  const inspectionLabelKeys: Record<
    Exclude<LegacyPiiInspectionStatus, "not_inspected" | "loading">,
    string
  > = {
    not_applicable: "privacy.residue.inspectionNotApplicable",
    absent: "privacy.residue.inspectionAbsent",
    available: "privacy.residue.inspectionAvailable",
    partial: "privacy.residue.inspectionPartial",
    unavailable: "privacy.residue.inspectionUnavailable",
  };

  function inspect(): void {
    setInspectionRequested(true);
    setRevision((current) => current + 1);
  }

  return (
    <section
      role="region"
      aria-labelledby={HEADING_ID}
      aria-live="polite"
      className="surface rounded-xl p-4 space-y-3"
    >
      <h3
        id={HEADING_ID}
        className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2"
      >
        <ShieldCheck
          className="w-4 h-4 text-[var(--color-accent)]"
          aria-hidden="true"
        />
        {t("privacy.residue.title")}
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("privacy.residue.subtitle")}
      </p>

      {disclosure === undefined && (
        <div className="flex flex-wrap items-center gap-3">
          {desktopRuntime && (
            <p className="text-xs text-[var(--color-warning)]">
              {t("privacy.residue.inspectionDesktopUnavailable")}
            </p>
          )}
          <button
            type="button"
            onClick={inspect}
            disabled={inspection.status === "loading"}
            className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
          >
            {desktopRuntime
              ? t(
                  inspectionRequested
                    ? "privacy.residue.inspectLocalAgain"
                    : "privacy.residue.inspectLocal",
                )
              : t(
                  inspectionRequested
                    ? "privacy.residue.inspectAgain"
                    : "privacy.residue.inspect",
                )}
          </button>
          {inspection.status === "loading" ? (
            <p role="status" className="text-xs text-[var(--color-text-muted)]">
              {t("privacy.residue.inspectionLoading")}
            </p>
          ) : inspection.status !== "not_inspected" ? (
            <p
              role="status"
              className="text-xs text-[var(--color-text-secondary)]"
            >
              {t(inspectionLabelKeys[inspection.status])}
            </p>
          ) : null}
        </div>
      )}

      {data !== null && (
        <div className="space-y-3">
          {/* (a) plaintext residue — key NAMES + counts only */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Database
                className="w-3.5 h-3.5 text-amber-400"
                aria-hidden="true"
              />
              {t("privacy.residue.residueHeading")}
            </p>
            {presentKeys.length === 0 && inspection.status !== "unavailable" ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("privacy.residue.residueNone")}
              </p>
            ) : presentKeys.length > 0 ? (
              <>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("privacy.residue.residueTotal", {
                    count: data.residue.total,
                  })}
                </p>
                <ul className="text-xs text-[var(--color-text-secondary)] space-y-0.5">
                  {presentKeys.map((entry) => (
                    <li key={entry.key}>
                      {t("privacy.residue.residueKey", {
                        key: entry.key,
                        count: entry.count,
                      })}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {t("privacy.residue.residueKeptNote")}
                </p>
              </>
            ) : null}
          </div>

          {/* Local markers cannot establish a combined Desktop profile state. */}
          {inspection.status !== "unavailable" && (
            <>
              {/* (b) vault access state */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <HardDrive
                    className="w-3.5 h-3.5 text-[var(--color-accent)]"
                    aria-hidden="true"
                  />
                  {t("privacy.residue.vaultHeading")}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                  {data.vault.status === "locked" && (
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {t(VAULT_LABEL_KEYS[data.vault.status])}
                </p>
                {data.vault.status === "unavailable" && (
                  <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    {t("privacy.residue.vaultUnavailableDetail", {
                      reason: data.vault.reason,
                    })}
                  </p>
                )}
              </div>

              {/* (c) re-home state */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <History
                    className="w-3.5 h-3.5 text-[var(--color-accent)]"
                    aria-hidden="true"
                  />
                  {t("privacy.residue.rehomeHeading")}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t(REHOME_LABEL_KEYS[data.rehome.state])}
                </p>
                <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                  {t("privacy.residue.markerNote", {
                    key: data.rehome.markerKey,
                  })}
                </p>
              </div>

              {/* (c cont.) history-migration marker state */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {t("privacy.residue.historyHeading")}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t(HISTORY_LABEL_KEYS[data.historyMarker.state])}
                </p>
                <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                  {t("privacy.residue.markerNote", {
                    key: data.historyMarker.markerKey,
                  })}
                </p>
                {data.historyMarker.legacyPlaintextResidue && (
                  <p className="text-[11px] text-[var(--color-warning)]">
                    {t("privacy.residue.legacyMarkerPlaintext", {
                      key: data.historyMarker.markerKey,
                    })}
                  </p>
                )}
              </div>

              {/* T4.6 — value-free drift: the legacy source changed after the commit */}
              {data.drift?.detected && (
                <div className="space-y-1" role="status">
                  <p className="text-xs font-semibold text-[var(--color-warning)] flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    {t("privacy.residue.driftHeading")}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("privacy.residue.driftWarning", {
                      sources: data.drift.sources.join(", "),
                    })}
                  </p>
                </div>
              )}
            </>
          )}

          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("privacy.residue.valueFreeNote")}
          </p>
        </div>
      )}
    </section>
  );
}
