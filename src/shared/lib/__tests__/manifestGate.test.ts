import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkKey,
  isKeyAllowed,
  resetManifestForTests,
  ManifestError,
  MANIFEST_POLICY_VERSION,
} from "@/shared/lib/manifestGate";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

// ---------------------------------------------------------------------------
// S1 wiring: unknown-key deny is an explicit dev error and never leaks the
// key material; production falls back to a safe deny (no crash).
// ---------------------------------------------------------------------------

describe("manifestGate (S1 unknown-key deny)", () => {
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    resetManifestForTests(manifestFixture as ManifestDocument);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    resetManifestForTests(null);
    vi.restoreAllMocks();
    process.env.NODE_ENV = OLD_ENV;
  });

  it("S1: allows known manifest keys with their full policy record", () => {
    const decision = checkKey("open3dcalc_consent_v1");
    expect(decision.allowed).toBe(true);
    expect(decision.entry?.key).toBe("open3dcalc_consent_v1");
    expect(decision.entry?.pii).toBe(false);
    expect(MANIFEST_POLICY_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it("S1: denies unknown keys with an explicit error in dev (no key material in logs)", () => {
    process.env.NODE_ENV = "development";
    expect(() => checkKey("open3dcalc_no_such_key")).toThrow(ManifestError);
    expect(() => checkKey("open3dcalc_no_such_key")).toThrow(
      /unknown storage key/,
    );
    // Logs carry only the key NAME (metadata), never stored values.
    expect(console.warn).toHaveBeenCalled();
    const logged = vi
      .mocked(console.warn)
      .mock.calls.map((args) => String(args[0]))
      .join(" ");
    expect(logged).toContain("open3dcalc_no_such_key");
  });

  it("S1: never crashes production — unknown keys fall back to a safe deny", () => {
    process.env.NODE_ENV = "production";
    const decision = checkKey("open3dcalc_no_such_key");
    expect(decision.allowed).toBe(false);
    expect(decision.entry).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("S1: denies everything when the manifest fails to load (fail-closed)", () => {
    resetManifestForTests(null);
    process.env.NODE_ENV = "production";
    const decision = checkKey("open3dcalc_consent_v1");
    expect(decision.allowed).toBe(false);
  });

  it("S1: isKeyAllowed never throws and rejects unknown keys in dev and prod", () => {
    process.env.NODE_ENV = "development";
    expect(isKeyAllowed("open3dcalc_consent_v1")).toBe(true);
    expect(isKeyAllowed("open3dcalc_rogue")).toBe(false);
    process.env.NODE_ENV = "production";
    expect(isKeyAllowed("open3dcalc_consent_v1")).toBe(true);
    expect(isKeyAllowed("open3dcalc_rogue")).toBe(false);
    // Fail-closed: unreadable manifest denies even known keys, never throws.
    resetManifestForTests(null);
    expect(isKeyAllowed("open3dcalc_consent_v1")).toBe(false);
  });

  it("S1: reset without a document clears the cache and policy version", () => {
    process.env.NODE_ENV = "production";
    resetManifestForTests(manifestFixture as ManifestDocument);
    expect(MANIFEST_POLICY_VERSION).toBe(
      (manifestFixture as ManifestDocument).policy_version,
    );
    resetManifestForTests(undefined);
    // Cache cleared (not failed): the next lookup lazily reloads the shipped
    // manifest, so the policy version is restored by ensureLoaded().
    const decision = checkKey("open3dcalc_consent_v1");
    expect(decision.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// W0 (V2.0): the three `ui_preference` keys registered by SPEC-01 policy 1.4
// are allowed by the gate with their full policy record, the new class value
// is part of the normative vocabulary, and the fail-closed deny still holds
// for any key that is NOT in the manifest.
// ---------------------------------------------------------------------------

describe("manifestGate (W0 SPEC-01 v1.4 ui_preference keys)", () => {
  const OLD_ENV = process.env.NODE_ENV;

  const V14_KEYS = [
    "open3dcalc_layout_v1",
    "open3dcalc_share_prefs_v1",
    "open3dcalc_marketplace_comparison_v1",
  ] as const;

  beforeEach(() => {
    resetManifestForTests(manifestFixture as ManifestDocument);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    resetManifestForTests(null);
    vi.restoreAllMocks();
    process.env.NODE_ENV = OLD_ENV;
  });

  it.each(V14_KEYS)("W0: allows the v1.4 ui_preference key %s", (key) => {
    const decision = checkKey(key);
    expect(decision.allowed).toBe(true);
    expect(decision.entry?.key).toBe(key);
    // Class value added to the schema vocabulary for V2.0.
    expect(decision.entry?.class).toBe("ui_preference");
    // Device-level ergonomic choices: non-PII, plaintext, never synced or
    // exported, erased on delete-all.
    expect(decision.entry?.pii).toBe(false);
    expect(decision.entry?.persistence).toBe("plaintext_allowed");
    expect(decision.entry?.sync).toBe("never");
    expect(decision.entry?.export).toBe("never");
    expect(decision.entry?.erasure).toBe("erase_on_delete_all");
    expect(decision.entry?.legal_basis).toBe("not_personal_data");
  });

  it("W0: ships policy_version 1.4", () => {
    expect((manifestFixture as ManifestDocument).policy_version).toBe("1.4");
    expect(MANIFEST_POLICY_VERSION).toBe("1.4");
  });

  it("W0: still denies an unregistered key in dev (fail-closed)", () => {
    process.env.NODE_ENV = "development";
    // A near-miss variant of the new layout key is NOT registered — the gate
    // must keep rejecting it instead of pattern-matching by prefix.
    expect(() => checkKey("open3dcalc_layout_v2")).toThrow(ManifestError);
    expect(() => checkKey("open3dcalc_layout_v2")).toThrow(
      /unknown storage key/,
    );
  });

  it("W0: still denies an unregistered key in production (safe deny)", () => {
    process.env.NODE_ENV = "production";
    expect(checkKey("open3dcalc_share_prefs_v2").allowed).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});
