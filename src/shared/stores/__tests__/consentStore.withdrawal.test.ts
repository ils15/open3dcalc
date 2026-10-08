import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

function stubWithdrawalBridge(purgeResult: unknown) {
  const request = vi.fn().mockResolvedValue({ token: "withdrawal-token" });
  const purge = vi.fn().mockResolvedValue(purgeResult);
  (window as unknown as { electronAPI?: unknown }).electronAPI = {
    withdrawal: { request, purge },
  };
  return { request, purge };
}

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

  it("invokes the desktop production purge and releases the lock on verified completion", async () => {
    const { request, purge } = stubWithdrawalBridge({ ok: true, purged: [] });
    await useConsentStore.getState().giveConsent();

    await useConsentStore.getState().withdrawConsent();

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith({
      receiptId: expect.any(String),
      scope: expect.arrayContaining(["customers", "quotes", "history"]),
    });
    expect(purge).toHaveBeenCalledWith("withdrawal-token");
    expect(isWithdrawalPending()).toBe(false);
  });

  it("keeps the lock and rejects when the desktop purge cannot be verified", async () => {
    stubWithdrawalBridge({ ok: false, reason: "purge_unverified" });
    await useConsentStore.getState().giveConsent();

    await expect(useConsentStore.getState().withdrawConsent()).rejects.toThrow(
      /could not be verified/,
    );
    // The revoked receipt is still the durable audit record and the lock stays.
    expect(useConsentStore.getState().withdrawnReceipts).toHaveLength(1);
    expect(isWithdrawalPending()).toBe(true);
  });

  it("rejects when the desktop bridge returns no usable token", async () => {
    const purge = vi.fn();
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      withdrawal: { request: vi.fn().mockResolvedValue({}), purge },
    };
    await useConsentStore.getState().giveConsent();

    await expect(useConsentStore.getState().withdrawConsent()).rejects.toThrow(
      /authorization unavailable/,
    );
    expect(purge).not.toHaveBeenCalled();
    expect(isWithdrawalPending()).toBe(true);
  });

  it("keeps a failed purge retryable: the retry re-attempts and never silently succeeds", async () => {
    const request = vi.fn().mockResolvedValue({ token: "withdrawal-token" });
    const purge = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: "purge_unverified" })
      .mockResolvedValueOnce({ ok: true, purged: [] });
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      withdrawal: { request, purge },
    };
    await useConsentStore.getState().giveConsent();

    // First attempt fails honestly: no silent success, lock stays engaged and
    // the withdrawn receipt is retained as the durable retry anchor.
    await expect(useConsentStore.getState().withdrawConsent()).rejects.toThrow(
      /could not be verified/,
    );
    expect(purge).toHaveBeenCalledTimes(1);
    expect(isWithdrawalPending()).toBe(true);
    expect(useConsentStore.getState().withdrawnReceipts).toHaveLength(1);

    // The second call after the failure must actually RE-ATTEMPT the purge —
    // not early-return because `receipt` was nulled.
    await useConsentStore.getState().withdrawConsent();
    expect(purge).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(2);
    expect(isWithdrawalPending()).toBe(false);
    // The retry reuses the same audit record; it does not duplicate it.
    expect(useConsentStore.getState().withdrawnReceipts).toHaveLength(1);
  });
});
