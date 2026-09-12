import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  RefreshCw,
  Lock,
  Trash2,
  AlertCircle,
} from "lucide-react";

/**
 * Privacy screen (D1.1 S4) — ADR-002 §2.2.4.
 *
 * A dedicated surface (reachable from the main navigation) that presents
 * the legacy plaintext quarantine state: which PII keys hold legacy
 * plaintext, how many records, and the only two exits — migrate (encrypt
 * through the ADR-001 capability) or eliminate. Quarantine never
 * auto-resolves and no other flag or banner accepts plaintext (ADR-002
 * §2.2.4/§2.2.5, SPEC-04).
 *
 * Metadata only is displayed: key NAMES and record counts — quarantined
 * values themselves are never rendered here.
 */

interface QuarantineEntry {
  key: string;
  status: string;
  recordCount?: number;
}

interface QuarantineReport {
  scannedAt: string;
  entries: QuarantineEntry[];
  quarantinedKeys: string[];
}

type ActionResult =
  | { key: string; ok: true; kind: "migrated" | "eliminated" }
  | { key: string; ok: false; kind: "migrated" | "eliminated" };

const STATUS_LABEL_KEYS: Record<string, string> = {
  quarantined: "privacy.quarantine.statusQuarantined",
  encrypted: "privacy.quarantine.statusEncrypted",
  absent: "privacy.quarantine.statusAbsent",
  non_pii: "privacy.quarantine.statusNonPii",
  unknown_key: "privacy.quarantine.statusUnknown",
};

export function PrivacyScreen() {
  const { t } = useTranslation();
  const [report, setReport] = useState<QuarantineReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const privacyApi = (
    window as unknown as {
      electronAPI?: {
        privacy: {
          quarantineReport: () => Promise<QuarantineReport>;
          migrateKey: (key: string) => Promise<unknown>;
          eliminateKey: (key: string) => Promise<unknown>;
        };
      };
    }
  ).electronAPI?.privacy;

  const loadReport = useCallback(async () => {
    if (!privacyApi) return;
    setLoading(true);
    try {
      setReport(await privacyApi.quarantineReport());
      setError(null);
    } catch {
      setError(t("privacy.quarantine.loadError"));
    } finally {
      setLoading(false);
    }
  }, [privacyApi, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleMigrate = useCallback(
    async (key: string) => {
      if (!privacyApi) return;
      if (!window.confirm(t("privacy.quarantine.confirmMigrate", { key })))
        return;
      setBusyKey(key);
      setError(null);
      try {
        await privacyApi.migrateKey(key);
        setResult({ key, ok: true, kind: "migrated" });
        await loadReport();
      } catch {
        setResult({ key, ok: false, kind: "migrated" });
      } finally {
        setBusyKey(null);
      }
    },
    [privacyApi, t, loadReport],
  );

  const handleEliminate = useCallback(
    async (key: string) => {
      if (!privacyApi) return;
      if (!window.confirm(t("privacy.quarantine.confirmEliminate", { key })))
        return;
      setBusyKey(key);
      setError(null);
      try {
        await privacyApi.eliminateKey(key);
        setResult({ key, ok: true, kind: "eliminated" });
        await loadReport();
      } catch {
        setResult({ key, ok: false, kind: "eliminated" });
      } finally {
        setBusyKey(null);
      }
    },
    [privacyApi, t, loadReport],
  );

  if (!privacyApi) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
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
      </div>
    );
  }

  const quarantined =
    report?.entries.filter((e) => e.status === "quarantined") ?? [];
  const other = report?.entries.filter((e) => e.status !== "quarantined") ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
      <div className="flex items-start justify-between gap-3">
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
        <button
          type="button"
          onClick={() => void loadReport()}
          aria-label={t("privacy.quarantine.refresh")}
          title={t("privacy.quarantine.refresh")}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="text-sm text-red-400 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div
          role="status"
          className={`text-sm rounded-lg px-3 py-2 border ${
            result.ok
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : "text-red-400 border-red-500/30 bg-red-500/10"
          }`}
        >
          {result.ok
            ? t(
                result.kind === "migrated"
                  ? "privacy.quarantine.migrated"
                  : "privacy.quarantine.eliminated",
                { key: result.key },
              )
            : t(
                result.kind === "migrated"
                  ? "privacy.quarantine.migrateFailed"
                  : "privacy.quarantine.eliminateFailed",
                { key: result.key },
              )}
        </div>
      )}

      {quarantined.length === 0 ? (
        <div className="surface rounded-xl p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("privacy.quarantine.noQuarantined")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {quarantined.map((entry) => (
            <li
              key={entry.key}
              className="surface rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  {entry.key}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("privacy.quarantine.statusQuarantined")}
                  {entry.recordCount !== undefined &&
                    ` · ${t("privacy.quarantine.records", {
                      count: entry.recordCount,
                    })}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleMigrate(entry.key)}
                  disabled={busyKey === entry.key}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
                >
                  {busyKey === entry.key
                    ? t("privacy.quarantine.working")
                    : t("privacy.quarantine.migrate")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleEliminate(entry.key)}
                  disabled={busyKey === entry.key}
                  aria-label={t("privacy.quarantine.eliminate")}
                  title={t("privacy.quarantine.eliminate")}
                  className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--color-bg-elevated)] text-red-400 hover:bg-[var(--color-bg-hover)] border border-red-500/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {other.length > 0 && (
        <div className="surface rounded-xl p-3">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">
            {t("privacy.quarantine.otherData")}
          </p>
          <ul className="text-xs text-[var(--color-text-secondary)] space-y-0.5">
            {other.map((entry) => (
              <li key={entry.key}>
                {entry.key} —{" "}
                {t(
                  STATUS_LABEL_KEYS[entry.status] ??
                    "privacy.quarantine.statusUnknown",
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-[var(--color-text-muted)]">
        {t("privacy.quarantine.readNote")}
      </p>
    </div>
  );
}
