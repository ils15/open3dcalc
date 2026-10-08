/**
 * Desktop-aware disclosure hook.
 *
 * The panel injects its own disclosure in tests; the live hook is only read
 * when explicitly enabled. These specs pin the two fail-closed branches the
 * component relies on: disabled means no read at all, and an unavailable
 * desktop source stays unavailable rather than becoming an empty local report.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useLegacyPiiDisclosure } from "@/shared/hooks/useLegacyPiiDisclosure";

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useLegacyPiiDisclosure", () => {
  it("returns idle and performs no read when disabled", () => {
    const legacyRows = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };

    const { result } = renderHook(() => useLegacyPiiDisclosure(false));

    expect(result.current).toEqual({ status: "idle" });
    expect(legacyRows).not.toHaveBeenCalled();
  });

  it("stays unavailable when the desktop bridge lacks the reader", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {},
    };

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("stays unavailable when the read-only IPC refuses", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: async () => {
          throw new Error("refused");
        },
      },
    };

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("resolves a disclosure on the web when there is no desktop bridge", async () => {
    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.disclosure).toBeDefined();
    }
  });

  it("merges a validated desktop report into the disclosure", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: async () => ({
          scannedAt: new Date().toISOString(),
          rows: [
            {
              key: "open3dcalc_customers_v1",
              value: JSON.stringify({ state: { customers: [{ id: "a" }] } }),
              status: "legacy_plaintext",
            },
            { key: "open3dcalc_quotes_v1", value: null, status: "absent" },
            { key: "open3dcalc_history_v2", value: null, status: "absent" },
          ],
        }),
      },
    };

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(result.current.disclosure).toBeDefined();
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

    const { unmount } = renderHook(() => useLegacyPiiDisclosure(true));
    unmount();
    resolvers[0]?.({
      scannedAt: new Date().toISOString(),
      rows: [
        { key: "open3dcalc_customers_v1", value: null, status: "absent" },
        { key: "open3dcalc_quotes_v1", value: null, status: "absent" },
        { key: "open3dcalc_history_v2", value: null, status: "absent" },
      ],
    });
    await Promise.resolve();
    await Promise.resolve();

    // The cancelled guard skipped the state write (no act warning, no throw).
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

    const { unmount } = renderHook(() => useLegacyPiiDisclosure(true));
    unmount();
    rejecters[0]?.(new Error("late refusal"));
    await Promise.resolve();
    await Promise.resolve();

    expect(rejecters).toHaveLength(1);
  });
});
