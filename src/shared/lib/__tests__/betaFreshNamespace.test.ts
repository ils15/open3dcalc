import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadShippedManifest } from "@/shared/lib/shippedManifest";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { resetManifestForTests } from "@/shared/lib/manifestGate";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const LEGACY_KEYS = [
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
  "open3dcalc_migration_done_v2",
  "open3dcalc_migration_progress_v2",
  "open3dcalc_legacy_pii_rehomed_v1",
] as const;
const BETA_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;

describe("betaFreshNamespace", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
    LEGACY_KEYS.forEach((key, index) => {
      window.localStorage.setItem(key, `synthetic-stable-canary-${index + 1}`);
    });
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("selects a fresh Beta namespace and never registers migration or Stable PII keys", () => {
    const manifest = loadShippedManifest();

    expect([...manifest.keys()].sort()).toEqual([...BETA_KEYS].sort());
    for (const key of LEGACY_KEYS) {
      expect(manifest.has(key)).toBe(false);
      expect(guardedStorage.getItem(key)).toBeNull();
      expect(window.localStorage.getItem(key)).toMatch(
        /^synthetic-stable-canary-/,
      );
    }
  });
});
