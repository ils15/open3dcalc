import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_PII_PLAINTEXT_KEYS } from "@/shared/lib/legacyPiiPlaintext";
import { fetchDesktopLegacyPiiRows } from "../desktopLegacyRows";

function report(
  status: "absent" | "unsupported_legacy_format" | "legacy_plaintext",
) {
  return {
    scannedAt: new Date().toISOString(),
    rows: LEGACY_PII_PLAINTEXT_KEYS.map((key) => ({
      key,
      value: status === "legacy_plaintext" ? `value:${key}` : null,
      status,
    })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDesktopLegacyPiiRows", () => {
  it("marks a browser without an Electron bridge as not applicable", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
    vi.stubGlobal("electronAPI", undefined);

    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "not_applicable",
    });
  });

  it("reports an unavailable preload bridge instead of absence", async () => {
    vi.stubGlobal("navigator", { userAgent: "Electron/40.0" });
    vi.stubGlobal("electronAPI", undefined);

    await expect(fetchDesktopLegacyPiiRows()).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("reports a missing legacy rows API as unavailable", async () => {
    vi.stubGlobal("electronAPI", { privacy: {} });

    await expect(fetchDesktopLegacyPiiRows()).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("reports rejected or disabled IPC as unavailable, never absent", async () => {
    vi.stubGlobal("electronAPI", {
      privacy: { legacyRows: vi.fn().mockRejectedValue(new Error("disabled")) },
    });

    await expect(fetchDesktopLegacyPiiRows()).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it.each(["absent", "unsupported_legacy_format"] as const)(
    "reports positively established %s rows as absent",
    async (status) => {
      vi.stubGlobal("electronAPI", {
        privacy: { legacyRows: vi.fn().mockResolvedValue(report(status)) },
      });

      await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
        status: "absent",
      });
    },
  );

  it("returns only validated plaintext rows when residue is present", async () => {
    vi.stubGlobal("electronAPI", {
      privacy: {
        legacyRows: vi.fn().mockResolvedValue(report("legacy_plaintext")),
      },
    });

    const result = await fetchDesktopLegacyPiiRows();

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(Object.keys(result.rows)).toEqual([...LEGACY_PII_PLAINTEXT_KEYS]);
    }
  });

  it("rejects malformed reports as unavailable instead of treating them as empty", async () => {
    vi.stubGlobal("electronAPI", {
      privacy: { legacyRows: vi.fn().mockResolvedValue({ rows: [] }) },
    });

    await expect(fetchDesktopLegacyPiiRows()).resolves.toMatchObject({
      status: "unavailable",
    });
  });
});
