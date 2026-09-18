import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  capturedLayerRanges,
  simulateParseTransfer,
} = vi.hoisted(() => ({
  mockControls: { frame: vi.fn(), setLayerRange: vi.fn() },
  // Tracks buffers the simulated parser already transferred.
  detachedBuffers: new WeakSet<ArrayBufferLike>(),
  // Every `source` handed to the viewer, so a test can prove it was always a
  // cloneable File and never a borrowed/detached view.
  capturedSources: [] as unknown[],
  // Every `layerRange` prop handed to the viewer, so a test can prove slider
  // motion reaches the engine's layer-clip API.
  capturedLayerRanges: [] as ([number, number] | null | undefined)[],
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
  // D-CL6: the engine's declarative layer clip; the component's own effect
  // forwards this to `controls.setLayerRange`, which the mock mirrors.
  layerRange?: [number, number] | null;
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
        capturedLayerRanges.push(props.layerRange);
        useImperativeHandle(
          ref,
          () =>
            ({
              controls: mockControls,
            }) as unknown as GcodePreviewHandle,
        );

        useEffect(() => {
          // Faithful mirror of the engine's own prop→control wiring
          // (gcode-preview-component.js: layerRange effect → setLayerRange):
          // null/undefined shows every layer, a tuple is inclusive [start, end].
          const range = props.layerRange;
          if (range === null || range === undefined) {
            mockControls.setLayerRange(0, Number.POSITIVE_INFINITY);
          } else {
            mockControls.setLayerRange(range[0], range[1]);
          }
        }, [props.layerRange]);

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
          // The engine's onReady summary carries its Z-change layer count. The
          // fixture really has 5 layers (verified against the adapter), so the
          // mock reports the same number the real engine would.
          props.onReady?.({
            segments: 24,
            layers: 5,
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
    capturedLayerRanges.length = 0;
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

  // --- D-CL6: real layer slider + object dimensions -------------------------
  //
  // jsdom does not implement the browser's native arrow-key stepping on
  // <input type="range"> (the value never moves on keydown), so the helper
  // below synthesizes the translation a real browser performs: keydown →
  // step → change. It proves the panel's wiring reaches the engine's clip API
  // from a keyboard event; the stepping itself is the platform's guarantee
  // (native range controls are keyboard-operable by the WAI-ARIA authoring
  // practice), not something this app reimplements.
  const stepSlider = async (
    slider: HTMLElement,
    key: "ArrowDown" | "ArrowUp" | "ArrowLeft" | "ArrowRight",
  ): Promise<void> => {
    const input = slider as HTMLInputElement;
    const delta = key === "ArrowDown" || key === "ArrowLeft" ? -1 : 1;
    fireEvent.keyDown(input, { key });
    fireEvent.change(input, {
      target: { value: String(Number(input.value) + delta) },
    });
  };

  describe("layer slider", () => {
    it("scales to the engine-reported layer count", async () => {
      render(<GcodePreviewPanel file={fixtureFile()} />);

      const slider = await screen.findByRole("slider", {
        name: "gcodePreview.layerSliderLabel",
      });
      // The fixture's real Z-change layer count is 5 (verified via the
      // adapter), so the engine's onReady reports layers=5 and the slider's
      // scale is 0..4 — never 0..0 or an unbounded input.
      expect(slider).toHaveAttribute("min", "0");
      expect(slider).toHaveAttribute("max", "4");
      expect(slider).toHaveAttribute("step", "1");
    });

    it("clips the toolpath through the engine's layer-range API", async () => {
      render(<GcodePreviewPanel file={fixtureFile()} />);

      const slider = await screen.findByRole("slider", {
        name: "gcodePreview.layerSliderLabel",
      });

      // Initial settle: the panel defaults to the full build, so the engine is
      // told the inclusive full range once the viewer mounts.
      await waitFor(() =>
        expect(mockControls.setLayerRange).toHaveBeenCalledWith(0, 4),
      );

      await stepSlider(slider, "ArrowLeft");

      // Scrubbing one layer down must reach the engine's clip API as
      // [0, 3] — a draw-range update, not a re-parse (no new source is read).
      await waitFor(() =>
        expect(mockControls.setLayerRange).toHaveBeenCalledWith(0, 3),
      );
      expect(capturedLayerRanges.at(-1)).toEqual([0, 3]);
    });

    it("announces the layer position for screen readers", async () => {
      render(<GcodePreviewPanel file={fixtureFile()} />);

      const slider = await screen.findByRole("slider", {
        name: "gcodePreview.layerSliderLabel",
      });
      // aria-valuetext carries the human-readable "Layer N of M" (the raw key
      // here — the suite runs without an i18n provider, like the other tests),
      // so a screen reader announces position, not a bare index.
      expect(slider).toHaveAttribute(
        "aria-valuetext",
        "gcodePreview.layerValue",
      );
      // The live region next to the label mirrors the same announcement.
      expect(screen.getByText("gcodePreview.layerValue")).toBeInTheDocument();
    });

    it("is reachable by Tab and drivable by arrow keys", async () => {
      const user = userEvent.setup();
      render(<GcodePreviewPanel file={fixtureFile()} />);

      const slider = await screen.findByRole("slider", {
        name: "gcodePreview.layerSliderLabel",
      });

      // Keyboard reachability: Tab moves focus onto the control.
      await user.tab();
      expect(slider).toHaveFocus();

      // Each arrow press moves exactly one layer and reaches the engine's
      // clip API (the keydown→change sequence a browser performs natively;
      // jsdom does not step range values on keydown itself).
      mockControls.setLayerRange.mockClear();
      await stepSlider(slider, "ArrowDown");
      await waitFor(() =>
        expect(mockControls.setLayerRange).toHaveBeenLastCalledWith(0, 3),
      );
      await stepSlider(slider, "ArrowDown");
      await waitFor(() =>
        expect(mockControls.setLayerRange).toHaveBeenLastCalledWith(0, 2),
      );
    });
  });

  describe("object dimensions", () => {
    it("shows the fixture's real dimensions from the adapter pass", async () => {
      render(<GcodePreviewPanel file={fixtureFile()} />);

      // The parallel adapter pass resolves over the real spike-cube: modelBounds
      // 20 × 20 × 0.6 mm (verified against parseGcodeChestnut). One decimal,
      // matching the calculator's dimension formatting.
      expect(
        await screen.findByText("gcodePreview.objectDimensions"),
      ).toBeInTheDocument();
      const chip = screen.getByText("20.0 × 20.0 × 0.6 mm");
      expect(chip).toBeInTheDocument();
    });

    it("renders an em-dash, never zeros, when bounds are unmeasurable", async () => {
      // A G-code with no extrusion and no object labels: the adapter's
      // normalizeBounds rejects the engine's ±Infinity sentinel as undefined,
      // which the chip must show as `—` — not 0.0 × 0.0 × 0.0, not NaN.
      const empty = new File(
        ["G28 ; home\n", "M84 ; disable motors\n"],
        "empty.gcode",
        {
          type: "text/plain",
        },
      );

      render(<GcodePreviewPanel file={empty} />);

      const chip = await screen.findByText("gcodePreview.objectDimensions: —");
      expect(chip).toBeInTheDocument();
      // The unmeasurable case carries an explanatory tooltip.
      expect(chip.closest("[title]")).toHaveAttribute(
        "title",
        "gcodePreview.dimensionsUnavailable",
      );
    });
  });
});
