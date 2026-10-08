import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { isKeyAllowed, resetManifestForTests } from "@/shared/lib/manifestGate";

const BETA_KEY = "open3dcalc_beta_test_customers_v1";

describe("Stable channel denies Beta test storage", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
    window.localStorage.setItem(BETA_KEY, "synthetic-canary");
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    vi.restoreAllMocks();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("does not allow or read Beta-only keys", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    expect(isKeyAllowed(BETA_KEY)).toBe(false);
    expect(guardedStorage.getItem(BETA_KEY)).toBeNull();
    expect(getItem).not.toHaveBeenCalledWith(BETA_KEY);
    expect(window.localStorage.getItem(BETA_KEY)).toBe("synthetic-canary");
  });
});
