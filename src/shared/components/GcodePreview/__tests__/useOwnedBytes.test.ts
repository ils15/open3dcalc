import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import {
  useOwnedBytes,
  MAX_TOOLPATH_BYTES,
  MAX_TOOLPATH_LINES,
} from "../useOwnedBytes";

function makeFile(content: string, name = "test.gcode"): File {
  return new File([content], name, { type: "text/plain" });
}

describe("useOwnedBytes", () => {
  it("loads a file into a privately-owned Uint8Array", async () => {
    const content = "G1 X0 Y0\nG1 X10\n";
    const file = makeFile(content);

    const { result } = renderHook(() => useOwnedBytes(file));

    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
    expect(result.current.status.kind).toBe("ready");
    if (result.current.status.kind !== "ready") return;
    expect(result.current.bytes).toBeInstanceOf(Uint8Array);
    expect(result.current.bytes).toBe(result.current.status.bytes);
    expect(result.current.status.bytes.length).toBe(content.length);
    expect(Array.from(result.current.status.bytes)).toEqual(
      Array.from(new TextEncoder().encode(content)),
    );
  });

  it("returns idle when there is no file", () => {
    const { result } = renderHook(() => useOwnedBytes(null));
    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.bytes).toBeNull();
  });

  it("rejects a file over the byte cap before any I/O (O(1))", () => {
    // The guard reads `file.size` during render, so the size is shadowed
    // rather than really allocating 50 MB.
    const file = makeFile("G1 X0");
    Object.defineProperty(file, "size", {
      configurable: true,
      value: MAX_TOOLPATH_BYTES + 1,
    });

    const { result } = renderHook(() => useOwnedBytes(file));
    expect(result.current.status).toEqual({
      kind: "error",
      code: "over-byte-cap",
    });
    expect(result.current.bytes).toBeNull();
  });

  it("rejects a file over the line cap", async () => {
    // Line guard, not the byte guard: MAX_TOOLPATH_LINES newlines is a few MB
    // in memory and the scan short-circuits the moment it crosses the cap.
    const over = "a\n".repeat(MAX_TOOLPATH_LINES + 1);
    const file = new File([over], "huge.gcode", { type: "text/plain" });

    const { result } = renderHook(() => useOwnedBytes(file));
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: "error",
        code: "over-line-cap",
      }),
    );
    expect(result.current.bytes).toBeNull();
  });

  it("reports a read failure when arrayBuffer() rejects", async () => {
    const file = makeFile("G1 X0", "broken.gcode");
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("unreadable")),
    });

    const { result } = renderHook(() => useOwnedBytes(file));
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: "error",
        code: "read-failed",
      }),
    );
  });

  it("discards a result that belongs to a previous file", async () => {
    // The previous file's load is deferred so it settles *after* the file has
    // already been swapped — a stale result must never surface.
    let settlePrev: (buffer: ArrayBuffer) => void = () => {
      /* assigned on first call */
    };
    const prevFile = makeFile("G1 X0\n", "prev.gcode");
    Object.defineProperty(prevFile, "arrayBuffer", {
      configurable: true,
      value: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            settlePrev = resolve;
          }),
      ),
    });
    // The current file's load stays pending, so the *only* thing that could
    // flip the status is the stale result — isolating the behaviour.
    const currentFile = makeFile("G1 X1\n", "current.gcode");
    Object.defineProperty(currentFile, "arrayBuffer", {
      configurable: true,
      value: vi.fn(() => new Promise<ArrayBuffer>(() => {})),
    });

    const { result, rerender } = renderHook(
      ({ f }: { f: File | null }) => useOwnedBytes(f),
      { initialProps: { f: prevFile } },
    );
    expect(result.current.status.kind).toBe("reading");

    rerender({ f: currentFile });
    expect(result.current.status.kind).toBe("reading");

    // prevFile settles late.
    await act(async () => {
      settlePrev(new TextEncoder().encode("G1 X0\n").buffer);
    });

    // Still reading the current file — the stale bytes were dropped.
    expect(result.current.status.kind).toBe("reading");
    expect(result.current.bytes).toBeNull();

    // Going back to the previous file must reload it: a leaked result would
    // otherwise surface as immediately "ready" with the old bytes.
    rerender({ f: prevFile });
    expect(result.current.status.kind).toBe("reading");
    expect(result.current.bytes).toBeNull();
  });
});
