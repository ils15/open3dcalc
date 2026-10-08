/**
 * Disabled renderer-surface purge (SPEC-02 §3 rows 1/5/6/7).
 *
 * The former broad adapters were removed (see `rendererSweep.ts`). What remains
 * is the fail-closed entry point: it must refuse any authorization and must not
 * touch a single browser deletion primitive. That is the whole guarantee, and
 * it is asserted by invocation — not by pinning the absence of source text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeRendererStores } from "../rendererSweep";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("purgeRendererStores", () => {
  it("refuses the bulk entry point without durable authorization", async () => {
    await expect(purgeRendererStores({ token: "synthetic" })).rejects.toThrow(
      /unavailable/,
    );
    await expect(purgeRendererStores(undefined)).rejects.toThrow(/unavailable/);
    await expect(purgeRendererStores([])).rejects.toThrow(/unavailable/);
  });

  it("never touches a browser deletion primitive", async () => {
    const removeItem = vi.fn();
    const deleteDatabase = vi.fn();
    const cacheDelete = vi.fn();
    const unregister = vi.fn();

    vi.stubGlobal("window", {
      localStorage: {
        length: 1,
        key: () => "open3dcalc_customers_v1",
        removeItem,
      },
    });
    vi.stubGlobal("indexedDB", {
      databases: async () => [{ name: "synthetic-db" }],
      deleteDatabase,
    });
    vi.stubGlobal("caches", {
      keys: async () => ["synthetic-cache"],
      delete: cacheDelete,
    });
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
    });

    await expect(
      purgeRendererStores({
        token: "synthetic-token",
        targets: [{ surface: "localStorage", id: "open3dcalc_customers_v1" }],
      }),
    ).rejects.toThrow(/unavailable/);

    expect(removeItem).not.toHaveBeenCalled();
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(cacheDelete).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
  });
});
