import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, CheckCircle2, AlertCircle, Database } from "lucide-react";

import {
  detectBetaData,
  mergeById,
  snapshotBetaSources,
  validRecords,
  verifySourceIntact,
  type BetaImportPreview,
} from "@/shared/lib/betaImport";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";

type Phase = "idle" | "preview" | "done" | "error";

/**
 * S2 — "Importar dados do perfil de teste (Beta)".
 *
 * The Beta build writes to the open3dcalc_beta_test_* keys of the SAME
 * browser profile; Stable never reads them automatically (test-only
 * namespace contract). This section gives the plan's explicit path:
 * detect → preview per type → import (merge-by-id, source preserved) →
 * report. Idempotent: running it again imports nothing.
 */
export function BetaDataImportSection(): React.ReactElement | null {
  const { t } = useTranslation();
  const isDemo = useIsDemoMode();
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<BetaImportPreview | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    sourceIntact: boolean;
  } | null>(null);

  const isDesktop =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Electron");

  const read = useCallback(
    (key: string) =>
      typeof localStorage !== "undefined" ? localStorage.getItem(key) : null,
    [],
  );

  // Web: read the beta_test keys from localStorage and merge through the
  // stores. Desktop: the v1.14 rows live in the SQLite `storage` table under
  // the inherited key names and the generic db IPC refuses PII — so the
  // migration runs in the main process behind pii:legacy:*.
  const detectWeb = useMemo(() => detectBetaData(read), [read]);

  const detectDesktop = useCallback(async (): Promise<BetaImportPreview> => {
    const cap = await window.electronAPI?.piiLegacy?.detect();
    const sources = (cap?.sources ?? []).map((s) => ({
      type: s.type as BetaImportPreview["sources"][number]["type"],
      storageKey: "",
      records: s.records,
      corrupt: s.corrupt,
    }));
    return {
      sources,
      total: cap?.total ?? 0,
      hasAny: cap?.hasAny ?? false,
    };
  }, []);

  const runImportDesktop = useCallback(async () => {
    try {
      const report = await window.electronAPI?.piiLegacy?.apply();
      setResult({
        imported: report?.imported ?? 0,
        skipped: report?.skipped ?? 0,
        sourceIntact: true,
      });
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, []);

  const runImportWeb = useCallback(() => {
    const snapshot = snapshotBetaSources(read);
    try {
      const customers = useCustomerStore.getState().customers;
      const quotes = useQuoteStore.getState().quotes;
      const history = useHistoryStore.getState().entries;

      const c = mergeById(
        customers,
        validRecords("customers", read) as never[],
      );
      useCustomerStore.setState({ customers: c.merged });
      const q = mergeById(quotes, validRecords("quotes", read) as never[]);
      useQuoteStore.setState({ quotes: q.merged });
      const h = mergeById(history, validRecords("history", read) as never[]);
      useHistoryStore.setState({ entries: h.merged });

      const imported = c.imported + q.imported + h.imported;
      const skipped = c.skipped + q.skipped + h.skipped;
      setResult({
        imported,
        skipped,
        sourceIntact: verifySourceIntact(read, snapshot),
      });
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, [read]);

  if (isDemo) return null;

  return (
    <div
      className="surface rounded-xl p-4 space-y-3"
      data-testid="beta-import-section"
    >
      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
        {t("privacy.betaImport.title")}
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("privacy.betaImport.description")}
      </p>

      {phase === "idle" && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setPreview(isDesktop ? await detectDesktop() : detectWeb);
              setPhase("preview");
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            {t("privacy.betaImport.check")}
          </button>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {t("privacy.betaImport.sourceHint")}
          </span>
        </div>
      )}

      {phase === "preview" && preview && (
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
          {preview.sources.map((source) => (
            <div
              key={source.type}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-[var(--color-text-secondary)]">
                {t(`privacy.betaImport.type.${source.type}`)}
              </span>
              {source.corrupt ? (
                <span className="font-semibold text-[var(--color-warning)]">
                  {t("privacy.betaImport.corrupt")}
                </span>
              ) : (
                <span className="font-mono font-semibold text-[var(--color-text-primary)]">
                  {source.records}
                </span>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {t("privacy.betaImport.sourceHint")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="min-h-[36px] rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {t("privacy.betaImport.cancel")}
              </button>
              <button
                type="button"
                disabled={!preview.hasAny}
                onClick={() =>
                  isDesktop ? runImportDesktop() : runImportWeb()
                }
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[var(--color-positive-fill)] px-3 text-xs font-bold text-[var(--color-positive-fill-fg)] transition-all hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("privacy.betaImport.import")}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div
          role="status"
          className="space-y-1 rounded-xl border border-[var(--color-success)]/40 bg-[var(--color-success)]/5 p-3 text-xs text-[var(--color-text-secondary)]"
        >
          <p className="flex items-center gap-1.5 font-semibold text-[var(--color-success)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("privacy.betaImport.done", { imported: result.imported })}
          </p>
          <p>
            {t("privacy.betaImport.report", {
              skipped: result.skipped,
            })}
          </p>
          <p
            className={`flex items-center gap-1.5 ${
              result.sourceIntact
                ? "text-[var(--color-success)]"
                : "text-[var(--color-warning)]"
            }`}
          >
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {t(
              result.sourceIntact
                ? "privacy.betaImport.sourceIntact"
                : "privacy.betaImport.sourceChanged",
            )}
          </p>
        </div>
      )}

      {phase === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 text-xs text-[var(--color-danger)]"
        >
          {t("privacy.betaImport.error")}
        </div>
      )}
    </div>
  );
}
