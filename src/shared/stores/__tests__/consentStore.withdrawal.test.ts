import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useConsentStore } from "../consentStore";
import {
  isWithdrawalPending,
  resetPiiStoreGateForTests,
} from "@/shared/lib/crypto/piiStoreCapability";

const INITIAL = {
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
};

beforeEach(() => {
  localStorage.clear();
  resetPiiStoreGateForTests();
  useConsentStore.setState(INITIAL);
});

afterEach(() => {
  resetPiiStoreGateForTests();
});

describe("consentStore withdrawal (receipt-scoped, durable before purge)", () => {
  it("keeps the revoked receipt as the durable audit record", async () => {
    await useConsentStore.getState().giveConsent();
    expect(useConsentStore.getState().receipt).not.toBeNull();

    await useConsentStore.getState().withdrawConsent();

    const state = useConsentStore.getState();
    expect(state.receipt).toBeNull();
    expect(state.receiptDigest).toBeNull();
    expect(state.consentGiven).toBe(false);
    expect(state.withdrawnReceipts).toHaveLength(1);
    expect(state.withdrawnReceipts[0].withdrawn_at).not.toBeNull();
  });

  it("locks new PII writes while the withdrawal is not verifiably complete", async () => {
    await useConsentStore.getState().giveConsent();
    expect(isWithdrawalPending()).toBe(false);

    await useConsentStore.getState().withdrawConsent();

    // Full-device erasure cannot be proven in this slice, so the lock stays
    // engaged and new PII writes are blocked. No erasure is claimed.
    expect(isWithdrawalPending()).toBe(true);
  });

  it("is idempotent on retry", async () => {
    await useConsentStore.getState().giveConsent();
    await useConsentStore.getState().withdrawConsent();
    await useConsentStore.getState().withdrawConsent();

    expect(useConsentStore.getState().withdrawnReceipts).toHaveLength(1);
  });
});
