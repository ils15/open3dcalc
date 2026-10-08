import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LegacyPiiPlaintextReport } from "@/shared/lib/legacyPiiPlaintext";
import {
  LEGACY_KEEP_READONLY_KEY,
  residueSignature,
  useLegacyKeepReadOnlyStore,
} from "../legacyKeepReadOnlyStore";

/**
 * L-2 — the persisted, value-free "keep read-only" decision.
 *
 * The store must remember the answer without ever holding a record: the
 * persisted payload is a residue SIGNATURE (key names + counts) and nothing
 * else. It must also forget on `reopen()`, which is the Privacy-screen path
 * back to the choice.
 */

const CANARY = "SENTINEL-KEEP-READONLY-CANARY";

function report(entries: Array<[string, number]>): LegacyPiiPlaintextReport {
  const keys = entries.map(([key, count]) => ({
    key: key as LegacyPiiPlaintextReport["keys"][number]["key"],
    present: count > 0,
    count,
  }));
  return {
    present: keys.some((entry) => entry.present),
    total: keys.reduce((sum, entry) => sum + entry.count, 0),
    keys,
  };
}

const WITH_RESIDUE = report([
  ["open3dcalc_customers_v1", 2],
  ["open3dcalc_quotes_v1", 0],
  ["open3dcalc_history_v2", 1],
]);

beforeEach(() => {
  window.localStorage.clear();
  useLegacyKeepReadOnlyStore.setState({ signature: null });
});

afterEach(() => {
  window.localStorage.clear();
  useLegacyKeepReadOnlyStore.setState({ signature: null });
});

describe("residueSignature", () => {
  it("encodes key names and counts, never a value", () => {
    const signature = residueSignature(WITH_RESIDUE);
    expect(signature).toContain("open3dcalc_customers_v1=2");
    expect(signature).toContain("open3dcalc_quotes_v1=absent");
    expect(signature).toContain("open3dcalc_history_v2=1");
    expect(signature).not.toContain(CANARY);
  });

  it("changes when the residue changes", () => {
    expect(residueSignature(WITH_RESIDUE)).not.toBe(
      residueSignature(
        report([
          ["open3dcalc_customers_v1", 3],
          ["open3dcalc_quotes_v1", 0],
          ["open3dcalc_history_v2", 1],
        ]),
      ),
    );
  });
});

describe("useLegacyKeepReadOnlyStore", () => {
  it("does not persist a retired legacy decision", () => {
    const signature = residueSignature(WITH_RESIDUE);
    window.localStorage.setItem(LEGACY_KEEP_READONLY_KEY, CANARY);
    useLegacyKeepReadOnlyStore.getState().keep(signature);

    expect(useLegacyKeepReadOnlyStore.getState().signature).toBeNull();
    expect(window.localStorage.getItem(LEGACY_KEEP_READONLY_KEY)).toBe(CANARY);
  });

  it("does not remove a retired legacy key on reopen", () => {
    window.localStorage.setItem(LEGACY_KEEP_READONLY_KEY, CANARY);
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    useLegacyKeepReadOnlyStore.setState({ signature: "in-memory-only" });
    useLegacyKeepReadOnlyStore.getState().reopen();

    expect(useLegacyKeepReadOnlyStore.getState().signature).toBe(
      "in-memory-only",
    );
    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    expect(window.localStorage.getItem(LEGACY_KEEP_READONLY_KEY)).toBe(CANARY);
  });
});
