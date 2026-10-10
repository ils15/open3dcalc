import { describe, expect, it } from "vitest";
import stableFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import {
  getEntry,
  loadManifest,
  type ManifestDocument,
} from "@/shared/lib/dataManifest";

const APPROVED_PII_KEYS = [
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_history_v2",
] as const;

describe("stablePlaintextAcceptance", () => {
  it("accepts policy 1.9 and the declared shared customer-data destinations", () => {
    const manifest = loadManifest(stableFixture as ManifestDocument);

    expect(stableFixture.policy_version).toBe("1.9");
    for (const key of APPROVED_PII_KEYS) {
      expect(getEntry(manifest, key)).toMatchObject({
        key,
        surface: "localStorage",
        platforms: ["electron", "web", "pwa"],
        class: "user_content",
        pii: true,
        persistence: "plaintext_allowed",
        legal_basis: "contract_performance",
      });
    }
  });

  it("declares all current PII destinations as readable local storage", () => {
    const manifest = loadManifest(stableFixture as ManifestDocument);
    const otherPiiEntries = [...manifest.values()].filter(
      (entry) =>
        entry.pii &&
        !APPROVED_PII_KEYS.includes(
          entry.key as (typeof APPROVED_PII_KEYS)[number],
        ),
    );

    expect(otherPiiEntries.length).toBeGreaterThan(0);
    expect(
      otherPiiEntries.every(
        (entry) => entry.persistence === "plaintext_allowed",
      ),
    ).toBe(true);
  });
});
