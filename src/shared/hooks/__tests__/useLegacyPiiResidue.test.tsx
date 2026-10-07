/**
 * The user-triggered desktop residue inspection used by the Privacy panel.
 *
 * On desktop the persistence bridge never hydrates the three migrated PII keys,
 * Tests pin validation and source reporting: a failed or disabled IPC never
 * erases known local residue or turns an incomplete view into a claim of
 * absence. The inspection hook remains idle until explicitly enabled.
 */

import { afterEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  fetchDesktopLegacyPiiRows,
  toLegacyPiiRowMap,
  type LegacyPiiRowMap,
} from "@/shared/lib/migration/desktopLegacyRows";
import {
  mergeLegacyPiiRead,
  useLegacyPiiDisclosure,
} from "@/shared/hooks/useLegacyPiiResidue";

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const HISTORY = "open3dcalc_history_v2";

function installLegacyRows(
  rows: Array<{ key: string; value: string | null; status: string }>,
): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    privacy: {
      legacyRows: async () => ({
        scannedAt: new Date().toISOString(),
        rows,
      }),
    },
  };
}

afterEach(() => {
  delete (window as { electronAPI?: unknown }).electronAPI;
  window.localStorage.clear();
});

describe("mergeLegacyPiiRead", () => {
  it("returns the local reader unchanged when there is no desktop source", () => {
    const local = (): string | null => "local";
    expect(mergeLegacyPiiRead(local, null)).toBe(local);
  });

  it("uses Desktop status for PII keys and falls through for unrelated keys", () => {
    const rows: LegacyPiiRowMap = { [CUSTOMERS]: "desktop" };
    const read = mergeLegacyPiiRead(
      (key) => (key === QUOTES ? "local-quotes" : "local"),
      rows,
    );
    expect(read(CUSTOMERS)).toBe("desktop");
    expect(read(QUOTES)).toBe("local-quotes");
    expect(read("another-key")).toBe("local");
  });

  it("preserves local residue when a valid SQLite report has no row for its key", () => {
    const read = mergeLegacyPiiRead(
      (key) => (key === CUSTOMERS ? "local-customer" : null),
      {},
    );
    expect(read(CUSTOMERS)).toBe("local-customer");
  });
});

describe("toLegacyPiiRowMap", () => {
  it("keeps only the rows that carry a legacy value", () => {
    const map = toLegacyPiiRowMap({
      scannedAt: new Date().toISOString(),
      rows: [
        { key: CUSTOMERS, value: "legacy", status: "legacy_plaintext" },
        { key: QUOTES, value: null, status: "already_encrypted" },
        { key: HISTORY, value: null, status: "absent" },
      ],
    });
    expect(map).toEqual({ [CUSTOMERS]: "legacy" });
  });
});

describe("fetchDesktopLegacyPiiRows", () => {
  it("reports that a desktop source is not applicable without an Electron bridge", async () => {
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "not_applicable",
    });
  });

  it("reports unavailable when the bridge lacks the read-only reader", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {},
    };
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("reports unavailable when IPC rejects instead of treating it as absent", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows: async () => Promise.reject(new Error("refused")) },
    };
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("reports an unavailable preload bridge as unavailable in an Electron runtime", async () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 Electron/36.0.0",
    });
    try {
      await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
        status: "unavailable",
      });
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: originalUserAgent,
      });
    }
  });

  it("reports absent only for a valid report with no legacy plaintext rows", async () => {
    installLegacyRows([
      { key: CUSTOMERS, value: null, status: "absent" },
      { key: QUOTES, value: null, status: "already_encrypted" },
      { key: HISTORY, value: null, status: "absent" },
    ]);
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "absent",
      rows: {},
    });
  });

  it("reports available only for a complete validated legacy row report", async () => {
    installLegacyRows([
      { key: CUSTOMERS, value: "{}", status: "legacy_plaintext" },
      { key: QUOTES, value: null, status: "absent" },
      { key: HISTORY, value: null, status: "absent" },
    ]);
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "available",
      rows: { [CUSTOMERS]: "{}" },
    });
  });

  it("reports unavailable for malformed or incomplete IPC reports", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: async () => ({
          scannedAt: "invalid",
          rows: [{ key: CUSTOMERS, value: "{}", status: "legacy_plaintext" }],
        }),
      },
    };
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "unavailable",
    });
  });
});

describe("useLegacyPiiDisclosure", () => {
  it("does not inspect localStorage until explicitly enabled", () => {
    window.localStorage.setItem(
      CUSTOMERS,
      JSON.stringify({ state: { customers: [{ id: "a" }, { id: "b" }] } }),
    );
    const { result } = renderHook(() => useLegacyPiiDisclosure(false));
    expect(result.current.status).toBe("not_inspected");
    expect(result.current.disclosure).toBeNull();
  });

  it("merges validated desktop rows after explicit inspection", async () => {
    installLegacyRows([
      {
        key: CUSTOMERS,
        value: JSON.stringify({ state: { customers: [{ id: "a" }] } }),
        status: "legacy_plaintext",
      },
      {
        key: QUOTES,
        value: JSON.stringify({ state: { quotes: [{ id: "q" }] } }),
        status: "legacy_plaintext",
      },
      { key: HISTORY, value: null, status: "absent" },
    ]);

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("available"));
    expect(result.current.disclosure?.residue.present).toBe(true);
    expect(result.current.disclosure?.residue.total).toBe(2);
  });

  it("keeps local residue when a valid Desktop report positively lacks that SQLite row", async () => {
    window.localStorage.setItem(
      CUSTOMERS,
      JSON.stringify({ state: { customers: [{ id: "local-only" }] } }),
    );
    installLegacyRows([
      { key: CUSTOMERS, value: null, status: "absent" },
      { key: QUOTES, value: null, status: "absent" },
      { key: HISTORY, value: null, status: "absent" },
    ]);

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("available"));
    expect(result.current.disclosure?.residue.present).toBe(true);
    expect(result.current.disclosure?.residue.total).toBe(1);
    expect(result.current.disclosure?.residue.keys).toContainEqual({
      key: CUSTOMERS,
      present: true,
      count: 1,
    });
  });

  it("reports absence only when the valid Desktop report and local storage are both empty", async () => {
    installLegacyRows([
      { key: CUSTOMERS, value: null, status: "absent" },
      { key: QUOTES, value: null, status: "absent" },
      { key: HISTORY, value: null, status: "absent" },
    ]);

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("absent"));
    expect(result.current.disclosure?.residue.present).toBe(false);
  });

  it("retains known local residue while the combined Desktop profile stays unavailable", async () => {
    window.localStorage.setItem(
      CUSTOMERS,
      JSON.stringify({ state: { customers: [{ id: "local-only" }] } }),
    );
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows: async () => Promise.reject(new Error("refused")) },
    };

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.disclosure?.residue.present).toBe(true);
    expect(result.current.disclosure?.residue.total).toBe(1);
  });

  it("keeps local absence unknown when the Desktop SQLite source is unavailable", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: async () => Promise.reject(new Error("refused")),
      },
    };
    const { result } = renderHook(() => useLegacyPiiDisclosure(true));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.disclosure?.residue.present).toBe(false);
  });

  it("includes local and SQLite residue when both sources are positively inspected", async () => {
    window.localStorage.setItem(
      QUOTES,
      JSON.stringify({ state: { quotes: [{ id: "local-quote" }] } }),
    );
    installLegacyRows([
      {
        key: CUSTOMERS,
        value: JSON.stringify({
          state: { customers: [{ id: "sqlite-customer" }] },
        }),
        status: "legacy_plaintext",
      },
      { key: QUOTES, value: null, status: "absent" },
      { key: HISTORY, value: null, status: "absent" },
    ]);

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("available"));
    expect(result.current.disclosure?.residue.total).toBe(2);
    expect(result.current.disclosure?.residue.keys).toContainEqual({
      key: CUSTOMERS,
      present: true,
      count: 1,
    });
    expect(result.current.disclosure?.residue.keys).toContainEqual({
      key: QUOTES,
      present: true,
      count: 1,
    });
  });
});
