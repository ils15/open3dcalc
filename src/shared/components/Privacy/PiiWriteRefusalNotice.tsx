import { useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import {
  PII_STORE_KEY,
  getLastPiiWriteRefusal,
  subscribePiiWriteRefusals,
} from "@/shared/lib/localPiiPersistence";

/**
 * H-4 — the consumer `getLastPiiWriteRefusal()` was missing.
 *
 * An unavailable local persistence route records a typed refusal
 * (`getLastPiiWriteRefusal`). Before this
 * component that refusal had no production reader, so a user could add a
 * customer/quote/history entry, see it appear, and lose it on reload — the one
 * invariant this component protects: a refused save must never look healthy.
 *
 * The surfaces that accept a PII entry mount this next to the control. It
 * subscribes to the gate (a refusal is recorded outside React, inside a store
 * `set`), so the refusal appears the instant it happens — not on the next
 * render, not only after a reload. It carries a key NAME and a typed reason,
 * never a value (TEST-MATRIX §3.2), so rendering it can leak no PII.
 *
 * A `demo_session` refusal is deliberately ignored: the demo is ephemeral by
 * design (LGPD), its in-memory writes are intentional, and warning about them
 * would be the opposite of honest.
 */
const AREA_LABEL_KEY: Record<string, string> = {
  [PII_STORE_KEY.customers]: "customers.title",
  [PII_STORE_KEY.quotes]: "quotes.title",
  [PII_STORE_KEY.history]: "history.title",
};

export function PiiWriteRefusalNotice({
  storeKey,
}: {
  /**
   * Only render refusals for this store. Omit to render any refusal, which a
   * surface that is the sole place a PII entry can be created (history) does.
   */
  storeKey?: string;
} = {}): ReactElement | null {
  const { t } = useTranslation();
  const refusal = useSyncExternalStore(
    subscribePiiWriteRefusals,
    getLastPiiWriteRefusal,
    getLastPiiWriteRefusal,
  );

  if (refusal === null) return null;
  if (storeKey !== undefined && refusal.key !== storeKey) return null;

  const area = t(
    AREA_LABEL_KEY[refusal.key] ?? "privacy.localData.writeRefusedAreaUnknown",
  );

  return (
    <div
      role="alert"
      className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-muted)] px-4 py-3 text-[var(--color-warning)]"
    >
      <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <strong className="block text-sm font-bold">
          {t("privacy.localData.writeRefusedTitle")}
        </strong>
        <p className="text-xs sm:text-[13px]">
          {t("privacy.localData.writeRefusedMessage", {
            area,
            reason: refusal.reason,
          })}
        </p>
      </div>
    </div>
  );
}
