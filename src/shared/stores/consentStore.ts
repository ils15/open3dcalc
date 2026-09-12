import { create } from "zustand";
import { persist } from "zustand/middleware";
import { manifestStorage } from "@/shared/lib/manifestStorage";
import {
  annotateWithdrawn,
  issueReceipt,
  type ConsentReceipt,
} from "@/shared/lib/consentReceipt";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { evaluateReceipt } from "@/shared/lib/consentReceipt";
import { consentErasurePlan } from "@/shared/lib/consentReceipt";

/**
 * Consent store (D1.1 S8) — SPEC-04.
 *
 * The PROOF of consent is the tamper-evident receipt bound to the exact
 * policy hash — `consentGiven` is derived from a valid receipt, never from
 * tutorial/onboarding/migration flags or banner dismissal (SPEC-04 §2).
 * Stored via the gated storage (manifest key `open3dcalc_consent_v1`:
 * class consent_record, sync never, export never — it never leaves the
 * device).
 */

interface ConsentStore {
  privacyBannerDismissed: boolean;
  /** Derived mirror of the receipt state (UI convenience only). */
  consentGiven: boolean;
  consentDate: number | null;
  receipt: ConsentReceipt | null;
  receiptDigest: string | null;
  /** §6: withdrawn receipts are kept as the audit record. */
  withdrawnReceipts: ConsentReceipt[];

  dismissBanner(): void;
  giveConsent(): Promise<void>;
  /** §6 withdrawal: annotate + erase consent-basis data per the manifest. */
  withdrawConsent(): Promise<void>;
  resetConsent(): void;
  needsConsent(): boolean;
}

/** Erase the persisted data of every consent-basis localStorage key. */
function eraseConsentBasisLocalStorage(): void {
  for (const key of consentErasurePlan().erase) {
    guardedStorage.removeItem(key);
  }
}

export const useConsentStore = create<ConsentStore>()(
  persist(
    (set, get) => ({
      privacyBannerDismissed: false,
      consentGiven: false,
      consentDate: null,
      receipt: null,
      receiptDigest: null,
      withdrawnReceipts: [],

      dismissBanner: () => set({ privacyBannerDismissed: true }),

      giveConsent: async () => {
        // §3: issue a receipt bound to the CURRENT policy (SPEC-01).
        const { receipt, digest } = await issueReceipt(
          ["customers", "quotes", "history", "dashboard"],
          ["issue_quotes", "cross_device_sync"],
        );
        // Default-deny: only mark consent after the receipt verifies.
        const evaluation = await evaluateReceipt({ receipt, digest });
        if (!evaluation.consentGiven) return;
        set({
          receipt,
          receiptDigest: digest,
          consentGiven: true,
          consentDate: Date.now(),
          privacyBannerDismissed: true,
        });
      },

      withdrawConsent: async () => {
        const current = get().receipt;
        if (!current || current.withdrawn_at !== null) return;
        // §6.1: erase the consent-basis data per the manifest.
        eraseConsentBasisLocalStorage();
        // §6.3: annotate — the receipt is kept, never re-usable.
        const withdrawn = annotateWithdrawn(current, new Date().toISOString());
        set({
          receipt: null,
          receiptDigest: null,
          consentGiven: false,
          consentDate: null,
          withdrawnReceipts: [...get().withdrawnReceipts, withdrawn],
        });
      },

      resetConsent: () =>
        set({
          privacyBannerDismissed: false,
          consentGiven: false,
          consentDate: null,
        }),

      needsConsent: () => !get().consentGiven,
    }),
    {
      name: "open3dcalc_consent_v1",
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
