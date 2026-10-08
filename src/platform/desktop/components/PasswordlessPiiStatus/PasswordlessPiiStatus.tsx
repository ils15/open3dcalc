/**
 * Desktop-only status surface for the passwordless new-PII route (Beta12
 * Phase3).
 *
 * ## What it is for
 *
 * It is the minimal Desktop UI wiring that actually USES the `pii:new:*` route:
 * on mount it checks the main-process gate and the passwordless record keys.
 * It appears only after a record actually exists on that route, and includes
 * the honest limitation that losing the OS profile, device or key makes those
 * records unrecoverable.
 *
 * It renders NOTHING on the web build (the preload has no `piiNew` member) and
 * nothing when the gate is unavailable or no route-backed record exists.
 * Advertising "passwordless is on" before the first successful write would be
 * a false promise. The route is fail-closed at persistence regardless.
 */

import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import {
  hasPersistedNewPiiRecord,
  isNewPiiRoutePresent,
  NEW_PII_RECORD_SAVED_EVENT,
} from "@/platform/desktop/overrides/newPiiStorage";

export function PasswordlessPiiStatus(): ReactElement | null {
  const { t } = useTranslation();
  // A pure read of the preload bridge, safe during render: on the web build
  // there is no `piiNew` member, so the component renders nothing and new PII
  // stays blocked below the UI.
  const routePresent = isNewPiiRoutePresent();
  const [hasPersistedRecord, setHasPersistedRecord] = useState(false);

  useEffect(() => {
    if (!routePresent) return;
    let cancelled = false;
    const markRecordPresent = (): void => setHasPersistedRecord(true);
    window.addEventListener(NEW_PII_RECORD_SAVED_EVENT, markRecordPresent);
    void hasPersistedNewPiiRecord().then((exists) => {
      if (!cancelled) setHasPersistedRecord(exists);
    });
    return () => {
      cancelled = true;
      window.removeEventListener(NEW_PII_RECORD_SAVED_EVENT, markRecordPresent);
    };
  }, [routePresent]);

  if (!routePresent) return null;
  if (!hasPersistedRecord) return null;

  return (
    <section
      aria-label={t("privacy.passwordless.title")}
      data-testid="passwordless-pii-status"
      className="w-full border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]"
    >
      <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full px-4 sm:px-6 lg:px-12 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center shrink-0 text-[var(--color-accent)]">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <strong className="text-xs sm:text-sm font-bold">
            {t("privacy.passwordless.title")}
          </strong>
          <p className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">
            {t("privacy.passwordless.message")}
          </p>
          <p className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] mt-1 leading-snug">
            {t("privacy.passwordless.limitation")}
          </p>
        </div>
      </div>
    </section>
  );
}
