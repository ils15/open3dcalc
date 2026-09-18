/**
 * Post-override smoke test (D-CL1) — proves the pinned dependency graph still
 * resolves and executes after the npm `overrides` that force three@0.185.1.
 *
 * The override exists because @chestnutlabs/gcode-model-renderer and
 * -renderer-three peer-depend on three@^0.178.0 (a 0.x caret, i.e. exactly
 * 0.178.x), which ERESOLVE-rejects our three@0.185.1. Pinning `three` and the
 * two chestnut subtrees to 0.185.1 makes `npm ci` clean (no --legacy-peer-deps),
 * and this test guards against the failure mode that pinning could hide: a
 * duplicated or wrong three instance.
 *
 * Rendering a real <Canvas> is intentionally NOT done here — jsdom has no WebGL
 * (see src/shared/components/StlPreview/__tests__, which mock R3F for the same
 * reason). Instead this asserts module resolution, instance identity and
 * CPU-only execution, which is exactly what the override puts at risk.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GcodePreview } from "@chestnutlabs/gcode-preview-react";
import { parseStl } from "@chestnutlabs/gcode-model-renderer";
import { parseGcodeToIR } from "@chestnutlabs/gcode-parser";

const require = createRequire(import.meta.url);
const FIXTURES = join(__dirname, "__fixtures__");

describe("three@0.185.1 + @chestnutlabs resolve under npm overrides", () => {
  it("runs the pinned three revision", () => {
    expect(THREE.REVISION).toBe("185");
    // CPU-only three math must still work (guards against a broken/empty build).
    const v = new THREE.Vector3(1, 2, 2);
    expect(v.length()).toBe(3);
  });

  it("hoists exactly one three instance (no duplication)", () => {
    const rootThree = realpathSync(require.resolve("three"));

    // Both chestnut packages that peer-depend on three@^0.178.0 must resolve to
    // the very same file on disk as the root three. Their `exports` map is
    // ESM-only, so the entry is located via import.meta.resolve.
    for (const pkg of [
      "@chestnutlabs/gcode-model-renderer",
      "@chestnutlabs/gcode-renderer-three",
      "@chestnutlabs/gcode-preview-react",
    ]) {
      const entry = realpathSync(
        fileURLToPath(new URL(import.meta.resolve(pkg))),
      );
      const resolved = realpathSync(
        createRequire(dirname(entry)).resolve("three"),
      );
      expect(resolved).toBe(rootThree);
    }
  });

  it("keeps the @react-three/fiber + drei entry points available", () => {
    expect(typeof Canvas).toBe("function");
    // OrbitControls and GcodePreview are forwardRef components, which React 19
    // represents as objects — assert presence, not callability. A resolution
    // break makes these undefined instead.
    expect(OrbitControls).toBeDefined();
    expect(GcodePreview).toBeDefined();
  });

  it("executes the chestnutlabs parsers on the pinned three", () => {
    // model-renderer imports three internally; parseStl exercises it CPU-only.
    const stl = new Uint8Array(readFileSync(join(FIXTURES, "spike-cube.stl")));
    const scene = parseStl(stl);
    expect(scene.objects).toHaveLength(1);
    // 20 mm cube fixture → 12 triangles → 108 position floats (12*3*3).
    expect(scene.objects[0].geometry.positions.length).toBe(108);

    const gcode = readFileSync(join(FIXTURES, "spike-cube.gcode"), "utf8");
    const { stats } = parseGcodeToIR(gcode, {});
    expect(stats.extrusionDistance).toBeGreaterThan(0);
  });
});
