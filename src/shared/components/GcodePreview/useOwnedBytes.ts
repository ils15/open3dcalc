import { useEffect, useState } from "react";

/**
 * Max toolpath file size the viewer will accept (50 MB). Matches the upload
 * cap already used by the metadata path (`DEFAULT_MAX_CHARS`), single-sourced
 * here for the *viewer* side so the two guards can't drift.
 */
export const MAX_TOOLPATH_BYTES = 50 * 1024 * 1024;

/**
 * Line-count ceiling. Past this the build geometry is too heavy to be worth
 * previewing interactively; the metadata path still works.
 */
export const MAX_TOOLPATH_LINES = 2_000_000;

/**
 * Loads a `File` into a privately-owned `Uint8Array`.
 *
 * **The footgun this exists for:** chestnut's parser does a *zero-copy* parse —
 * `parse()` transfers the underlying `ArrayBuffer` and **detaches** the
 * `Uint8Array` it was given. Two consequences:
 *
 * 1. A buffer borrowed from a parent and passed straight through is neutered
 *    after the first parse — any other consumer (or a re-parse) hits a
 *    `DataCloneError` on the detached buffer.
 * 2. React `StrictMode` double-mounts and re-runs the parse `useEffect`, so the
 *    same buffer reference is parsed a second time.
 *
 * The fix is exactly one thing: **every consumer takes its own fresh copy**.
 * This hook slices a private copy on every load, so a `StrictMode` remount gets
 * a pristine buffer and the parent's reference is never touched.
 *
 * State shape: only the *async* load result lives in state. The O(1) guards
 * (no file / byte cap) are derived during render — that keeps `setState` out of
 * the effect body (no cascading renders) and means an oversized file is
 * rejected before any I/O or allocation.
 */
export type OwnedBytesStatus =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "ready"; bytes: Uint8Array }
  | { kind: "error"; code: "over-byte-cap" | "over-line-cap" | "read-failed" };

export interface UseOwnedBytesResult {
  bytes: Uint8Array | null;
  status: OwnedBytesStatus;
}

type LoadResult =
  | { kind: "ready"; file: File; bytes: Uint8Array }
  | { kind: "error"; file: File; code: "over-line-cap" | "read-failed" };

export function useOwnedBytes(file: File | null): UseOwnedBytesResult {
  // Only the async outcome is stored, tagged with the file it belongs to so a
  // stale result (file changed / unmounted) is never shown.
  const [load, setLoad] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    file
      .arrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        // FRESH copy per load — this is the whole point of the hook.
        // `new Uint8Array(buffer)` alone would only be a *view* over the same
        // memory; `.slice()` guarantees an independent buffer that chestnut may
        // detach without harming anyone else (or the StrictMode remount).
        const bytes = new Uint8Array(buffer).slice();

        // Line cap on the owned bytes: one cheap pass, still before the viewer
        // mounts, so an over-long file shows an error instead of a stall.
        let lines = 0;
        for (let i = 0; i < bytes.length; i++) {
          if (bytes[i] === 0x0a) {
            lines++;
            if (lines > MAX_TOOLPATH_LINES) break;
          }
        }
        if (lines > MAX_TOOLPATH_LINES) {
          setLoad({ kind: "error", file, code: "over-line-cap" });
          return;
        }

        setLoad({ kind: "ready", file, bytes });
      })
      .catch(() => {
        if (!cancelled) setLoad({ kind: "error", file, code: "read-failed" });
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Derive the public status during render (see the state-shape note above):
  //  - no file → idle
  //  - byte cap is O(1) from `size` → error, before any I/O or allocation
  //  - result belongs to a different file → still reading (stale; effect will
  //    settle; viewer source stays null until the fresh bytes arrive)
  let status: OwnedBytesStatus;
  if (!file) {
    status = { kind: "idle" };
  } else if (file.size > MAX_TOOLPATH_BYTES) {
    status = { kind: "error", code: "over-byte-cap" };
  } else if (load?.file !== file) {
    status = { kind: "reading" };
  } else if (load.kind === "ready") {
    status = { kind: "ready", bytes: load.bytes };
  } else {
    status = { kind: "error", code: load.code };
  }

  return {
    bytes: status.kind === "ready" ? status.bytes : null,
    status,
  };
}
