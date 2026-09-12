import { describe, it, expect } from "vitest";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import manifestSchema from "../../../../docs/privacy/SPEC-01-manifest.schema.json";
import {
  loadManifest,
  validateManifestEntry,
  isKnownKey,
  getEntry,
  findOrphanKeys,
  getPolicyVersion,
  ManifestError,
  SURFACES,
  PLATFORMS,
  PERSISTENCE_MODES,
  SYNC_MODES,
  EXPORT_MODES,
  ERASURE_MODES,
  DATA_CLASSES,
  LEGAL_BASES,
  RETENTION_POLICIES,
  type ManifestDocument,
} from "@/shared/lib/dataManifest";
import { getShippedPolicyVersion } from "@/shared/lib/shippedManifest";

// ---------------------------------------------------------------------------
// Helpers (synthetic data only — never real PII)
// ---------------------------------------------------------------------------

function validEntry(overrides = {}) {
  return {
    key: "synthetic_test_key",
    surface: "localStorage",
    platforms: ["web"],
    class: "user_preference",
    pii: false,
    persistence: "plaintext_allowed",
    sync: "opt_in",
    export: "user_export",
    erasure: "erase_on_delete_all",
    retention: { policy: "user_controlled", max_days: 0 },
    purpose: "Synthetic fixture for contract tests.",
    legal_basis: "not_personal_data",
    owner: "hermes",
    version: "1.0",
    ...overrides,
  };
}

function docWith(entries: unknown[]): ManifestDocument {
  return {
    manifest_version: "1.0",
    policy_version: "1.0",
    keys: entries,
  } as ManifestDocument;
}

// ---------------------------------------------------------------------------
// SPEC-01 §keys + TEST-MATRIX 1.1 — fixture validates against the schema
// ---------------------------------------------------------------------------

describe("dataManifest loader (SPEC-01)", () => {
  it("TEST-MATRIX 1.1: loads the schema fixture document without errors", () => {
    const manifest = loadManifest(manifestFixture as ManifestDocument);
    expect(manifest.size).toBeGreaterThan(0);
    expect(isKnownKey(manifest, "open3dcalc_consent_v1")).toBe(true);
  });

  it("SPEC-01: exposes the full policy record per key", () => {
    const manifest = loadManifest(manifestFixture as ManifestDocument);
    const entry = getEntry(manifest, "open3dcalc_consent_v1");
    expect(entry).toMatchObject({
      key: "open3dcalc_consent_v1",
      surface: "localStorage",
      class: "consent_record",
      pii: false,
      persistence: "plaintext_allowed",
      sync: "never",
      export: "never",
      erasure: "erase_on_delete_all",
      owner: "hermes",
      version: "1.0",
    });
    expect(entry?.platforms).toEqual(["electron", "web", "pwa"]);
  });

  it("SPEC-01: loader enum sets match the normative schema $defs (no drift)", () => {
    const defs = (
      manifestSchema as unknown as { $defs: Record<string, { enum: string[] }> }
    ).$defs;
    expect([...SURFACES].sort()).toEqual([...defs.surface.enum].sort());
    expect([...PLATFORMS].sort()).toEqual([...defs.platform.enum].sort());
    expect([...PERSISTENCE_MODES].sort()).toEqual(
      [...defs.persistenceMode.enum].sort(),
    );
    expect([...SYNC_MODES].sort()).toEqual([...defs.syncMode.enum].sort());
    expect([...EXPORT_MODES].sort()).toEqual([...defs.exportMode.enum].sort());
    expect([...ERASURE_MODES].sort()).toEqual(
      [...defs.erasureMode.enum].sort(),
    );
    expect([...DATA_CLASSES].sort()).toEqual([
      "cache",
      "consent_record",
      "derived_analytics",
      "diagnostic",
      "ephemeral_key",
      "onboarding_flag",
      "snapshot",
      "ui_state",
      "user_content",
      "user_preference",
    ]);
    expect([...LEGAL_BASES].sort()).toEqual([
      "consent",
      "contract_performance",
      "legitimate_interest",
      "not_personal_data",
    ]);
    expect([...RETENTION_POLICIES].sort()).toEqual([
      "fixed",
      "session_only",
      "user_controlled",
    ]);
  });

  it("SPEC-01: accepts every entry of the shipped fixture as valid", () => {
    const doc = manifestFixture as ManifestDocument;
    for (const entry of doc.keys) {
      expect(() => validateManifestEntry(entry)).not.toThrow();
    }
  });

  // -----------------------------------------------------------------------
  // TEST-MATRIX 1.2 — plaintext_allowed + pii:true is rejected
  // -----------------------------------------------------------------------

  it("TEST-MATRIX 1.2: REJECTS plaintext_allowed with pii:true", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({ pii: true, persistence: "plaintext_allowed" }),
      ),
    ).toThrow(ManifestError);
    expect(() => loadManifest(docWith([validEntry({ pii: true })]))).toThrow(
      ManifestError,
    );
  });

  it("TEST-MATRIX 1.3: REJECTS legal_basis not_personal_data with pii:true", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({
          pii: true,
          legal_basis: "not_personal_data",
          persistence: "encrypted_at_rest",
        }),
      ),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.4: REJECTS onboarding_flag with sync:opt_in or export:user_export", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({ class: "onboarding_flag", sync: "opt_in" }),
      ),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(
        validEntry({ class: "onboarding_flag", export: "user_export" }),
      ),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.5: REJECTS consent_record with export != never", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({
          class: "consent_record",
          export: "user_export",
          sync: "never",
        }),
      ),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.6: REJECTS snapshot with sync != never or plaintext_allowed", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({
          class: "snapshot",
          pii: true,
          persistence: "encrypted_at_rest",
          sync: "opt_in",
          export: "never",
          legal_basis: "consent",
        }),
      ),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(
        validEntry({
          class: "snapshot",
          pii: true,
          persistence: "plaintext_allowed",
          sync: "never",
          export: "never",
          legal_basis: "consent",
        }),
      ),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.7: REJECTS ephemeral_key with persistence != memory_only", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({
          class: "ephemeral_key",
          persistence: "encrypted_at_rest",
          sync: "never",
          export: "never",
        }),
      ),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.8: REJECTS diagnostic with export:user_export", () => {
    expect(() =>
      validateManifestEntry(
        validEntry({
          class: "diagnostic",
          export: "user_export",
          sync: "never",
        }),
      ),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.9: REJECTS unknown persistence/sync/export/erasure values", () => {
    for (const field of ["persistence", "sync", "export", "erasure"] as const) {
      expect(() =>
        validateManifestEntry(validEntry({ [field]: "bogus_value" })),
      ).toThrow(ManifestError);
    }
    expect(() =>
      validateManifestEntry(validEntry({ surface: "floppy_disk" })),
    ).toThrow(ManifestError);
  });

  it("TEST-MATRIX 1.10: REJECTS missing fields, extra fields, and empty platforms", () => {
    const entry = validEntry() as Record<string, unknown>;
    delete entry.purpose;
    expect(() => validateManifestEntry(entry)).toThrow(ManifestError);
    expect(() => validateManifestEntry(validEntry({ extra_field: 1 }))).toThrow(
      ManifestError,
    );
    expect(() => validateManifestEntry(validEntry({ platforms: [] }))).toThrow(
      ManifestError,
    );
  });

  it("TEST-MATRIX 1.11: REJECTS duplicate keys across entries", () => {
    const first = validEntry({ key: "dup_key" });
    const second = validEntry({ key: "dup_key" });
    expect(() => loadManifest(docWith([first, second]))).toThrow(ManifestError);
  });

  // -----------------------------------------------------------------------
  // S1 wiring: unknown-key deny + orphan enumeration
  // -----------------------------------------------------------------------

  it("S1: unknown keys are NOT known (default-deny)", () => {
    const manifest = loadManifest(manifestFixture as ManifestDocument);
    expect(isKnownKey(manifest, "open3dcalc_no_such_key")).toBe(false);
    expect(getEntry(manifest, "open3dcalc_no_such_key")).toBeUndefined();
  });

  it("S1: every runtime storage key written by the app is registered", () => {
    // Mirrors the key constants in stores, platform overrides, and migration
    // logic (persistence-bridge LOCALSTORAGE_KEYS + dataSync KEYS). If a new
    // key is introduced without a manifest entry, this test fails — and the
    // gate throws in dev at runtime (fail-closed, SPEC-01 default-deny).
    const manifest = loadManifest(manifestFixture as ManifestDocument);
    const runtimeKeys = [
      "open3dcalc_settings_v2",
      "open3dcalc_sections",
      "open3dcalc_catalog_v1",
      "open3dcalc_consent_v1",
      "open3dcalc_customers_v1",
      "open3dcalc_filaments",
      "open3dcalc_history_v2",
      "open3dcalc_products",
      "open3dcalc_quotes_v1",
      "open3dcalc_tutorial_v1",
      "open3dcalc_theme",
      "open3dcalc_dashboard_v1",
      "open3dcalc_dashboard_goal",
      "open3dcalc_onboarded",
      "open3dcalc_migration_done_v2",
      "open3dcalc_quickstart_dismissed",
      "i18nextLng",
    ];
    expect(findOrphanKeys(manifest, runtimeKeys)).toEqual([]);
  });

  it("S1: enumerates orphan keys (in code, absent from the manifest)", () => {
    const manifest = loadManifest(manifestFixture as ManifestDocument);
    const orphans = findOrphanKeys(manifest, [
      "open3dcalc_consent_v1",
      "open3dcalc_no_such_key_yet",
    ]);
    expect(orphans).toEqual(["open3dcalc_no_such_key_yet"]);
  });

  // -----------------------------------------------------------------------
  // S1: loader edge branches (fail-closed on every malformed input shape)
  // -----------------------------------------------------------------------

  it("S1: rejects malformed documents (non-object, bad versions, extra/empty keys)", () => {
    expect(() => loadManifest(null)).toThrow(ManifestError);
    expect(() => loadManifest("nope")).toThrow(ManifestError);
    expect(() => loadManifest({})).toThrow(ManifestError);
    expect(() => loadManifest(docWith([]))).toThrow(ManifestError);
    expect(() =>
      loadManifest({ ...docWith([validEntry()]), manifest_version: "x" }),
    ).toThrow(ManifestError);
    expect(() =>
      loadManifest({ ...docWith([validEntry()]), policy_version: "v1" }),
    ).toThrow(ManifestError);
    expect(() =>
      loadManifest({ ...docWith([validEntry()]), unexpected: true }),
    ).toThrow(ManifestError);
  });

  it("S1: getPolicyVersion returns the document policy version", () => {
    expect(getPolicyVersion(docWith([validEntry()]))).toBe("1.0");
    expect(getShippedPolicyVersion()).toBe(
      (manifestFixture as ManifestDocument).policy_version,
    );
    expect(() => getPolicyVersion(null)).toThrow(ManifestError);
    expect(() => getPolicyVersion({ policy_version: "bad" })).toThrow(
      ManifestError,
    );
  });

  it("S1: rejects malformed retention objects and duplicate platforms", () => {
    expect(() =>
      validateManifestEntry(validEntry({ retention: null })),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(
        validEntry({ retention: { policy: "fixed", max_days: -1 } }),
      ),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(
        validEntry({ retention: { policy: "fixed", max_days: 1.5 } }),
      ),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(
        validEntry({
          retention: { policy: "fixed", max_days: 1, extra: true },
        }),
      ),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(validEntry({ platforms: ["web", "web"] })),
    ).toThrow(ManifestError);
    expect(() =>
      validateManifestEntry(validEntry({ platforms: "web" })),
    ).toThrow(ManifestError);
  });

  it("S1: rejects empty key/purpose/owner and malformed version", () => {
    expect(() => validateManifestEntry(validEntry({ key: "" }))).toThrow(
      ManifestError,
    );
    expect(() => validateManifestEntry(validEntry({ purpose: "" }))).toThrow(
      ManifestError,
    );
    expect(() => validateManifestEntry(validEntry({ owner: "" }))).toThrow(
      ManifestError,
    );
    expect(() => validateManifestEntry(validEntry({ version: "1" }))).toThrow(
      ManifestError,
    );
    expect(() => validateManifestEntry(validEntry({ key: 42 }))).toThrow(
      ManifestError,
    );
  });
});
