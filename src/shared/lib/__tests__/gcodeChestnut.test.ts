/**
 * D-CL2 — isolated adapter tests for {@link "../gcodeChestnut"}.
 *
 * The adapter is the ONLY module that touches the (still unstable, DD-001..031
 * churn) @chestnutlabs v0.20 API. These tests pin the three contracts the rest
 * of the codebase will rely on from D-CL4 onward:
 *
 * 1. Byte ownership — the caller keeps its buffer, always (zero-copy transfer
 *    would detach it; the adapter's internal `.slice()` is the contract).
 * 2. Anticipated caps — oversized input is rejected BEFORE a parser is
 *    allocated, with a typed error the UI can branch on.
 * 3. Honest normalization — present fields are mapped, absent fields are
 *    `undefined`, never a fabricated 0 (D-EA6 null-guard pattern).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseGcodeChestnut,
  checkGcodeChestnutCaps,
  GcodeChestnutError,
} from "../gcodeChestnut";
import { DEFAULT_MAX_CHARS, DEFAULT_MAX_LINES } from "../gcodeTotals";

const FIXTURES = join(__dirname, "__fixtures__");
const SPIKE_PATH = join(FIXTURES, "spike-cube.gcode");
const SPIKE_BYTES = new Uint8Array(readFileSync(SPIKE_PATH));

const encoder = new TextEncoder();
const gcode = (text: string): Uint8Array => encoder.encode(text);

/** A byte array of `count` newlines — the cheapest way to trip the line cap. */
const newlines = (count: number): Uint8Array => new Uint8Array(count).fill(10);

describe("[gcodeChestnut] byte ownership contract", () => {
  it("keeps the caller's buffer readable after a parse (no detach)", async () => {
    const bytes = SPIKE_BYTES.slice();
    const byteLengthBefore = bytes.byteLength;
    const firstBefore = bytes[0];

    await parseGcodeChestnut(bytes);

    // A transferred/detached buffer reports byteLength 0; ours must survive.
    expect(bytes.byteLength).toBe(byteLengthBefore);
    expect(bytes[0]).toBe(firstBefore);
  });

  it("survives a StrictMode-style double parse of the same buffer", async () => {
    const bytes = SPIKE_BYTES.slice();
    const byteLengthBefore = bytes.byteLength;

    // React StrictMode mounts/parse twice in a row; each call must get its own
    // copy and the shared source buffer must stay alive for both.
    const first = await parseGcodeChestnut(bytes);
    const second = await parseGcodeChestnut(bytes);

    expect(bytes.byteLength).toBe(byteLengthBefore);
    expect(second.layerCount).toBe(first.layerCount);
    expect(second.segmentCount).toBe(first.segmentCount);
    expect(second.printTimeSeconds).toBe(first.printTimeSeconds);
    expect(second.extrusionDistanceMm).toBe(first.extrusionDistanceMm);
    expect(second.printTimeSecondsKinematic).toBe(
      first.printTimeSecondsKinematic,
    );
  });
});

describe("[gcodeChestnut] anticipated caps (before parser allocation)", () => {
  it("rejects input over the byte cap with a typed too_large error", () => {
    const over = new Uint8Array(DEFAULT_MAX_CHARS + 1);
    expect(() => checkGcodeChestnutCaps(over)).toThrow(GcodeChestnutError);
    expect(() => checkGcodeChestnutCaps(over)).toThrow(/too large|too_large/i);
    try {
      checkGcodeChestnutCaps(over);
    } catch (err) {
      expect(err).toBeInstanceOf(GcodeChestnutError);
      expect((err as GcodeChestnutError).code).toBe("too_large");
      expect((err as GcodeChestnutError).limit).toBe(DEFAULT_MAX_CHARS);
      expect((err as GcodeChestnutError).actual).toBe(DEFAULT_MAX_CHARS + 1);
    }
  });

  it("accepts input exactly at the byte cap (boundary is inclusive)", () => {
    expect(() =>
      checkGcodeChestnutCaps(new Uint8Array(DEFAULT_MAX_CHARS)),
    ).not.toThrow();
  });

  it("rejects input over the line cap with a typed too_many_lines error", () => {
    const over = newlines(DEFAULT_MAX_LINES + 1);
    expect(() => checkGcodeChestnutCaps(over)).toThrow(GcodeChestnutError);
    try {
      checkGcodeChestnutCaps(over);
    } catch (err) {
      expect(err).toBeInstanceOf(GcodeChestnutError);
      expect((err as GcodeChestnutError).code).toBe("too_many_lines");
      expect((err as GcodeChestnutError).limit).toBe(DEFAULT_MAX_LINES);
      expect((err as GcodeChestnutError).actual).toBe(DEFAULT_MAX_LINES + 1);
    }
  });

  it("accepts input exactly at the line cap (boundary is inclusive)", () => {
    expect(() =>
      checkGcodeChestnutCaps(newlines(DEFAULT_MAX_LINES)),
    ).not.toThrow();
  });

  it("enforces the caps end-to-end without consuming the caller's buffer", async () => {
    const bytes = newlines(DEFAULT_MAX_LINES + 1);
    const byteLengthBefore = bytes.byteLength;

    await expect(parseGcodeChestnut(bytes)).rejects.toThrow(GcodeChestnutError);
    await expect(parseGcodeChestnut(bytes)).rejects.toMatchObject({
      code: "too_many_lines",
    });

    // Guard ran before any parse/decode, so the buffer is untouched.
    expect(bytes.byteLength).toBe(byteLengthBefore);
  });
});

describe("[gcodeChestnut] normalization of spike-cube.gcode", () => {
  it("maps the slicer dialect", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    expect(result.dialectIds).toContain("prusaslicer");
    expect(result.units).toBe("mm");
  });

  it("maps slicer-reported filament in all three units", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    // Fixture header: 13.3mm / 8.05cm3 / 9.98g.
    expect(result.filament).toBeDefined();
    expect(result.filament?.lengthMm).toBeCloseTo(13.3, 1);
    expect(result.filament?.volumeCm3).toBeCloseTo(8.05, 2);
    expect(result.filament?.weightG).toBeCloseTo(9.98, 2);
  });

  it("maps the slicer's own print-time estimate", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    // Fixture header: 0h 12m 30s.
    expect(result.printTimeSeconds).toBe(12 * 60 + 30);
  });

  it("derives a kinematic time estimate that bounds the slicer figure below", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    expect(result.printTimeSecondsKinematic).toBeGreaterThan(0);
    // Constant-velocity model under-estimates; every move here carries a
    // feedrate, so the estimate is fully determined (not a lower bound).
    expect(result.kinematicHasUnknownFeedrate).toBe(false);
    expect(result.printTimeSecondsKinematic).toBeLessThan(
      result.printTimeSeconds as number,
    );
  });

  it("counts layers from Z changes (legacy parsers cannot)", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    expect(result.layerCount).toBe(5);
  });

  it("sums extrusion distance from the IR E-channel", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    // Cumulative absolute E goes 2.6607 → 41.0 across the five layers.
    expect(result.extrusionDistanceMm).toBeCloseTo(41, 1);
    expect(result.segmentCount).toBeGreaterThan(0);
  });

  it("maps extrude-only bounds to a size box", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    // Extrude moves span X/Y 0..20 and Z 0.2..1.0.
    const dims = result.bounds?.dimensions;
    expect(dims).toBeDefined();
    expect(dims?.x).toBeCloseTo(20, 3);
    expect(dims?.y).toBeCloseTo(20, 3);
    expect(dims?.z).toBeCloseTo(0.8, 3);
  });

  it("separates travel-inclusive bounds from extrude bounds", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    expect(result.boundsWithTravel).toBeDefined();
    expect(result.boundsWithTravel?.dimensions.z).toBeGreaterThanOrEqual(
      result.bounds?.dimensions.z as number,
    );
  });

  it("reports object bounds as absent when the file carries no object labels", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    // Honest ±Infinity from the IR becomes undefined, never a fake 0-size box.
    expect(result.objectBounds).toBeUndefined();
  });

  it("excludes housekeeping from model bounds via the ;TYPE: roles", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    // The skirt (`;TYPE:skirt`, layer 0) is excludable, so the model box starts
    // at Z 0.4 while the raw extrude box starts at Z 0.2.
    expect(result.modelBounds).toBeDefined();
    expect(result.modelBounds?.min.z).toBeGreaterThan(
      result.bounds?.min.z as number,
    );
    expect(result.modelBounds?.min.z).toBeCloseTo(0.4, 3);
    expect(result.modelBounds?.dimensions.x).toBeCloseTo(20, 3);
  });

  it("exposes byte-accurate source mapping for a future scrub", async () => {
    const result = await parseGcodeChestnut(SPIKE_BYTES);
    expect(result.sourceMap.segmentSrcBytes.length).toBe(result.segmentCount);
    expect(result.sourceMap.byteOffsets.length).toBe(result.segmentCount);
    expect(result.sourceMap.segmentIndices.length).toBe(result.segmentCount);
    expect(result.byteLength).toBe(SPIKE_BYTES.byteLength);
  });
});

describe("[gcodeChestnut] honesty on absent fields (never fabricate)", () => {
  const NO_METADATA = gcode(
    [
      "G1 Z5 F6000",
      ";LAYER:0",
      "G1 X0 Y0 Z0.2 F6000",
      "G1 X10 Y0 E1 F1200",
      "G1 X10 Y10 E2",
      "G1 X0 Y10 E3",
    ].join("\n"),
  );

  it("returns undefined filament and print time when the slicer emits none", async () => {
    const result = await parseGcodeChestnut(NO_METADATA);
    expect(result.filament).toBeUndefined();
    expect(result.printTimeSeconds).toBeUndefined();
    // ...while the derivable kinematic figure is still honest and positive.
    expect(result.printTimeSecondsKinematic).toBeGreaterThan(0);
  });

  it("still reports geometry that does not depend on slicer metadata", async () => {
    const result = await parseGcodeChestnut(NO_METADATA);
    expect(result.layerCount).toBeGreaterThanOrEqual(1);
    expect(result.extrusionDistanceMm).toBeGreaterThan(0);
    expect(result.bounds).toBeDefined();
    expect(result.bounds?.dimensions).toBeDefined();
  });

  it("detects no dialect for a header-less file", async () => {
    const result = await parseGcodeChestnut(NO_METADATA);
    expect(result.dialectIds).toHaveLength(0);
  });

  it("flags a kinematic estimate as approximate when a feedrate is unknown", async () => {
    // First move carries no F: its duration is unknown, so the kinematic total
    // is a lower bound, never a fabricated duration.
    const result = await parseGcodeChestnut(gcode("G1 X10 Y0 E1\n"));
    expect(result.kinematicHasUnknownFeedrate).toBe(true);
  });

  it("yields an honest empty result for empty input", async () => {
    const result = await parseGcodeChestnut(new Uint8Array(0));
    expect(result.layerCount).toBe(0);
    expect(result.segmentCount).toBe(0);
    expect(result.bounds).toBeUndefined();
    expect(result.objectBounds).toBeUndefined();
    expect(result.modelBounds).toBeUndefined();
    expect(result.filament).toBeUndefined();
    expect(result.printTimeSeconds).toBeUndefined();
  });
});
