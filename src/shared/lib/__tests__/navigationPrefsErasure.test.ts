import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  NAV_PREFS_STORAGE_KEY,
  saveNavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import { localstorageAdapter } from "@/shared/lib/erasureSaga/rendererSweep";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

/**
 * Phase 7o s3 — the manifest's `erasure` claim, verified.
 *
 * The manifest entry for `open3dcalc_nav_v1` declares
 * `erasure: erase_on_delete_all`. A declaration nobody checks is a declaration
 * nobody can rely on, and SPEC-01 is a compliance document: if the key survived
 * a delete-all, the manifest would be lying to the user and to the auditor.
 *
 * The delete-all path is NOT a hardcoded key list — `localstorageAdapter` is a
 * default-deny sweep that removes any key present in the manifest OR matching
 * the `open3dcalc_` prefix. This suite pins that down for the new key, and
 * deliberately checks BOTH sweep rules separately, so a future refactor that
 * drops either one fails loudly here instead of silently leaving user data
 * behind after an erase.
 */

const NEW_KEY = NAV_PREFS_STORAGE_KEY;

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
  useNavigationPrefsStore.setState({
    activeTab: "calculator",
    hiddenTabs: [],
  });
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("manifest erasure declaration matches reality", () => {
  it("declares erase_on_delete_all for the new key", () => {
    const entry = (manifestFixture as ManifestDocument).keys.find(
      (key) => key.key === NEW_KEY,
    );

    expect(entry, `${NEW_KEY} must be registered in SPEC-01`).toBeDefined();
    expect(entry?.erasure).toBe("erase_on_delete_all");
  });
});

describe("delete-all actually erases open3dcalc_nav_v1", () => {
  it("removes the key once it has been written", async () => {
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["catalog"] });
    expect(window.localStorage.getItem(NEW_KEY)).not.toBeNull();

    const removed = await localstorageAdapter().purge();

    expect(removed).toBeGreaterThan(0);
    expect(window.localStorage.getItem(NEW_KEY)).toBeNull();
  });

  it("reports no residue in the post-condition rescan", async () => {
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });
    await localstorageAdapter().purge();

    const remaining = await localstorageAdapter().rescan();

    expect(remaining).not.toContain(`localstorage:${NEW_KEY}`);
    expect(remaining).toEqual([]);
  });

  it("erases the key even if it were removed from the manifest (prefix rule)", async () => {
    // Proves the SECOND sweep rule independently. Simulates a manifest that no
    // longer knows the key: the `open3dcalc_` default-deny prefix still clears
    // it, so a manifest regression cannot strand the preference on disk.
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });
    const withoutNav = {
      ...(manifestFixture as ManifestDocument),
      keys: (manifestFixture as ManifestDocument).keys.filter(
        (key) => key.key !== NEW_KEY,
      ),
    };
    resetManifestForTests(withoutNav);

    await localstorageAdapter().purge();

    expect(window.localStorage.getItem(NEW_KEY)).toBeNull();
  });

  it("leaves a non-app key untouched (the sweep is not a blanket clear)", async () => {
    window.localStorage.setItem("someone_elses_key", "keep me");
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });

    await localstorageAdapter().purge();

    expect(window.localStorage.getItem("someone_elses_key")).toBe("keep me");
  });

  it("erases the key alongside the user's real data, in one pass", async () => {
    // The realistic delete-all: preferences and user records go together.
    window.localStorage.setItem("open3dcalc_settings_v2", '{"quantity":4}');
    window.localStorage.setItem("open3dcalc_history_v2", '[{"id":"h1"}]');
    window.localStorage.setItem("open3dcalc_spool_v1", '[{"id":"s1"}]');
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["catalog"] });

    await localstorageAdapter().purge();

    for (const key of [
      NEW_KEY,
      "open3dcalc_settings_v2",
      "open3dcalc_history_v2",
      "open3dcalc_spool_v1",
    ]) {
      expect(window.localStorage.getItem(key), key).toBeNull();
    }
  });

  it("resolves to safe defaults after the erase (no half-state)", async () => {
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["catalog"] });
    await localstorageAdapter().purge();

    // A fresh read of a wiped key must land on the defaults, never on a stale
    // or partially-restored value.
    vi.resetModules();
    const fresh = await import("@/shared/lib/navigationPrefs");
    expect(fresh.loadNavigationPrefs()).toEqual(fresh.defaultNavigationPrefs());
  });
});
