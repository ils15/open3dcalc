/**
 * Isolated adapter for the @chestnutlabs gcode stack (D-CL2).
 *
 * This is the ONLY module in the codebase that imports the v0.20
 * @chestnutlabs packages. Their API is still churning (DD-001..031), so every
 * upstream upgrade lands here, in one file, and the rest of the app keeps
 * talking to the stable {@link ChestnutParseResult} shape. D-CL4 swaps the
 * legacy `gcodeParser` path onto this adapter without touching consumers.
 *
 * Pure by design: no React, no stores, no UI. The functions here run in the
 * calculator path (and later in a Web Worker, D-CL5), so they may not pull
 * framework code into the bundle.
 *
 * ## Byte ownership — read this before changing anything
 *
 * The chestnutlabs worker path sends input to the parser with
 * `postMessage(msg, [input.buffer])`: a **zero-copy transfer that detaches the
 * caller's ArrayBuffer**. Any later reuse of that buffer throws
 * `DataCloneError` (and silently breaks the caller's copy). The contract this
 * module guarantees is the opposite: **the caller keeps its buffer, always.**
 *
 * The adapter therefore slices a private copy of the incoming bytes before any
 * decode, parse, or hand-off as a parse source, and never retains a reference
 * to a buffer that could be transferred. The sync driver used here does not in
 * fact detach anything, but the slice is what keeps the contract true once the
 * worker driver arrives in D-CL5 — and what lets a caller (a StrictMode
 * remount, a re-queued file) parse the same bytes twice.
 *
 * ## Honesty
 *
 * Slicer metadata follows the library's honesty tiers
 * (`known`/`inferred`/`approximated`/`unavailable`): a field the slicer did not
 * emit is surfaced as `undefined`, never a fabricated 0 (the D-EA6 null-guard
 * pattern the rest of the calculator already uses).
 */
import { parseGcodeToIR } from "@chestnutlabs/gcode-parser";
import {
  createDialectRunner,
  cura,
  ideaMaker,
  orcaBambu,
  prusaSlicer,
  simplify3d,
} from "@chestnutlabs/gcode-dialects";
import { computeToolpathTime } from "@chestnutlabs/toolpath-core";

import { DEFAULT_MAX_CHARS, DEFAULT_MAX_LINES } from "./gcodeTotals";

/** Size/line caps are shared with the legacy parser so both paths agree. */
export {
  DEFAULT_MAX_CHARS as CHESTNUT_MAX_BYTES,
  DEFAULT_MAX_LINES as CHESTNUT_MAX_LINES,
};

export type GcodeChestnutErrorCode =
  /** Input byte length over {@link CHESTNUT_MAX_BYTES}. */
  | "too_large"
  /** Newline count over {@link CHESTNUT_MAX_LINES}. */
  | "too_many_lines"
  /** The parse core raised an unexpected error. */
  | "parse_failed";

/**
 * Typed adapter error. `code` is the machine-readable reason a UI can branch
 * on; `limit`/`actual` carry the numbers for a friendly message.
 */
export class GcodeChestnutError extends Error {
  readonly code: GcodeChestnutErrorCode;
  readonly limit: number;
  readonly actual: number;

  constructor(
    code: GcodeChestnutErrorCode,
    message: string,
    limit: number,
    actual: number,
  ) {
    super(message);
    this.name = "GcodeChestnutError";
    this.code = code;
    this.limit = limit;
    this.actual = actual;
  }
}

/** Axis-aligned point, isomorphic to the legacy {@link GcodeBoundsResult}. */
export interface ChestnutVec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned box in G-code coordinates. */
export interface ChestnutBounds {
  min: ChestnutVec3;
  max: ChestnutVec3;
  /** Pre-computed width/depth/height in mm. */
  dimensions: ChestnutDimensions;
}

export interface ChestnutDimensions {
  x: number;
  y: number;
  z: number;
}

/** Slicer-reported filament consumption; each unit is independently optional. */
export interface ChestnutFilament {
  lengthMm?: number;
  volumeCm3?: number;
  weightG?: number;
}

/**
 * How trustworthy an optional datum is. Mirrors the library's own tiers so a
 * consumer can disclose an estimate instead of presenting it as fact.
 */
export type ChestnutConfidence =
  "known" | "inferred" | "approximated" | "unavailable";

export interface ChestnutDialect {
  id: string;
  confidence: ChestnutConfidence;
}

/**
 * Byte→segment source mapping, held as views over the parse result's own
 * arrays (allocated by the parser, not the caller's input). Powers the
 * D-CL6 scrub.
 */
export interface ChestnutSourceMap {
  /** Byte offset of the command that produced each segment. */
  segmentSrcBytes: Uint32Array;
  /** Sorted byte offsets for a byte→segment binary search. */
  byteOffsets: Uint32Array;
  segmentIndices: Uint32Array;
}

/**
 * Normalized parse result. Deliberately free of `three`/React types so it can
 * flow through the calculator path and worker boundary; D-CL4 maps it onto the
 * store's shapes. Every optional field means "the slicer did not report it".
 */
export interface ChestnutParseResult {
  /** Bytes actually parsed (guard rejects oversized input before this). */
  byteLength: number;
  lineCount: number;
  /** Motion segments; 0 for an empty file. */
  segmentCount: number;
  /** Layers detected from Z changes — data the legacy parser cannot produce. */
  layerCount: number;
  /** Total extrusion distance in mm (the E-sum). */
  extrusionDistanceMm: number;
  /** Slicer-reported filament usage, `undefined` when the slicer emits none. */
  filament: ChestnutFilament | undefined;
  /** The slicer's own print-time estimate in seconds, `undefined` if absent. */
  printTimeSeconds: number | undefined;
  /**
   * Kinematic estimate (segment length / feedrate) in seconds. Always
   * derivable from geometry; a *lower bound* when
   * {@link kinematicHasUnknownFeedrate} is set.
   */
  printTimeSecondsKinematic: number;
  kinematicHasUnknownFeedrate: boolean;
  /** Bounds over extruding moves only; `undefined` when nothing was extruded. */
  bounds: ChestnutBounds | undefined;
  /** Bounds including travel moves. */
  boundsWithTravel: ChestnutBounds | undefined;
  /**
   * Bounds over the extrusion of labeled objects (`object != 0`), excluding
   * skirt/prime/purge. `undefined` when the file carries no object labels.
   */
  objectBounds: ChestnutBounds | undefined;
  /**
   * Bounds over the printed model — excludes housekeeping (skirt, brim, raft,
   * support, prime/wipe tower, purge). `undefined` when the model is
   * unknowable (no object membership and nothing excludable): an honest
   * "cannot classify", never a guess. Framing precedence is
   * modelBounds → objectBounds → bounds.
   */
  modelBounds: ChestnutBounds | undefined;
  /** Detected slicer/firmware dialects with their confidence tier. */
  dialects: ChestnutDialect[];
  /** Convenience accessor over {@link ChestnutParseResult.dialects}. */
  dialectIds: string[];
  units: "mm" | "in";
  /** False when the parse core stopped early on an internal limit. */
  complete: boolean;
  /** Internal stop reason code when {@link complete} is false. */
  stopReasonCode: string | undefined;
  sourceMap: ChestnutSourceMap;
}

/** Dialect window sizes the runner samples for detection (head/tail). */
const HEAD_BYTES = 64 * 1024;
const TAIL_BYTES = 16 * 1024;

const decoder = new TextDecoder();

/**
 * Slicer adapters that emit filament/time metadata. Registered once and reused
 * per parse: `createRun` is the per-file stateful part. Firmware/CNC adapters
 * are deliberately absent — they add no calculator data and can be registered
 * here later without touching any other file.
 */
const dialectRunner = createDialectRunner([
  prusaSlicer(),
  orcaBambu(),
  cura(),
  ideaMaker(),
  simplify3d(),
]);

/** Count newlines in a single cheap pass (no allocation, no detach). */
function countNewlines(bytes: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 10) count += 1;
  }
  return count;
}

/**
 * Reject oversized input BEFORE a parser, decoder, or dialect run is
 * allocated. Boundaries are inclusive: exactly the cap is allowed. Reads the
 * caller's buffer (safe — scanning never transfers), so a rejection costs one
 * cheap pass, not a copy.
 *
 * @throws {GcodeChestnutError} `too_large` or `too_many_lines`.
 */
export function checkGcodeChestnutCaps(bytes: Uint8Array): void {
  if (bytes.length > DEFAULT_MAX_CHARS) {
    throw new GcodeChestnutError(
      "too_large",
      `G-code too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB, limit ${(
        DEFAULT_MAX_CHARS /
        1024 /
        1024
      ).toFixed(0)} MB). Upload a smaller snippet.`,
      DEFAULT_MAX_CHARS,
      bytes.length,
    );
  }
  const lines = countNewlines(bytes);
  if (lines > DEFAULT_MAX_LINES) {
    throw new GcodeChestnutError(
      "too_many_lines",
      `G-code has too many lines (${lines.toLocaleString("en-US")}, limit ${DEFAULT_MAX_LINES.toLocaleString(
        "en-US",
      )}). Upload a smaller snippet.`,
      DEFAULT_MAX_LINES,
      lines,
    );
  }
}

/**
 * Convert an IR bounds box, rejecting the library's empty sentinel
 * (±Infinity) as `undefined` rather than a fake 0-size box.
 */
function normalizeBounds(bounds: {
  min: ChestnutVec3;
  max: ChestnutVec3;
}): ChestnutBounds | undefined {
  const { min, max } = bounds;
  if (
    !Number.isFinite(min.x) ||
    !Number.isFinite(min.y) ||
    !Number.isFinite(min.z) ||
    !Number.isFinite(max.x) ||
    !Number.isFinite(max.y) ||
    !Number.isFinite(max.z)
  ) {
    return undefined;
  }
  return {
    min,
    max,
    dimensions: {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    },
  };
}

/**
 * Parse G-code bytes into the stable {@link ChestnutParseResult}.
 *
 * The caller keeps ownership of `bytes`: a private copy is made before any
 * decode or parse, so a transferred/detached buffer can never escape this
 * module, and the same bytes may be parsed repeatedly (StrictMode remount,
 * re-queue).
 */
export async function parseGcodeChestnut(
  bytes: Uint8Array,
): Promise<ChestnutParseResult> {
  checkGcodeChestnutCaps(bytes);

  // Defensive copy — see the byte-ownership note at the top of this file.
  const copy = bytes.slice();
  const text = decoder.decode(copy);

  const run = dialectRunner.createRun({
    selection: "auto",
    headText: text.slice(0, HEAD_BYTES),
    tailText: text.slice(-TAIL_BYTES),
  });

  let parsed;
  try {
    parsed =
      run === null
        ? parseGcodeToIR(text)
        : parseGcodeToIR(text, {
            onComment: (commentText, srcByte) =>
              run.onComment(commentText, srcByte),
            onCommand: (event) => run.onCommand(event),
          });
  } catch (err) {
    throw new GcodeChestnutError(
      "parse_failed",
      `Failed to parse G-code: ${err instanceof Error ? err.message : String(err)}`,
      0,
      copy.length,
    );
  }

  const { ir, stats } = parsed;
  const meta = run === null ? undefined : run.finalize(ir).metadata;
  const filament = meta?.filamentUsage;
  const time = computeToolpathTime(ir);

  return {
    byteLength: stats.bytes,
    lineCount: stats.lines,
    segmentCount: stats.segments,
    layerCount: ir.layers.length,
    extrusionDistanceMm: stats.extrusionDistance,
    filament: filament
      ? {
          lengthMm: filament.lengthMm,
          volumeCm3: filament.volumeCm3,
          weightG: filament.weightG,
        }
      : undefined,
    printTimeSeconds: meta?.printEstimate?.seconds,
    printTimeSecondsKinematic: time.totalMs / 1000,
    kinematicHasUnknownFeedrate: time.hasUnknownFeedrate,
    bounds: normalizeBounds(ir.bounds),
    boundsWithTravel: normalizeBounds(ir.boundsWithTravel),
    objectBounds: normalizeBounds(ir.objectBounds),
    modelBounds: normalizeBounds(ir.modelBounds),
    dialects:
      run === null
        ? []
        : run.detections.map((d) => ({
            id: d.dialectId,
            confidence: d.confidence,
          })),
    dialectIds: run === null ? [] : run.detections.map((d) => d.dialectId),
    units: ir.header.units,
    complete: ir.header.complete,
    stopReasonCode: stats.stopReason?.code,
    sourceMap: {
      segmentSrcBytes: ir.segments.srcByte,
      byteOffsets: ir.sourceIndex.byteOffsets,
      segmentIndices: ir.sourceIndex.segmentIndices,
    },
  };
}
