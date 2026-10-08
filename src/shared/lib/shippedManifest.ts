/**
 * Shipped SPEC-01 manifest (D1.1 S1/S3).
 *
 * Splits the fixture loading away from the pure validation module so the
 * Electron main process can consume the pure half (`dataManifest.ts`)
 * without pulling an ESM JSON import (which node16 output cannot execute).
 * The renderer keeps using this module (bundler-inlined fixture); the main
 * process reads the SAME fixture file via fs (single source of truth).
 */

import manifestFixture from "../../../docs/privacy/SPEC-01-manifest-fixture.json";
import betaManifestFixture from "../../../docs/privacy/SPEC-01-beta-test-manifest-fixture.json";
import { isBetaChannel } from "@/shared/config/betaChannel";
import {
  getPolicyVersion,
  loadManifest,
  type ManifestDocument,
  type ManifestIndex,
} from "./dataManifest";

const BETA_STORAGE_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;

function loadBetaManifest(): ManifestIndex {
  const fixture = betaManifestFixture as unknown as Record<string, unknown>;
  const erasure = fixture.erasure as Record<string, unknown> | undefined;
  if (
    fixture.manifest_version !== "1.0" ||
    fixture.policy_version !== "1.0" ||
    fixture.channel !== "web-beta" ||
    Object.keys(fixture).some(
      (key) =>
        ![
          "manifest_version",
          "policy_version",
          "channel",
          "erasure",
          "keys",
        ].includes(key),
    ) ||
    erasure?.supported !== false ||
    typeof erasure.reason !== "string" ||
    !Array.isArray(fixture.keys) ||
    fixture.keys.length !== BETA_STORAGE_KEYS.length
  ) {
    throw new Error("Beta manifest fixture is invalid");
  }

  const entries = fixture.keys as Array<Record<string, unknown>>;
  const keys = entries.map((entry) => entry.key);
  if (
    BETA_STORAGE_KEYS.some((key) => !keys.includes(key)) ||
    keys.some((key) => !BETA_STORAGE_KEYS.includes(key as never))
  ) {
    throw new Error("Beta manifest must declare exactly its three test keys");
  }

  // SPEC-01-Beta intentionally has a separate vocabulary (`synthetic_test_data`
  // and `erasure: unsupported`). Project it into the Stable gate's shared type
  // only after checking every Beta-only policy field; no Stable fixture or
  // manifest validation rule is relaxed.
  for (const entry of entries) {
    if (
      entry.surface !== "localStorage" ||
      JSON.stringify(entry.platforms) !== '["web"]' ||
      entry.channel !== "web-beta" ||
      entry.class !== "synthetic_test_data" ||
      entry.pii !== false ||
      entry.persistence !== "plaintext_allowed" ||
      entry.sync !== "never" ||
      entry.export !== "never" ||
      entry.erasure !== "unsupported" ||
      entry.legal_basis !== "not_personal_data"
    ) {
      throw new Error("Beta manifest entry violates its test-only policy");
    }
  }

  return loadManifest({
    manifest_version: fixture.manifest_version,
    policy_version: fixture.policy_version,
    keys: entries.map((entry) => {
      const rest = { ...entry };
      delete rest.channel;
      delete rest.class;
      delete rest.erasure;
      return {
        ...rest,
        class: "user_content",
        erasure: "retain_anonymized",
        legal_basis: "not_personal_data",
      };
    }),
  } as ManifestDocument);
}

/** The shipped SPEC-01 fixture as a validated runtime index. */
export function loadShippedManifest(): ManifestIndex {
  return isBetaChannel
    ? loadBetaManifest()
    : loadManifest(manifestFixture as ManifestDocument);
}

/** Policy version of the shipped fixture. */
export function getShippedPolicyVersion(): string {
  const fixture = isBetaChannel ? betaManifestFixture : manifestFixture;
  return getPolicyVersion(fixture as ManifestDocument);
}
