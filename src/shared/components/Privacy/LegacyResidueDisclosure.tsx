import { useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Database, History, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  type HistoryMarkerState,
  type LegacyPiiDisclosure,
  type RehomeDisclosureState,
} from "@/shared/lib/migration/legacyPiiDisclosure";
import { useLegacyPiiDisclosure } from "@/shared/hooks/useLegacyPiiDisclosure";

/**
 * T5.3 — the honest, value-free legacy-residue disclosure panel.
 *
 * ADR-002 §2.2 requires the plaintext residue to be surfaced, never silently
 * migrated and never silently deleted. This panel states, in one place:
 *
 *  (a) which legacy plaintext PII keys still hold data and how many records,
 *  (b) the re-home state (`migrated | pending | incomplete`), the
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
  const [inspectionRequested, setInspectionRequested] = useState(
    disclosure !== undefined,
  );
  // A live source read is deliberately deferred until the user asks to inspect
  // old data. Injected test disclosures remain read-free.
  const live = useLegacyPiiDisclosure(
    disclosure === undefined && inspectionRequested,
  );
  const data = disclosure ?? (live.status === "ready" ? live.disclosure : null);

  if (!data) {
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
        {!inspectionRequested ? (
          <button
            type="button"
            onClick={() => setInspectionRequested(true)}
            className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t("privacy.quarantine.refresh")}
          </button>
        ) : live.status === "loading" ? (
          <p
            role="status"
            className="text-xs text-[var(--color-text-secondary)]"
          >
            {t("privacy.quarantine.working")}
          </p>
        ) : live.status === "unavailable" ? (
          <p role="alert" className="text-xs text-[var(--color-warning)]">
            {t("privacy.quarantine.loadError")}
          </p>
        ) : null}
      </section>
    );
  }

  const presentKeys = data.residue.keys.filter((entry) => entry.present);

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

      {/* (a) plaintext residue — key NAMES + counts only */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          {t("privacy.residue.residueHeading")}
        </p>
        {presentKeys.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("privacy.residue.residueNone")}
          </p>
        ) : (
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
        )}
      </div>

      {/* (b) re-home state */}
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
          {t("privacy.residue.markerNote", { key: data.rehome.markerKey })}
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

      <p className="text-[11px] text-[var(--color-text-muted)]">
        {t("privacy.residue.valueFreeNote")}
      </p>
    </section>
  );
}
