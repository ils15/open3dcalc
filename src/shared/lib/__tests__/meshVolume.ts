/**
 * Mesh-volume math supporting the @chestnutlabs fixture tests (D-CL1).
 *
 * Volume of a closed triangle mesh via the divergence theorem: sum over triangles
 * of the signed volume of the tetrahedron (origin, a, b, c) = a·(b×c)/6. For a
 * consistently-wound closed mesh the absolute value is the enclosed volume.
 *
 * Deliberately identical to the standard STL volume formula so chestnutlabs'
 * `parseStl()` geometry can be compared apples-to-apples with three.js's
 * `STLLoader` output (which is what production `stlParser.ts` builds on).
 * Test-support only: production code should not import this.
 */
export function meshVolumeMm3(positions: ArrayLike<number>): number {
  const n = positions.length;
  if (n === 0 || n % 9 !== 0) return Number.NaN;
  let sum = 0;
  for (let i = 0; i < n; i += 9) {
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];
    const cx = positions[i + 6];
    const cy = positions[i + 7];
    const cz = positions[i + 8];
    sum +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return Math.abs(sum / 6);
}

/** Axis-aligned size (width/depth/height) of a min/max bounds pair, in mm. */
export function boundsSizeMm(
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };
}
