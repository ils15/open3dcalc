import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { isKeyAllowed, resetManifestForTests } from "@/shared/lib/manifestGate";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const BETA_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;
const STABLE_CUSTOMERS_KEY = "open3dcalc_customers_v1";
const STABLE_CANARY =
  '[{"name":"Stable Canary","email":"stable@example.invalid"}]';

describe("betaIsolation.browser", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
    window.localStorage.setItem(STABLE_CUSTOMERS_KEY, STABLE_CANARY);
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    vi.restoreAllMocks();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("keeps a same-origin Stable canary unreadable while Beta owns only its exact keys", () => {
    expect(guardedStorage.getItem(STABLE_CUSTOMERS_KEY)).toBeNull();
    expect(isKeyAllowed(STABLE_CUSTOMERS_KEY)).toBe(false);

    BETA_KEYS.forEach((key, index) => {
      const value = `synthetic-beta-record-${index + 1}`;
      guardedStorage.setItem(key, value);
      expect(guardedStorage.getItem(key)).toBe(value);
    });

    expect(window.localStorage.getItem(STABLE_CUSTOMERS_KEY)).toBe(
      STABLE_CANARY,
    );
    expect(
      Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index),
      ).sort(),
    ).toEqual([...BETA_KEYS, STABLE_CUSTOMERS_KEY].sort());
  });

  it("does not call localStorage.getItem for a Stable legacy key", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    guardedStorage.getItem(STABLE_CUSTOMERS_KEY);

    expect(getItem).not.toHaveBeenCalledWith(STABLE_CUSTOMERS_KEY);
  });

  it("denies unrecognized and Stable-only keys without a prefix fallback", () => {
    expect(isKeyAllowed("open3dcalc_beta_test_unknown_v1")).toBe(false);
    expect(isKeyAllowed("open3dcalc_history_v2")).toBe(false);
    expect(isKeyAllowed("open3dcalc_beta_test_customers_v2")).toBe(false);
    expect(isKeyAllowed("sw_cache_entries")).toBe(false);
  });
});
