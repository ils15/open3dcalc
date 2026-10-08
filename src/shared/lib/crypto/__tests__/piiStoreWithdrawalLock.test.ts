import { afterEach, describe, expect, it } from "vitest";
import {
  isPiiStoreAllowed,
  piiStoreRefusalReason,
  resetPiiStoreGateForTests,
  resolvePiiStoreRefusal,
  setPiiStoreEnvironment,
  setWithdrawalPending,
} from "../piiStoreCapability";

const CAPABLE_ENVIRONMENT = {
  browser: true,
  secureContext: true,
  webCryptoAvailable: true,
  indexedDbAvailable: true,
} as const;

afterEach(() => {
  resetPiiStoreGateForTests();
});

describe("withdrawal-pending PII lock", () => {
  it("refuses PII access while a withdrawal is pending", () => {
    expect(
      resolvePiiStoreRefusal({
        demoSuppressed: false,
        environment: { ...CAPABLE_ENVIRONMENT },
        declined: false,
        locked: false,
        withdrawalPending: true,
      }),
    ).toBe("withdrawal_pending");
  });

  it("outranks the fixable locked state but not a non-browser runtime", () => {
    expect(
      resolvePiiStoreRefusal({
        demoSuppressed: false,
        environment: { ...CAPABLE_ENVIRONMENT },
        declined: false,
        locked: true,
        withdrawalPending: true,
      }),
    ).toBe("withdrawal_pending");

    expect(
      resolvePiiStoreRefusal({
        demoSuppressed: false,
        environment: { ...CAPABLE_ENVIRONMENT, browser: false },
        declined: false,
        locked: false,
        withdrawalPending: true,
      }),
    ).toBe("not_a_browser");
  });

  it("blocks the live gate once the lock is engaged, and releases on reset", () => {
    setPiiStoreEnvironment({ ...CAPABLE_ENVIRONMENT });
    expect(piiStoreRefusalReason(false)).toBeNull();
    expect(isPiiStoreAllowed(false)).toBe(true);

    setWithdrawalPending(true);
    expect(piiStoreRefusalReason(false)).toBe("withdrawal_pending");
    expect(isPiiStoreAllowed(false)).toBe(false);

    setWithdrawalPending(false);
    expect(piiStoreRefusalReason(false)).toBeNull();
  });
});
