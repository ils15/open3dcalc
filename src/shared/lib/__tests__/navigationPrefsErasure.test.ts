import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  NAV_PREFS_STORAGE_KEY,
  saveNavigationPrefs,
} from "@/shared/lib/navigationPrefs";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import { loadManifest, type ManifestDocument } from "@/shared/lib/dataManifest";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";

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
 * the `open3dcalc_` prefix.
 *
 * IMPORTANT — why `shippedManifest` is mocked below, not the gate:
 * `rendererSweep` resolves its manifest through `shippedManifest`, which
 * re-validates the bundler-imported JSON on every call and is completely
 * stateless. `resetManifestForTests` only mutates `manifestGate`'s own
 * module-local cache, and `rendererSweep` never imports `manifestGate`. So
 * calling `resetManifestForTests` here would have NO effect on the sweep, and a
 * test that claimed to prove the prefix rule via that call would pass for the
 * wrong reason — it would silently be exercising the manifest branch instead.
 * Mocking the module the sweep actually resolves through is the only way to
 * make the two rules distinguishable, and the two tests below are paired with
 * the source line they pin so a regression in either is attributable.
 */

vi.mock("../shippedManifest.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shippedManifest.js")>();
  // Set by the test that needs the manifest branch to fail for a key.
  let withoutKeys: string[] = [];

  return {
    ...actual,
    loadShippedManifest: () => {
      const doc = manifestFixture as ManifestDocument;
      if (withoutKeys.length === 0) return actual.loadShippedManifest();
      return loadManifest({
        ...doc,
        keys: doc.keys.filter((key) => !withoutKeys.includes(key.key)),
      });
    },
    /** Test-only: pretend the manifest never knew these keys. */
    __forgetKeys: (keys: string[]) => {
      withoutKeys = keys;
    },
  };
});

const { __forgetKeys } = (await import("../shippedManifest.js")) as unknown as {
  __forgetKeys: (keys: string[]) => void;
};

const { localstorageAdapter } =
  await import("@/shared/lib/erasureSaga/rendererSweep");

const NEW_KEY = NAV_PREFS_STORAGE_KEY;

/** Keys the fixture really registers, for the "real user data" test. */
const REGISTERED_KEYS = ["open3dcalc_settings_v2", "open3dcalc_history_v2"];

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
  __forgetKeys([]);
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

  it("erases the key via the prefix rule when the manifest does not know it", async () => {
    // The manifest branch is disabled for this key, so the ONLY thing that can
    // clear it is `rendererSweep.ts:15` (the `open3dcalc_` prefix). Deleting
    // that line makes this test fail — that pairing is the point of it.
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });
    __forgetKeys([NEW_KEY]);

    await localstorageAdapter().purge();

    expect(window.localStorage.getItem(NEW_KEY)).toBeNull();
  });

  it("still erases a non-prefixed key through the manifest branch alone", async () => {
    // The converse pairing: `i18nextLng` IS registered in SPEC-01 and does NOT
    // start with `open3dcalc_`, so only the manifest branch can clear it. If
    // the prefix line were the sole sweep rule, this key would survive.
    window.localStorage.setItem("i18nextLng", '"en-US"');

    await localstorageAdapter().purge();

    expect(window.localStorage.getItem("i18nextLng")).toBeNull();
  });

  it("clears an unregistered open3dcalc_* key (the default-deny catch-all)", async () => {
    // The prefix rule's real purpose: a key the manifest does not know is still
    // swept rather than silently stranded. This is the assertion that fails if
    // the prefix line is removed.
    window.localStorage.setItem("open3dcalc_orphan_key", "value");
    window.localStorage.setItem("open3dcalc_nav_another_orphan", "value");

    await localstorageAdapter().purge();

    expect(window.localStorage.getItem("open3dcalc_orphan_key")).toBeNull();
    expect(
      window.localStorage.getItem("open3dcalc_nav_another_orphan"),
    ).toBeNull();
  });

  it("leaves a non-app key untouched (the sweep is not a blanket clear)", async () => {
    window.localStorage.setItem("someone_elses_key", "keep me");
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: [] });

    await localstorageAdapter().purge();

    expect(window.localStorage.getItem("someone_elses_key")).toBe("keep me");
  });

  it("erases the key alongside the user's real data, in one pass", async () => {
    // The realistic delete-all: preferences and user records go together. Only
    // genuinely registered keys are used here so this stays a manifest-branch
    // assertion; the prefix catch-all has its own test above.
    for (const key of REGISTERED_KEYS) {
      window.localStorage.setItem(key, '{"quantity":4}');
    }
    saveNavigationPrefs({ activeTab: "history", hiddenTabs: ["catalog"] });

    await localstorageAdapter().purge();

    for (const key of [NEW_KEY, ...REGISTERED_KEYS]) {
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
