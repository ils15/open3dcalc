/**
 * Fixture tests for the @chestnutlabs/gcode-preview integration (D-CL1).
 *
 * Viability evidence promoted from the throwaway spike: can the library surface
 * the numbers the Open3DCalc calculator needs, and do they agree with what our
 * own parsers produce today? Kept as a permanent regression fixture for the
 * pinned dependency set.
 *
 * The @chestnutlabs packages are declared as direct dependencies (parser,
 * dialects, toolpath-core, model-renderer) so these imports never rely on
 * transitive hoisting. `three` is pinned to 0.185.1 via npm `overrides`, which is
 * what makes the peer range of gcode-model-renderer (@^0.178.0) resolve cleanly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGcodeToIR } from "@chestnutlabs/gcode-parser";
import { createDialectRunner, prusaSlicer } from "@chestnutlabs/gcode-dialects";
import { computeToolpathTime } from "@chestnutlabs/toolpath-core";
import { parseStl } from "@chestnutlabs/gcode-model-renderer";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { meshVolumeMm3, boundsSizeMm } from "./meshVolume";

const FIXTURES = join(__dirname, "__fixtures__");
const GCODE = readFileSync(join(FIXTURES, "spike-cube.gcode"), "utf8");
const STL_PATH = join(FIXTURES, "spike-cube.stl");
const STL_BYTES = new Uint8Array(readFileSync(STL_PATH));

describe("[chestnut] gcode → calculator data", () => {
  const runner = createDialectRunner([prusaSlicer()]);
  const run = runner.createRun({
    selection: "auto",
    headText: GCODE.slice(0, 64 * 1024),
    tailText: GCODE.slice(-16 * 1024),
  });
  expect(run).not.toBeNull();
  const dialectRun = run!;

  const result = parseGcodeToIR(GCODE, {
    onComment: (text, srcByte) => dialectRun.onComment(text, srcByte),
  });
  const { ir, stats } = result;
  const dialect = dialectRun.finalize(ir);
  const meta = dialect.metadata;

  it("detects the PrusaSlicer dialect", () => {
    expect(meta?.dialects?.[0]?.dialectId).toBe("prusaslicer");
  });

  it("exposes slicer-reported filament usage (length / volume / weight)", () => {
    expect(meta).toBeDefined();
    const usage = meta!.filamentUsage;
    expect(usage).toBeDefined();
    // Fixture comments: ; filament used [mm] = 13.3 / [cm3] = 8.05 / [g] = 9.98
    expect(usage!.lengthMm).toBeCloseTo(13.3, 1);
    expect(usage!.volumeCm3).toBeCloseTo(8.05, 2);
    expect(usage!.weightG).toBeCloseTo(9.98, 2);
  });

  it("exposes the slicer's own print-time estimate", () => {
    expect(meta).toBeDefined();
    const est = meta!.printEstimate;
    expect(est).toBeDefined();
    // Fixture comment: 0h 12m 30s
    expect(est!.seconds).toBe(12 * 60 + 30);
  });

  it("counts layers from Z changes (our parsers cannot today)", () => {
    expect(ir.layers.length).toBe(5);
  });

  it("sums extrusion distance from the IR (parity with our E-sum)", () => {
    expect(stats.extrusionDistance).toBeGreaterThan(0);
    // Independent E-sum over the per-segment channel.
    let eSum = 0;
    for (let i = 0; i < ir.segments.count; i++) eSum += ir.segments.e[i];
    expect(eSum).toBeCloseTo(stats.extrusionDistance, 4);
  });

  it("computes an extrusion-only toolhead bounding box", () => {
    const size = boundsSizeMm(ir.bounds.min, ir.bounds.max);
    // Fixture extrude moves span X/Y 0..20 and Z 0.2..1.0.
    expect(size.x).toBeCloseTo(20, 3);
    expect(size.y).toBeCloseTo(20, 3);
    expect(size.z).toBeCloseTo(0.8, 3);
  });

  it("separates model bounds from travel-inclusive bounds", () => {
    const extrude = boundsSizeMm(ir.bounds.min, ir.bounds.max);
    const withTravel = boundsSizeMm(
      ir.boundsWithTravel.min,
      ir.boundsWithTravel.max,
    );
    expect(withTravel.z).toBeGreaterThanOrEqual(extrude.z);
    // objectBounds: fixture has no object labels → honest empty (±Infinity).
    expect(Number.isFinite(ir.objectBounds.min.x)).toBe(false);
  });

  it("derives a kinematic time axis independent of the slicer header", () => {
    const t = computeToolpathTime(ir);
    expect(t.totalMs).toBeGreaterThan(0);
    // Slicer header says 750 s; the kinematic model is a lower bound.
    expect(t.totalMs / 1000).toBeLessThan(750);
  });

  it("gives byte-accurate source mapping (scrub → source)", () => {
    expect(ir.sourceIndex.byteOffsets.length).toBe(ir.segments.count);
    expect(ir.segments.srcByte.length).toBe(ir.segments.count);
  });
});

describe("[chestnut] STL → calculator data", () => {
  it("chestnutlabs parseStl yields geometry we can volume-measure", () => {
    const scene = parseStl(STL_BYTES);
    expect(scene.objects).toHaveLength(1);
    const geo = scene.objects[0].geometry;
    const triCount = geo.positions.length / 9;
    expect(triCount).toBeGreaterThan(0);
    const volume = meshVolumeMm3(geo.positions);
    expect(Number.isFinite(volume)).toBe(true);
    expect(volume).toBeGreaterThan(0);
  });

  it("agrees with three.js STLLoader (what production stlParser uses)", () => {
    // STLLoader.parse wants a real ArrayBuffer (not a Node Buffer/Uint8Array).
    const ab = new ArrayBuffer(STL_BYTES.byteLength);
    new Uint8Array(ab).set(STL_BYTES);
    const threeGeom = new STLLoader().parse(ab);
    const threeVol = meshVolumeMm3(threeGeom.attributes.position.array);
    const chestnutScene = parseStl(STL_BYTES);
    const chestnutVol = meshVolumeMm3(
      chestnutScene.objects[0].geometry.positions,
    );
    // Both decoders must agree on enclosed volume (within fp tolerance).
    expect(chestnutVol).toBeCloseTo(threeVol, -2);
  });
});
