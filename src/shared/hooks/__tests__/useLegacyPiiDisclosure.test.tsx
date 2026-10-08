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

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

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

  it("does not inspect Stable residue on the web", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current).toEqual({
      status: "unavailable",
      reason: "legacy_inspection_retired",
    });
    expect(getItem).not.toHaveBeenCalled();
  });

  it("does not invoke desktop IPC or disclose a legacy report", async () => {
    const legacyRows = vi.fn(async () => ({
      scannedAt: new Date().toISOString(),
      rows: [
        {
          key: "open3dcalc_customers_v1",
          value: JSON.stringify({ state: { customers: [{ id: "a" }] } }),
          status: "legacy_plaintext",
        },
      ],
    }));
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };

    const { result } = renderHook(() => useLegacyPiiDisclosure(true));

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current).toEqual({
      status: "unavailable",
      reason: "legacy_inspection_retired",
    });
    expect(legacyRows).not.toHaveBeenCalled();
  });

  it("does not start a retired read that could resolve after unmount", async () => {
    const legacyRows = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };

    const { unmount } = renderHook(() => useLegacyPiiDisclosure(true));
    unmount();
    await Promise.resolve();
    await Promise.resolve();

    expect(legacyRows).not.toHaveBeenCalled();
  });
});
