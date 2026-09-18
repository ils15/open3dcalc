import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GcodePreview } from "@chestnutlabs/gcode-preview-react";
import type { GcodePreviewHandle } from "@chestnutlabs/gcode-preview-react";
import { GcodePreviewPanel } from "../GcodePreviewPanel";
import { LazyGcodePreviewPanel } from "../index";
import { MAX_TOOLPATH_BYTES, MAX_TOOLPATH_LINES } from "../useOwnedBytes";

// The fixture is a real PrusaSlicer G-code, so the panel walks its real happy
// path (read → slice → line guard ok → viewer mounts).
const FIXTURE = readFileSync(
  resolve(__dirname, "../../../lib/__tests__/__fixtures__/spike-cube.gcode"),
  "utf-8",
);

const fixtureFile = () =>
  new File([FIXTURE], "spike-cube.gcode", { type: "text/plain" });

const MOCK_CANVAS = "gcode-preview-canvas";

// --- mock of @chestnutlabs/gcode-preview-react --------------------------------
// Mirrors the StlPreview test strategy: R3F/WebGL doesn't run in jsdom, so the
// viewer is replaced with a DOM stand-in that mirrors props onto data-* and
// exposes the imperative handle the toolbar needs (controls.frame).
//
// The stand-in ALSO simulates the engine's zero-copy parse contract: parsing a
// `Uint8Array` transfers (and detaches) its underlying ArrayBuffer, so a second
// parse of the same view throws. This is the exact footgun `useOwnedBytes` +
// the File-as-source decision exist to dodge, so the mock has to be faithful
// about it or the StrictMode test below proves nothing.
const {
  mockControls,
  detachedBuffers,
  capturedSources,
  simulateParseTransfer,
} = vi.hoisted(() => ({
  mockControls: { frame: vi.fn() },
  // Tracks buffers the simulated parser already transferred.
  detachedBuffers: new WeakSet<ArrayBufferLike>(),
  // Every `source` handed to the viewer, so a test can prove it was always a
  // cloneable File and never a borrowed/detached view.
  capturedSources: [] as unknown[],

  // Stand-in for `session.js: postMessage(msg, [input.buffer])`. A Uint8Array
  // detaches its buffer on the first parse and throws on any reuse; a File is a
  // cloneable handle, never in the transfer list, so it re-parses fresh forever.
  simulateParseTransfer: (source: unknown): void => {
    if (!(source instanceof Uint8Array)) return;
    const buffer = source.buffer;
    if (detachedBuffers.has(buffer)) {
      // Named for the DOM exception the real transfer raises; `DataCloneError`
      // isn't in the app tsconfig's lib, so the name is set on a plain Error.
      throw Object.assign(
        new Error("Cannot transfer a detached ArrayBuffer (DataCloneError)"),
        { name: "DataCloneError" },
      );
    }
    detachedBuffers.add(buffer);
  },
}));

interface MockGcodePreviewProps {
  source?: unknown;
  onStage?: (e: { stage: string; progress?: number | null }) => void;
  onParseProgress?: (p: { bytesProcessed: number; totalBytes: number }) => void;
  onParseError?: (e: { code: string; message: string }) => void;
  onError?: (e: unknown) => void;
  onReady?: (summary: unknown) => void;
}

vi.mock("@chestnutlabs/gcode-preview-react", async () => {
  const { forwardRef, useImperativeHandle, useEffect } = await import("react");
  return {
    GcodePreview: forwardRef<GcodePreviewHandle | null, MockGcodePreviewProps>(
      function GcodePreview(props, ref) {
        capturedSources.push(props.source);
        useImperativeHandle(
          ref,
          () =>
            ({
              controls: mockControls,
            }) as unknown as GcodePreviewHandle,
        );

        useEffect(() => {
          // The zero-copy contract. A no-op for File sources (the only kind the
          // panel ever passes), a throw for a reused Uint8Array view.
          simulateParseTransfer(props.source);

          // "corrupt" files exercise the engine's failure path.
          const source = props.source;
          if (source instanceof File && source.name.includes("corrupt")) {
            props.onParseError?.({
              code: "invalid-gcode",
              message: "mock: unreadable",
            });
            return;
          }

          // Drive the staged-progress contract so the loading overlay clears and
          // the toolbar becomes the topmost element (as in production).
          props.onStage?.({ stage: "ready", progress: 1 });
          props.onReady?.({
            segments: 1,
            layers: 1,
            complete: true,
          });
        });

        const kind =
          props.source instanceof File
            ? "file"
            : props.source instanceof Uint8Array
              ? "uint8array"
              : "other";
        return (
          <canvas
            data-testid={MOCK_CANVAS}
            data-source-kind={kind}
            data-stage="ready"
          />
        );
      },
    ),
  };
});

describe("GcodePreviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSources.length = 0;
  });

  it("renders the viewer canvas for a real G-code fixture", async () => {
    render(<GcodePreviewPanel file={fixtureFile()} />);

    const canvas = await screen.findByTestId(MOCK_CANVAS);
    expect(canvas).toBeInTheDocument();
    // The panel loads the file itself; the viewer receives a cloneable File,
    // never a borrowed buffer.
    expect(canvas).toHaveAttribute("data-source-kind", "file");
    expect(capturedSources[0]).toBeInstanceOf(File);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("frames the toolpath through the imperative handle", async () => {
    const user = userEvent.setup();
    render(<GcodePreviewPanel file={fixtureFile()} />);

    await waitFor(() =>
      expect(screen.getByTestId(MOCK_CANVAS)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "gcodePreview.fit" }));
    expect(mockControls.frame).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the toolbar close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GcodePreviewPanel file={fixtureFile()} onClose={onClose} />);

    await waitFor(() =>
      expect(screen.getByTestId(MOCK_CANVAS)).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: "gcodePreview.close" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state when no file is provided", () => {
    render(<GcodePreviewPanel file={null} />);
    expect(screen.getByText("gcodePreview.emptyTitle")).toBeInTheDocument();
  });

  it("shows a too-many-lines alert (no crash) past the line cap", async () => {
    // Line guard, not the 50 MB byte guard: MAX_TOOLPATH_LINES newlines is a
    // few MB in memory and the scan short-circuits the instant it crosses the
    // cap, so this costs a fraction of a real >50 MB File.
    const over = "a\n".repeat(MAX_TOOLPATH_LINES + 1);
    const file = new File([over], "huge.gcode", { type: "text/plain" });

    render(<GcodePreviewPanel file={file} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("gcodePreview.tooManyLines");
    // The viewer never spun up for a rejected file.
    expect(screen.queryByTestId(MOCK_CANVAS)).not.toBeInTheDocument();
  });

  it("shows a too-large alert for a file over the byte cap", () => {
    // O(1): the guard reads `size` before any I/O, so the size is shadowed
    // instead of really allocating 50 MB.
    const file = new File(["G1 X0"], "big.gcode", { type: "text/plain" });
    Object.defineProperty(file, "size", {
      configurable: true,
      value: MAX_TOOLPATH_BYTES + 1,
    });

    render(<GcodePreviewPanel file={file} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "gcodePreview.tooLarge",
    );
  });

  it("shows a read-failed alert when the file can't be read", async () => {
    const file = new File(["G1 X0"], "unreadable.gcode", {
      type: "text/plain",
    });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("disk on fire")),
    });

    render(<GcodePreviewPanel file={file} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "gcodePreview.readFailed",
    );
  });

  it("shows a parse-error alert when the engine rejects the G-code", async () => {
    const file = new File([FIXTURE], "corrupt.gcode", {
      type: "text/plain",
    });

    render(<GcodePreviewPanel file={file} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "gcodePreview.parseError",
    );
  });

  // --- the design decision, as a test ----------------------------------------
  // The panel hands the viewer a `File`, and a File is a cloneable handle that
  // is never in a transfer list — every parse re-reads it fresh, so a remount
  // re-parse can't hit a detached buffer. This is the proof.
  describe("StrictMode — source is a File, never a detached buffer", () => {
    it("survives a double mount/remount without DataCloneError", async () => {
      const file = fixtureFile();
      const { rerender } = render(
        <StrictMode>
          <GcodePreviewPanel file={file} onClose={vi.fn()} />
        </StrictMode>,
      );

      await waitFor(() =>
        expect(screen.getByTestId(MOCK_CANVAS)).toBeInTheDocument(),
      );

      // Unmount the viewer (idle), then remount and re-parse the same file —
      // the second parse must be as fresh as the first.
      rerender(
        <StrictMode>
          <GcodePreviewPanel file={null} onClose={vi.fn()} />
        </StrictMode>,
      );
      rerender(
        <StrictMode>
          <GcodePreviewPanel file={file} onClose={vi.fn()} />
        </StrictMode>,
      );

      await waitFor(() =>
        expect(screen.getByTestId(MOCK_CANVAS)).toBeInTheDocument(),
      );

      // The viewer parsed the same file at least twice and every source it saw
      // was a cloneable File — no buffer was ever transferred/detached.
      expect(capturedSources.length).toBeGreaterThanOrEqual(2);
      for (const source of capturedSources) {
        expect(source).toBeInstanceOf(File);
      }
    });

    it("would reject a reused Uint8Array — the guard is not vacuous", () => {
      // First parse detaches, second reuse throws: the exact failure mode the
      // File-as-source decision rules out. A File re-parses any number of times.
      const bytes = new Uint8Array([1, 2, 3]);
      expect(() => simulateParseTransfer(bytes)).not.toThrow();
      expect(() => simulateParseTransfer(bytes)).toThrow(/detached/i);

      const file = new File([bytes], "cloneable.gcode", {
        type: "text/plain",
      });
      expect(() => simulateParseTransfer(file)).not.toThrow();
      expect(() => simulateParseTransfer(file)).not.toThrow();

      // And the React stand-in agrees: a Uint8Array source blows up on the
      // StrictMode double-parse, a File source does not.
      expect(() =>
        render(
          <StrictMode>
            <GcodePreview source={new Uint8Array([1, 2, 3])} />
          </StrictMode>,
        ),
      ).toThrow();
    });
  });

  it("exports the panel as a React.lazy boundary", () => {
    // Code-split: an OFF build or a user that never opens the viewer pays
    // nothing for the chestnut stack.
    expect(LazyGcodePreviewPanel.$$typeof).toBe(Symbol.for("react.lazy"));
  });
});
