import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPiiSurfaceWriteBlockReason,
  resetPiiStoreHydrationForTests,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  setPiiPersistenceDeclined,
  setPiiStoreEnvironment,
  setWithdrawalPending,
} from "@/shared/lib/crypto/piiStoreCapability";

describe("noGatePrerequisites", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPiiStoreHydrationForTests();
    setPiiPersistenceDeclined(false);
    setWithdrawalPending(false);
    setPiiStoreEnvironment({
      browser: true,
      secureContext: true,
      webCryptoAvailable: true,
      indexedDbAvailable: true,
    });
  });

  afterEach(() => {
    resetPiiStoreHydrationForTests();
    setPiiPersistenceDeclined(false);
    setWithdrawalPending(false);
    setPiiStoreEnvironment(null);
    window.localStorage.clear();
  });

  it("does not require a vault unlock, passphrase, consent, or receipt to save Stable PII", () => {
    expect(window.localStorage.getItem("open3dcalc_consent_v1")).toBeNull();
    expect(
      window.localStorage.getItem("open3dcalc_consent_receipt_v1"),
    ).toBeNull();

    expect(getPiiSurfaceWriteBlockReason("open3dcalc_customers_v1")).toBeNull();
  });
});
