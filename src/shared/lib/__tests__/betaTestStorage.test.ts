import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import betaFixture from "../../../../docs/privacy/SPEC-01-beta-test-manifest-fixture.json";
import { loadShippedManifest } from "@/shared/lib/shippedManifest";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { isKeyAllowed, resetManifestForTests } from "@/shared/lib/manifestGate";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

const BETA_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;

const ROUND_TRIP_VALUES: Record<(typeof BETA_KEYS)[number], string> = {
  open3dcalc_beta_test_customers_v1:
    '[{"id":"synthetic-customer-01","name":"Example Customer","email":"beta-fixture@example.invalid"}]',
  open3dcalc_beta_test_quotes_v1:
    '[{"id":"synthetic-quote-01","customerId":"synthetic-customer-01","total":12.5}]',
  open3dcalc_beta_test_history_v1:
    '[{"id":"synthetic-history-01","summary":"Synthetic print","totalCost":3.25}]',
};

describe("betaTestStorage", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(undefined);
    window.localStorage.clear();
  });

  afterEach(() => {
    resetManifestForTests(undefined);
    window.localStorage.clear();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("declares only the three Beta test keys in its dedicated fixture", () => {
    expect(betaFixture.keys.map(({ key }) => key)).toEqual(BETA_KEYS);
    expect(betaFixture.keys).toHaveLength(3);
    for (const entry of betaFixture.keys) {
      expect(entry).toMatchObject({
        surface: "localStorage",
        platforms: ["web"],
        channel: "web-beta",
        pii: false,
        persistence: "plaintext_allowed",
        sync: "never",
        export: "never",
        erasure: "unsupported",
      });
    }
  });

  it.each(BETA_KEYS)("round-trips plaintext for %s", (key) => {
    guardedStorage.setItem(key, ROUND_TRIP_VALUES[key]);

    expect(window.localStorage.getItem(key)).toBe(ROUND_TRIP_VALUES[key]);
    expect(guardedStorage.getItem(key)).toBe(ROUND_TRIP_VALUES[key]);
  });

  it("loads the Beta fixture rather than merging it with the Stable manifest", () => {
    const manifest = loadShippedManifest();

    expect([...manifest.keys()].sort()).toEqual([...BETA_KEYS].sort());
  });

  it("fails closed for every key when the selected Beta manifest is unreadable", () => {
    resetManifestForTests(null);

    expect(isKeyAllowed(BETA_KEYS[0])).toBe(false);
    expect(isKeyAllowed("open3dcalc_beta_test_unknown_v1")).toBe(false);
  });
});
