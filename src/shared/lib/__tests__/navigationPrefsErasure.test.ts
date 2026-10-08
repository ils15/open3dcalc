import { describe, expect, it } from "vitest";

import { NAV_PREFS_STORAGE_KEY } from "@/shared/lib/navigationPrefs";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";
import { purgeRendererStores } from "@/shared/lib/erasureSaga/rendererSweep";

/**
 * Phase 7o s3 — the manifest's `erasure` claim, verified as a declaration.
 *
 * The manifest entry for `open3dcalc_nav_v1` declares
 * `erasure: erase_on_delete_all`. The delete-all EXECUTION path is disabled:
 * `purgeRendererStores` is fail-closed and the broad renderer adapters were
 * removed (see rendererSweep.ts), so this file verifies the declaration and
 * proves the entry point refuses. It no longer pretends a live renderer sweep
 * still exists — a declaration nobody can execute is disclosed, not faked.
 */

const NEW_KEY = NAV_PREFS_STORAGE_KEY;

describe("manifest erasure declaration matches reality", () => {
  it("declares erase_on_delete_all for the new key", () => {
    const entry = (manifestFixture as ManifestDocument).keys.find(
      (key) => key.key === NEW_KEY,
    );

    expect(entry, `${NEW_KEY} must be registered in SPEC-01`).toBeDefined();
    expect(entry?.erasure).toBe("erase_on_delete_all");
  });
});

describe("delete-all is unavailable, so the declaration is not silently satisfied", () => {
  it("refuses the renderer purge entry point", async () => {
    await expect(
      purgeRendererStores({
        targets: [{ surface: "localStorage", id: NEW_KEY }],
      }),
    ).rejects.toThrow(/unavailable/);
  });
});
