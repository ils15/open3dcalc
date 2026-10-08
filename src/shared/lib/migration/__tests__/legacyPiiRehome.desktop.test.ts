import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import { migrateLegacyPlaintextPiiToVault } from "../legacyPiiRehome";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("desktop legacyPiiRehome Beta boundary", () => {
  it("does not read legacy SQLite rows or mutate either persistence surface", async () => {
    const fetchLegacy = vi.fn(async () => ({
      status: "available" as const,
      rows: {},
    }));
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");

    const result = await migrateLegacyPlaintextPiiToVault({ fetchLegacy });

    expect(result).toEqual({
      status: "disabled",
      migratedKeys: [],
      skippedKeys: [],
    });
    expect(fetchLegacy).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
