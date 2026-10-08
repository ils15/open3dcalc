/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveDesktopErasurePolicy,
  getDesktopErasurePolicy,
  validateDesktopPiiTargetPlan,
} from "../erasurePolicy.js";
import { rendererReportAdapter } from "../erasureStores.js";
import { purgeRendererStores } from "../../src/shared/lib/erasureSaga/rendererSweep.js";
import { loadManifest } from "../../src/shared/lib/dataManifest.js";
import fixture from "../../docs/privacy/SPEC-01-manifest-fixture.json";

afterEach(() => vi.unstubAllGlobals());

/**
 * Build a validated manifest index from the shipped fixture with extra
 * entries. The fixture is synthetic metadata (key NAMES and policy only), so
 * leveraging it keeps the test honest about the real shape without inventing
 * a parallel vocabulary.
 */
function manifestWith(
  extraKeys: unknown[],
  mutate?: (doc: Record<string, unknown>) => void,
) {
  const doc = structuredClone(fixture) as unknown as {
    keys: unknown[];
    [key: string]: unknown;
  };
  doc.keys.push(...extraKeys);
  mutate?.(doc as unknown as Record<string, unknown>);
  return loadManifest(doc);
}

const UNMAPPED_SQLITE_STORAGE_PII = {
  key: "storage_extra",
  surface: "sqlite_storage_table",
  platforms: ["electron"],
  class: "user_content",
  pii: true,
  persistence: "encrypted_at_rest",
  sync: "never",
  export: "never",
  erasure: "erase_on_delete_all",
  retention: { policy: "user_controlled", max_days: 0 },
  purpose: "synthetic unmapped sqlite_storage_table PII entry",
  legal_basis: "consent",
  owner: "hermes",
  version: "1.0",
};

describe("desktop erasure target policy", () => {
  it("does not accept a renderer's empty report as main-process rescan proof", async () => {
    const adapter = rendererReportAdapter("localstorage", {
      purged: 4,
      remaining: [],
    });

    await expect(adapter.rescan()).rejects.toThrow(
      /independent.*verification/i,
    );
  });

  it("does not execute renderer deletion for a fabricated plan", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { removeItem } });

    await expect(
      purgeRendererStores({
        token: "synthetic-token",
        targets: [{ surface: "localStorage", id: "open3dcalc_customers_v1" }],
      }),
    ).rejects.toThrow(/unavailable/i);

    expect(removeItem).not.toHaveBeenCalled();
  });

  it("derives only manifest-declared Electron PII targets", () => {
    const policy = getDesktopErasurePolicy();

    expect(policy.targets).toEqual(
      expect.arrayContaining([
        { surface: "localStorage", id: "open3dcalc_customers_v1" },
        { surface: "localStorage", id: "open3dcalc_quotes_v1" },
        { surface: "localStorage", id: "open3dcalc_history_v2" },
        { surface: "sqlite_domain_tables", id: "customers" },
        { surface: "sqlite_domain_tables", id: "legacy_residue" },
        { surface: "sqlite_storage_table", id: "open3dcalc_customers_v1" },
      ]),
    );
    expect(
      policy.targets.some((target) => target.id === "open3dcalc_consent_v1"),
    ).toBe(false);
    expect(
      policy.targets.some((target) => target.surface === "cache_api"),
    ).toBe(false);
  });

  it("rejects unknown, non-PII, duplicate, and mixed-surface target plans", () => {
    const policy = getDesktopErasurePolicy();
    const allowed = policy.targets;

    expect(validateDesktopPiiTargetPlan(allowed)).toBe(true);
    expect(
      validateDesktopPiiTargetPlan([
        ...allowed,
        { surface: "localStorage", id: "third_party_analytics" },
      ]),
    ).toBe(false);
    expect(
      validateDesktopPiiTargetPlan([
        ...allowed,
        { surface: "localStorage", id: "open3dcalc_consent_v1" },
      ]),
    ).toBe(false);
    expect(
      validateDesktopPiiTargetPlan([
        ...allowed,
        { surface: "cache_api", id: "all-caches" },
      ]),
    ).toBe(false);
    expect(validateDesktopPiiTargetPlan(allowed.slice(1))).toBe(false);
    expect(validateDesktopPiiTargetPlan([...allowed, allowed[0]])).toBe(false);
  });

  it("keeps delete-all unavailable while declared PII-bearing mixed copies cannot be safely targeted", () => {
    const policy = getDesktopErasurePolicy();

    expect(policy.available).toBe(false);
    expect(policy.blockerCodes).toContain("unsupported_pii_surface");
  });

  it("refuses ANY unmapped sqlite_storage_table PII entry and never authorizes its id", () => {
    const policy = deriveDesktopErasurePolicy(
      manifestWith([UNMAPPED_SQLITE_STORAGE_PII]),
    );

    // The unmapped entry is a fail-closed blocker, not a silent omission.
    expect(policy.available).toBe(false);
    expect(policy.blockerCodes).toContain("unmapped_pii_target");
    // It is never mapped to a target, so no plan can carry it.
    expect(
      policy.targets.some(
        (target) =>
          target.surface === "sqlite_storage_table" &&
          target.id === "storage_extra",
      ),
    ).toBe(false);
    // An exact-match plan is still rejected once availability is false by the
    // authorization barrier; and widening to the unmapped id can never match.
    expect(
      validateDesktopPiiTargetPlan(
        [
          ...policy.targets,
          { surface: "sqlite_storage_table", id: "storage_extra" },
        ],
        policy.targets,
      ),
    ).toBe(false);
  });

  it("maps sqlite_storage_table PII only through the explicit `storage` mirror", () => {
    const policy = deriveDesktopErasurePolicy(
      loadManifest(structuredClone(fixture)),
    );

    // The mirror expands to the exact localStorage PII keys as row ids.
    expect(policy.targets).toContainEqual({
      surface: "sqlite_storage_table",
      id: "open3dcalc_customers_v1",
    });
    expect(
      policy.targets
        .filter((target) => target.surface === "sqlite_storage_table")
        .every((target) => target.id.startsWith("open3dcalc_")),
    ).toBe(true);
  });

  it("flags a missing storage mirror as a manifest/code mismatch", () => {
    // Rename the sole declared sqlite_storage_table key so the explicit
    // localStorage-PII mirror has no source.
    const policy = deriveDesktopErasurePolicy(
      manifestWith([], (doc) => {
        const keys = doc.keys as Array<Record<string, unknown>>;
        const storage = keys.find((entry) => entry.key === "storage");
        if (storage) storage.key = "storage_renamed";
      }),
    );

    expect(policy.available).toBe(false);
    // The renamed key is itself unmapped, and the mirror has no source.
    expect(policy.blockerCodes).toContain("unmapped_pii_target");
    expect(policy.blockerCodes).toContain("manifest_code_mismatch");
  });
});
