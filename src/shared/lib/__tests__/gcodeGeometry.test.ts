import { describe, it, expect } from "vitest";

import { GcodeBounds, readSlicerGeometryComment } from "../gcodeGeometry";

describe("gcodeGeometry", () => {
  describe("GcodeBounds accumulator", () => {
    it("derives extents from absolute G0/G1 moves (10 mm cube)", () => {
      const b = new GcodeBounds();
      const lines = [
        "G28 ; home",
        "G1 X0 Y0 Z0 F3000",
        "G1 X10 Y0 Z0",
        "G1 X10 Y10 Z0",
        "G1 X0 Y10 Z0",
        "G1 X0 Y0 Z10",
      ];
      lines.forEach((l) => b.visitLine(l));

      expect(b.size).toEqual({ x: 10, y: 10, z: 10 });
      expect(b.bounds).toEqual({
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 10, z: 10 },
      });
    });

    it("keeps negative / off-bed coordinates instead of clamping them", () => {
      const b = new GcodeBounds();
      ["G1 X-5 Y-3 Z0.2", "G1 X5 Y3 Z0.2"].forEach((l) => b.visitLine(l));

      expect(b.size).toEqual({ x: 10, y: 6, z: 0 });
      expect(b.bounds?.min).toEqual({ x: -5, y: -3, z: 0.2 });
    });

    it("accumulates deltas in relative mode (G91) from the origin", () => {
      const b = new GcodeBounds();
      [
        "G90",
        "G28",
        "G1 X10 Y10 Z0",
        "G91 ; relative",
        "G1 X10",
        "G1 Y10",
        "G90 ; back to absolute",
        "G1 X0 Y0 Z5",
      ].forEach((l) => b.visitLine(l));

      expect(b.size).toEqual({ x: 20, y: 20, z: 5 });
    });

    it("treats relative moves without a known origin as starting at 0", () => {
      const b = new GcodeBounds();
      ["G91", "G1 X10 Y0 Z0", "G1 X10 Y0 Z0"].forEach((l) => b.visitLine(l));

      // X positions visited: 0 (implicit origin), 10, 20
      expect(b.size?.x).toBe(20);
    });

    it("G92 repositions the axes without contributing a point of its own", () => {
      const withG92 = new GcodeBounds();
      [
        "G28",
        "G1 X0 Y0 Z0",
        "G92 X0 Y0 Z0 ; offset, no physical move",
        "G1 X10 Y10 Z10",
      ].forEach((l) => withG92.visitLine(l));

      const withoutG92 = new GcodeBounds();
      ["G28", "G1 X0 Y0 Z0", "G1 X10 Y10 Z10"].forEach((l) =>
        withoutG92.visitLine(l),
      );

      expect(withG92.size).toEqual(withoutG92.size);
      expect(withG92.size).toEqual({ x: 10, y: 10, z: 10 });
    });

    it("G92 alone never produces bounds (no move happened)", () => {
      const b = new GcodeBounds();
      ["G92 X0 Y0 Z0", "M104 S200"].forEach((l) => b.visitLine(l));

      expect(b.size).toBeNull();
      expect(b.bounds).toBeNull();
    });

    it("G28 marks the axes as homed so later relative moves are grounded", () => {
      const b = new GcodeBounds();
      ["G28", "G91", "G1 X10", "G1 X-10"].forEach((l) => b.visitLine(l));

      expect(b.isValid).toBe(true);
      expect(b.size?.x).toBe(10);
    });

    it("uses only the endpoints of G2/G3 arcs (bulge is an approximation)", () => {
      const b = new GcodeBounds();
      [
        "G90",
        "G1 X0 Y0 Z0",
        "G2 X10 Y10 Z0 I5 J5",
        "G3 X0 Y0 Z0 I-5 J-5",
      ].forEach((l) => b.visitLine(l));

      expect(b.size).toEqual({ x: 10, y: 10, z: 0 });
    });

    it("returns null when only extrusion moves are present (no X/Y/Z)", () => {
      const b = new GcodeBounds();
      ["M83", "G1 E5", "G1 E-2", "G1 E3"].forEach((l) => b.visitLine(l));

      expect(b.size).toBeNull();
      expect(b.bounds).toBeNull();
      expect(b.isValid).toBe(false);
    });

    it("returns null when there are no moves at all", () => {
      const b = new GcodeBounds();
      [";TIME:3600", "M104 S200", "M140 S60", "G4 S10"].forEach((l) =>
        b.visitLine(l),
      );

      expect(b.size).toBeNull();
      expect(b.isValid).toBe(false);
    });

    it("ignores malformed / non-finite coordinates (never propagates NaN)", () => {
      const b = new GcodeBounds();
      // "Xabc" is not a valid word (ignored); "X1e999" overflows to Infinity
      // (rejected by the finite guard). Y and Z stay valid, but X is never
      // established → bounds stay invalid instead of leaking NaN.
      ["G1 Xabc Y10 Z0", "G1 X1e999", "G1 Y10 Z0"].forEach((l) =>
        b.visitLine(l),
      );

      expect(b.size).toBeNull();
      expect(b.isValid).toBe(false);
    });

    it("retraction (E-only moves) does not inflate the extents", () => {
      const b = new GcodeBounds();
      [
        "G90",
        "G1 X0 Y0 Z0",
        "G1 X10 Y10 Z0",
        "G1 E-2 ; retract",
        "G1 E3 ; de-retract",
      ].forEach((l) => b.visitLine(l));

      expect(b.size).toEqual({ x: 10, y: 10, z: 0 });
    });

    it("ignores inline comments when reading move words", () => {
      const b = new GcodeBounds();
      ["G1 X0 Y0 Z0 ; travel to X0 corner", "G1 X10 Y10 Z10"].forEach((l) =>
        b.visitLine(l),
      );

      expect(b.size).toEqual({ x: 10, y: 10, z: 10 });
    });

    it("accepts moves without spaces (G1X10Y10)", () => {
      const b = new GcodeBounds();
      ["G1X0Y0Z0", "G1X10Y10Z10"].forEach((l) => b.visitLine(l));

      expect(b.size).toEqual({ x: 10, y: 10, z: 10 });
    });
  });

  describe("readSlicerGeometryComment", () => {
    it.each([
      ["; layer_height = 0.16", 0.16],
      ["; layer_height: 0.16", 0.16],
      ["; layer_height=0.2", 0.2],
    ])("reads layer height from %s", (line, expected) => {
      expect(readSlicerGeometryComment(line).layerHeightMm).toBe(expected);
    });

    it.each([
      ["; line_width = 0.42", 0.42],
      ["; line_width: 0.45", 0.45],
      [";WIDTH:0.4", 0.4],
    ])("reads line width from %s", (line, expected) => {
      expect(readSlicerGeometryComment(line).lineWidthMm).toBe(expected);
    });

    it("reads Cura-style ;HEIGHT: as a per-layer height", () => {
      expect(readSlicerGeometryComment(";HEIGHT:0.2").perLayerHeightMm).toBe(
        0.2,
      );
    });

    it("exposes initial_layer_line_height separately (lower priority)", () => {
      expect(
        readSlicerGeometryComment("; initial_layer_line_height = 0.25"),
      ).toEqual({ initialLayerHeightMm: 0.25 });
    });

    it.each([
      ["; layer_height = abc"],
      ["; layer_height = 0"],
      ["; layer_height = -0.2"],
      [";WIDTH:abc"],
      [";HEIGHT:0"],
      [";TIME:3600"],
      [";MINX:0"],
      ["G1 X10 Y10"],
      [""],
    ])("returns an empty object for %s (no usable value)", (line) => {
      expect(readSlicerGeometryComment(line)).toEqual({});
    });
  });
});
