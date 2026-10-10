/**
 * The desktop-aware residue source used by the migration prompt and the residue
 * disclosure panel.
 *
 * On desktop the persistence bridge never hydrates the three migrated PII keys,
 * so a prompt that only read `localStorage` would never open and the disclosure
 * panel would always say "no residue" — the retained-but-invisible defect. These
 * tests pin that the hook merges the read-only IPC rows over `localStorage`, that
 * the web path is unchanged, and that a refused IPC read remains unavailable
 * rather than becoming a local-only empty report.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import {
  mergeLegacyPiiRead,
  useLegacyPiiResidue,
} from "@/shared/hooks/useLegacyPiiResidue";
import {
  fetchDesktopLegacyPiiRows,
  toLegacyPiiRowMap,
  type LegacyPiiRowMap,
} from "@/shared/lib/migration/desktopLegacyRows";

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

  it("prefers a desktop value and falls through otherwise", () => {
    const rows: LegacyPiiRowMap = { [CUSTOMERS]: "desktop" };
    const read = mergeLegacyPiiRead(() => "local", rows);
    expect(read(CUSTOMERS)).toBe("desktop");
    expect(read(QUOTES)).toBe("local");
  });
});

describe("toLegacyPiiRowMap", () => {
  it("keeps only the rows that carry a legacy value", () => {
    const map = toLegacyPiiRowMap({
      scannedAt: new Date().toISOString(),
      rows: [
        { key: CUSTOMERS, value: "legacy", status: "legacy_plaintext" },
        { key: QUOTES, value: null, status: "unsupported_legacy_format" },
        { key: HISTORY, value: null, status: "absent" },
      ],
    });
    expect(map).toEqual({ [CUSTOMERS]: "legacy" });
  });
});

describe("fetchDesktopLegacyPiiRows", () => {
  it("reports not_applicable without a desktop bridge in the browser", async () => {
    await expect(fetchDesktopLegacyPiiRows()).resolves.toEqual({
      status: "not_applicable",
    });
  });

  it("reports unavailable when the bridge lacks the read-only reader", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {},
    };
    await expect(fetchDesktopLegacyPiiRows()).resolves.toMatchObject({
      status: "unavailable",
    });
  });
});

describe("useLegacyPiiResidue", () => {
  it("reads localStorage when the desktop source is not applicable", async () => {
    window.localStorage.setItem(
      CUSTOMERS,
      JSON.stringify({ state: { customers: [{ id: "a" }, { id: "b" }] } }),
    );
    const { result } = renderHook(() => useLegacyPiiResidue());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.report.present).toBe(true);
      expect(result.current.report.total).toBe(2);
    }
  });

  it("merges the desktop rows over localStorage", async () => {
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

    const { result } = renderHook(() => useLegacyPiiResidue());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect([...result.current.report.keys].map((k) => k.key)).toEqual([
        CUSTOMERS,
        QUOTES,
        HISTORY,
      ]);
      expect(result.current.report.total).toBe(2);
    }
  });

  it("preserves unavailable state when the IPC read refuses", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: async () => Promise.reject(new Error("refused")),
      },
    };
    const { result } = renderHook(() => useLegacyPiiResidue());
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("returns idle without any read when disabled", () => {
    const legacyRows = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };
    const { result } = renderHook(() => useLegacyPiiResidue(false));
    expect(result.current).toEqual({ status: "idle" });
    expect(legacyRows).not.toHaveBeenCalled();
  });

  it("stays unavailable when the bridge lacks the reader instead of a local empty report", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {},
    };
    const { result } = renderHook(() => useLegacyPiiResidue());
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    if (result.current.status === "unavailable") {
      expect(result.current.reason.length).toBeGreaterThan(0);
    }
  });

  it("ignores a late desktop resolution after unmount", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      },
    };

    const { unmount } = renderHook(() => useLegacyPiiResidue());
    unmount();
    resolvers[0]?.({ scannedAt: new Date().toISOString(), rows: [] });
    await Promise.resolve();
    await Promise.resolve();

    // The cancelled guard skipped the state write.
    expect(resolvers).toHaveLength(1);
  });

  it("ignores a late desktop rejection after unmount", async () => {
    const rejecters: Array<(reason: unknown) => void> = [];
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: () =>
          new Promise((_resolve, reject) => {
            rejecters.push(reject);
          }),
      },
    };

    const { unmount } = renderHook(() => useLegacyPiiResidue());
    unmount();
    rejecters[0]?.(new Error("late refusal"));
    await Promise.resolve();
    await Promise.resolve();

    expect(rejecters).toHaveLength(1);
  });
});
