import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import {
  PII_STORE_KEY,
  getPiiSurfaceWriteBlockReason,
  beginPiiSurfaceWrite,
  getLastPiiWriteRefusal,
  resetPiiStoreHydrationForTests,
} from "@/shared/lib/crypto/piiStoreHydration";
// Side effect: registers the Beta readability checker with the gate.
import "@/shared/lib/betaPersistence";
import { resetManifestForTests } from "@/shared/lib/manifestGate";

beforeEach(() => {
  window.localStorage.clear();
  resetManifestForTests(undefined);
  resetPiiStoreHydrationForTests();
});

afterEach(() => {
  window.localStorage.clear();
  resetManifestForTests(undefined);
  resetPiiStoreHydrationForTests();
  vi.restoreAllMocks();
});

describe("Beta write gate (synthetic plaintext, no passphrase)", () => {
  it("allows customer/quote/history writes when Beta persistence is empty-but-readable", () => {
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers)).toBeNull();
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.quotes)).toBeNull();
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.history)).toBeNull();
    expect(getLastPiiWriteRefusal()).toBeNull();
  });

  it("allows writes when a valid Beta envelope is persisted", () => {
    window.localStorage.setItem(
      "open3dcalc_beta_test_customers_v1",
      JSON.stringify({ state: { customers: [], searchQuery: "" }, version: 1 }),
    );
    expect(getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers)).toBeNull();
  });

  it("stays fail-closed on malformed Beta data (falls through to Stable block)", () => {
    window.localStorage.setItem(
      "open3dcalc_beta_test_customers_v1",
      "{malformed synthetic Beta data",
    );
    expect(
      getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers),
    ).not.toBeNull();
    expect(beginPiiSurfaceWrite(PII_STORE_KEY.customers)).not.toBeNull();
    expect(getLastPiiWriteRefusal()).not.toBeNull();
  });

  it("stays fail-closed when the Beta manifest is unavailable", () => {
    resetManifestForTests(null);
    expect(
      getPiiSurfaceWriteBlockReason(PII_STORE_KEY.customers),
    ).not.toBeNull();
  });
});
