import { useState } from "react";
import type { LegacyPiiPlaintextReport } from "@/shared/lib/legacyPiiPlaintext";
import { useConsentStore } from "@/shared/stores/consentStore";
import { useLegacyPiiResidue } from "@/shared/hooks/useLegacyPiiResidue";
import {
  residueSignature,
  useLegacyKeepReadOnlyStore,
} from "@/shared/stores/legacyKeepReadOnlyStore";
import { DataSyncModal } from "@/shared/components/ui/DataSyncModal";
import { LegacyMigrationDialog } from "./LegacyMigrationDialog";

/**
 * T5.2 — the production caller of the legacy-residue detection.
 *
 * ADR-002 §2.2: the residue must be surfaced, never silently migrated nor
 * silently deleted. The prompt appears only when there is residue AND the
 * migration consent is still pending, so it cannot nag a user who already
 * answered by granting the grant.
 *
 * L-2: choosing "keep read-only" is PERSISTED as a VALUE-FREE signature of the
 * residue, so the prompt no longer returns on every session. It returns only
 * when the residue CHANGES (signature mismatch) — and the Privacy screen can
 * clear the decision to reopen the choice. "Not now" still dismisses for the
 * session only: it is not an answer, so nothing is persisted.
 *
 * The residue source is desktop-aware: `useLegacyPiiResidue` merges the SQLite
 * legacy rows (read-only, over IPC) over `localStorage`, so a legacy desktop
 * profile — whose residue the persistence bridge never hydrates — still gets the
 * prompt instead of silently keeping it invisible.
 */
export function LegacyMigrationPrompt() {
  const migrationConsentGiven = useConsentStore((s) => s.migrationConsentGiven);
  const keepSignature = useLegacyKeepReadOnlyStore((s) => s.signature);
  const keepReadOnly = useLegacyKeepReadOnlyStore((s) => s.keep);
  const [dismissed, setDismissed] = useState(false);
  const [keptThisSession, setKeptThisSession] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Desktop-aware and re-read on every change: the residue is
  // copy-without-delete, so it stays present until the user acts, and an unlock
  // elsewhere must be able to make the prompt actionable again without a remount.
  const residueLoad = useLegacyPiiResidue();
  const report: LegacyPiiPlaintextReport =
    residueLoad.status === "ready"
      ? residueLoad.report
      : { present: false, total: 0, keys: [] };
  const signature = residueSignature(report);
  // A stored decision hides the prompt only while the residue is UNCHANGED.
  // `keptThisSession` keeps the confirmation visible on the run where the user
  // just chose it.
  const keptForThisResidue =
    keepSignature !== null && keepSignature === signature && !keptThisSession;
  const open =
    report.present &&
    !migrationConsentGiven &&
    !dismissed &&
    !keptForThisResidue;

  // Reopening the choice from the Privacy screen clears the decision; reset the
  // session dismissal so the prompt becomes actionable again in this session.
  // Adjusting state during render (rather than in an effect) is the pattern
  // React documents for "reset state when a derived value changes", and it
  // avoids the cascading render an effect would cause.
  const [prevSignature, setPrevSignature] = useState(keepSignature);
  if (keepSignature !== prevSignature) {
    setPrevSignature(keepSignature);
    if (keepSignature === null) {
      setDismissed(false);
      setKeptThisSession(false);
    }
  }

  if (residueLoad.status !== "ready") return null;

  return (
    <>
      <LegacyMigrationDialog
        open={open && !exportOpen}
        report={report}
        onRequestClose={() => setDismissed(true)}
        onKeepReadOnly={() => {
          keepReadOnly(signature);
          setKeptThisSession(true);
        }}
        onOpenExport={() => {
          setDismissed(true);
          setExportOpen(true);
        }}
      />
      <DataSyncModal
        open={exportOpen}
        onRequestClose={() => setExportOpen(false)}
      />
    </>
  );
}
