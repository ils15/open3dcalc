import * as THREE from "three";

/**
 * Topology guards for the signed-tetrahedron volume in `stlParser`.
 *
 * The volume algorithm (`|Σ signedTetra / 6`) is exact only for a closed,
 * consistently-oriented mesh. Faces wound the wrong way contribute negative
 * volume and cancel silently; holes and non-manifold edges make the divergence
 * theorem inapplicable — the estimate comes out wrong with no warning.
 *
 * This module DETECTS and REPORTS only. It never repairs and never blocks the
 * estimate (D-EA7, non-blocking by design).
 */

export interface MeshValidation {
  /** True when some face is wound opposite to its neighbors (a shared edge is
   * traversed in the same direction by both incident triangles). The signed
   * volume cancels these faces → silent under-estimate. */
  windingInconsistent: boolean;
  /** Edges shared by 3+ faces. */
  nonManifoldEdges: number;
  /** Edges with exactly one incident face = holes / open mesh. */
  openEdges: number;
  /** Triangles with zero area. */
  degenerateTriangles: number;
  /** True when the mesh exceeded the full-validation threshold — only the
   * cheap checks ran. Kept bounded so a local-first PWA never OOMs. */
  partial: boolean;
}

/**
 * Above this triangle count the O(n) edge-map (with its transient Map of every
 * edge) is skipped: a 1M-triangle mesh allocates ~1.5M map entries (~200-300 MB
 * transient), and the STL path already caps complexity at 2M triangles
 * (`StlPreview` `tooComplex` guard). Degenerate counting stays on (O(1)
 * memory). Measured worst case below the threshold: see D-EA7 perf notes.
 */
export const MESH_VALIDATION_TRIANGLE_THRESHOLD = 1_000_000;

/**
 * Vertices closer than this (mm) are treated as coincident. The STL loader
 * delivers NON-indexed geometry (duplicated vertices), so topology must match
 * by position, not by index. 1e-4 mm absorbs Float32 write noise at printer
 * scale (~1e-5 error at 1000 mm) while staying far below any real FDM feature.
 */
const VERTEX_SNAP_MM = 1e-4;
const VERTEX_SNAP_INVERSE = 1 / VERTEX_SNAP_MM;

type EdgeStats = { count: number; forward: number };

/**
 * Single-pass topology analysis. Pure: no I/O, never mutates the input
 * geometry (works on a coordinate-key Map instead of merging vertices).
 *
 * @param geometry BufferGeometry with a `position` attribute (indexed or not).
 * @param triangleThreshold Skip the edge-map above this triangle count.
 */
export function analyzeMeshTopology(
  geometry: THREE.BufferGeometry,
  triangleThreshold = MESH_VALIDATION_TRIANGLE_THRESHOLD,
): MeshValidation {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const triangleCount = (index ? index.count : pos.count) / 3;

  const result: MeshValidation = {
    windingInconsistent: false,
    nonManifoldEdges: 0,
    openEdges: 0,
    degenerateTriangles: 0,
    partial: false,
  };

  if (triangleCount === 0) return result;

  const readX = (i: number) => pos.getX(i);
  const readY = (i: number) => pos.getY(i);
  const readZ = (i: number) => pos.getZ(i);

  // Above the threshold the edge-map would blow memory: run only the O(1)
  // degenerate check and flag the result as partial.
  if (triangleCount > triangleThreshold) {
    for (let t = 0; t < triangleCount; t++) {
      const r0 = index ? index.getX(t * 3) : t * 3;
      const r1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const r2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      const ax = readX(r0),
        ay = readY(r0),
        az = readZ(r0);
      const ux = readX(r1) - ax,
        uy = readY(r1) - ay,
        uz = readZ(r1) - az;
      const vx = readX(r2) - ax,
        vy = readY(r2) - ay,
        vz = readZ(r2) - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      if (nx === 0 && ny === 0 && nz === 0) result.degenerateTriangles++;
    }
    result.partial = true;
    return result;
  }

  // Single fused pass: degenerate check + vertex merge + directed edges.
  // The STL loader delivers NON-indexed geometry, so topology must match by
  // position, not by index. Numeric keys (nested maps) avoid string
  // allocation on this hot path — a 100k-triangle mesh visits 300k vertices.
  const edges = new Map<number, EdgeStats>();
  const root = new Map<number, Map<number, Map<number, number>>>();
  let mergedVertexCount = 0;
  // Fixed stride known up front: merged vertices can never exceed the raw
  // vertex count, so `lo * stride + hi` cannot collide across the pass.
  const edgeKeyStride = pos.count + 1;

  for (let t = 0; t < triangleCount; t++) {
    const r0 = index ? index.getX(t * 3) : t * 3;
    const r1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const r2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    // Normal magnitude == 2 × area; zero ⇒ collinear/ coincident vertices.
    const ax = readX(r0),
      ay = readY(r0),
      az = readZ(r0);
    const bx = readX(r1),
      by = readY(r1),
      bz = readZ(r1);
    const cx = readX(r2),
      cy = readY(r2),
      cz = readZ(r2);
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx === 0 && ny === 0 && nz === 0) result.degenerateTriangles++;

    const a = mergeVertex(root, ax, ay, az, mergedVertexCount);
    if (a.merged) mergedVertexCount++;
    const b = mergeVertex(root, bx, by, bz, mergedVertexCount);
    if (b.merged) mergedVertexCount++;
    const c = mergeVertex(root, cx, cy, cz, mergedVertexCount);
    if (c.merged) mergedVertexCount++;

    // Directed edges a→b, b→c, c→a. A consistently-oriented mesh traverses
    // every shared edge in OPPOSITE directions; same direction ⇒ flipped
    // face. `forward` is stable because merged indices are position-derived.
    countDirectedEdge(edges, a.index, b.index, edgeKeyStride);
    countDirectedEdge(edges, b.index, c.index, edgeKeyStride);
    countDirectedEdge(edges, c.index, a.index, edgeKeyStride);
  }

  let inconsistentEdges = 0;
  for (const stats of edges.values()) {
    if (stats.count === 1) {
      result.openEdges++;
    } else if (stats.count >= 3) {
      result.nonManifoldEdges++;
    } else if (stats.forward === 0 || stats.forward === 2) {
      // count === 2 but both faces agree on direction → inverted winding.
      inconsistentEdges++;
    }
  }
  result.windingInconsistent = inconsistentEdges > 0;

  return result;
}

export function isMeshSuspicious(v: MeshValidation | undefined): boolean {
  if (!v) return false;
  return (
    v.openEdges > 0 ||
    v.windingInconsistent ||
    v.nonManifoldEdges > 0 ||
    v.degenerateTriangles > 0 ||
    v.partial
  );
}

function countDirectedEdge(
  edges: Map<number, EdgeStats>,
  from: number,
  to: number,
  stride: number,
) {
  // Inline min/max (no array destructuring — this runs 3× per triangle).
  const lo = from < to ? from : to;
  const hi = from < to ? to : from;
  const key = lo * stride + hi;
  const stats = edges.get(key);
  if (stats) {
    stats.count++;
    if (from < to) stats.forward++;
  } else {
    edges.set(key, { count: 1, forward: from < to ? 1 : 0 });
  }
}

/**
 * Finds or creates the merged index for a quantized position. Nested numeric
 * maps avoid per-vertex string allocation on the hot path.
 */
function mergeVertex(
  root: Map<number, Map<number, Map<number, number>>>,
  x: number,
  y: number,
  z: number,
  nextIndex: number,
): { index: number; merged: boolean } {
  const qx = Math.round(x * VERTEX_SNAP_INVERSE);
  const qy = Math.round(y * VERTEX_SNAP_INVERSE);
  const qz = Math.round(z * VERTEX_SNAP_INVERSE);
  let byX = root.get(qx);
  if (!byX) {
    byX = new Map();
    root.set(qx, byX);
  }
  let byY = byX.get(qy);
  if (!byY) {
    byY = new Map();
    byX.set(qy, byY);
  }
  const existing = byY.get(qz);
  if (existing !== undefined) return { index: existing, merged: false };
  byY.set(qz, nextIndex);
  return { index: nextIndex, merged: true };
}
