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
import { setWithdrawalPending } from "@/shared/lib/crypto/piiStoreCapability";

/**
 * Consent store (D1.1 S8) — SPEC-04.
 *
 * The PROOF of consent is the tamper-evident receipt bound to the exact
 * policy hash — `consentGiven` is derived from a valid receipt, never from
 * tutorial/onboarding/migration flags or banner dismissal (SPEC-04 §2).
 * Stored via the gated storage (manifest key `open3dcalc_consent_v1`:
 * class consent_record, sync never, export never — it never leaves the
 * device).
 *
 * T5.1: migration consent is a SEPARATE grant from the first-run one. It
 * carries its own scope/purpose, issues its own receipt, and lives beside the
 * first-run grant without sharing its state — so withdrawing or resetting one
 * never touches the other.
 */

/** T5.1: scope of the migration grant — the migrated history only. */
export const MIGRATION_CONSENT_SCOPE: string[] = ["history"];

/** T5.1: purpose of the migration grant — the legacy-history import. */
export const MIGRATION_CONSENT_PURPOSES: string[] = [
  "legacy_history_migration",
];

interface ConsentStore {
  privacyBannerDismissed: boolean;
  /** Derived mirror of the receipt state (UI convenience only). */
  consentGiven: boolean;
  consentDate: number | null;
  receipt: ConsentReceipt | null;
  receiptDigest: string | null;
  /** §6: withdrawn receipts are kept as the audit record. */
  withdrawnReceipts: ConsentReceipt[];

  /** T5.1: derived mirror of the migration receipt (UI convenience only). */
  migrationConsentGiven: boolean;
  migrationConsentDate: number | null;
  migrationReceipt: ConsentReceipt | null;
  migrationReceiptDigest: string | null;
  /** §6: withdrawn migration receipts are kept as the audit record. */
  withdrawnMigrationReceipts: ConsentReceipt[];

  dismissBanner(): void;
  giveConsent(): Promise<void>;
  /** §6 withdrawal: annotate + erase consent-basis data per the manifest. */
  withdrawConsent(): Promise<void>;
  resetConsent(): void;
  needsConsent(): boolean;

  /**
   * T5.1: grant migration consent under its own scope/purpose. Emits a
   * distinct receipt and never reuses `giveConsent`/`consentGiven`.
   */
  grantMigrationConsent(): Promise<void>;
  /** T5.1: withdraw the migration grant, keeping the receipt as audit. */
  withdrawMigrationConsent(): Promise<void>;
  resetMigrationConsent(): void;
  needsMigrationConsent(): boolean;
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

      migrationConsentGiven: false,
      migrationConsentDate: null,
      migrationReceipt: null,
      migrationReceiptDigest: null,
      withdrawnMigrationReceipts: [],

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
        // §6.3: annotate and persist the revocation FIRST. The withdrawn
        // receipt is the durable audit record, and the store's gated storage is
        // synchronous, so it is written before any purge attempt. A crash
        // between the two leaves a revoked receipt with un-erased data
        // (recoverable); erasing first would leave no proof the withdrawal was
        // requested.
        const withdrawn = annotateWithdrawn(current, new Date().toISOString());
        set({
          receipt: null,
          receiptDigest: null,
          consentGiven: false,
          consentDate: null,
          withdrawnReceipts: [...get().withdrawnReceipts, withdrawn],
        });
        // Full-device erasure cannot be verified in this slice, so the lock
        // stays engaged and new PII writes are blocked. No erasure is claimed.
        setWithdrawalPending(true);
        // §6.1: erase the consent-basis data per the manifest.
        eraseConsentBasisLocalStorage();
      },

      resetConsent: () =>
        set({
          privacyBannerDismissed: false,
          consentGiven: false,
          consentDate: null,
        }),

      needsConsent: () => !get().consentGiven,

      grantMigrationConsent: async () => {
        // T5.1: the migration grant is bound to its OWN scope/purpose — it
        // never reuses the first-run fields above or its receipt.
        const { receipt, digest } = await issueReceipt(
          MIGRATION_CONSENT_SCOPE,
          MIGRATION_CONSENT_PURPOSES,
        );
        // Default-deny: only mark the grant after the receipt verifies.
        const evaluation = await evaluateReceipt({ receipt, digest });
        if (!evaluation.consentGiven) return;
        set({
          migrationReceipt: receipt,
          migrationReceiptDigest: digest,
          migrationConsentGiven: true,
          migrationConsentDate: Date.now(),
        });
      },

      withdrawMigrationConsent: async () => {
        const current = get().migrationReceipt;
        if (!current || current.withdrawn_at !== null) return;
        // §6.3: annotate — the receipt is kept, never re-usable. Data erasure
        // for the migration scope is a separate erasure flow, so withdrawing
        // this grant never erases data nor touches the first-run grant.
        const withdrawn = annotateWithdrawn(current, new Date().toISOString());
        set({
          migrationReceipt: null,
          migrationReceiptDigest: null,
          migrationConsentGiven: false,
          migrationConsentDate: null,
          withdrawnMigrationReceipts: [
            ...get().withdrawnMigrationReceipts,
            withdrawn,
          ],
        });
      },

      resetMigrationConsent: () =>
        set({
          migrationConsentGiven: false,
          migrationConsentDate: null,
          migrationReceipt: null,
          migrationReceiptDigest: null,
        }),

      needsMigrationConsent: () => !get().migrationConsentGiven,
    }),
    {
      name: "open3dcalc_consent_v1",
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
