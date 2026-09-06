import * as THREE from "three";
import {
  resolveFilamentDensity,
  type FilamentFamily,
} from "./filamentProfiles";
import {
  resolveCalibrationK,
  resolveWeightAnchor,
  type EstimateOptions,
} from "@/shared/types/estimation";

export interface MeshAnalysis {
  triangleCount: number;
  vertexCount: number;
  dimensions: { x: number; y: number; z: number };
  volume: number;
  surfaceArea: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  integrity: { valid: boolean; issues: string[] };
  /** Estimated support material volume in cm³. Only present when `estimateSupport` is enabled. */
  supportVolumeCm3?: number;
}

/** A single triangle defined by three vertices (coordinates in mm). */
export interface Triangle {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
}

export interface ParseOptions {
  /** When true, estimates support material volume from overhang triangles. Default false. */
  estimateSupport?: boolean;
  /** Layer height in mm used for support estimation. Default 0.2. */
  layerHeight?: number;
  /** Fraction of overhang volume that becomes support material. Default 0.15. */
  supportDensity?: number;
}

function calculateVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  let volume = 0;
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();

  if (!index) {
    for (let i = 0; i < pos.count; i += 3) {
      v1.fromBufferAttribute(pos, i);
      v2.fromBufferAttribute(pos, i + 1);
      v3.fromBufferAttribute(pos, i + 2);
      volume += signedTetraVolume(v1, v2, v3);
    }
  } else {
    for (let i = 0; i < index.count; i += 3) {
      v1.fromBufferAttribute(pos, index.getX(i));
      v2.fromBufferAttribute(pos, index.getX(i + 1));
      v3.fromBufferAttribute(pos, index.getX(i + 2));
      volume += signedTetraVolume(v1, v2, v3);
    }
  }
  return Math.abs(volume / 6);
}

function signedTetraVolume(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
): number {
  return (
    a.x * (b.y * c.z - b.z * c.y) +
    b.x * (c.y * a.z - c.z * a.y) +
    c.x * (a.y * b.z - a.z * b.y)
  );
}

function calculateSurfaceArea(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position;
  let area = 0;
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();

  const process = (a: number, b: number, c: number) => {
    v1.fromBufferAttribute(pos, a);
    v2.fromBufferAttribute(pos, b);
    v3.fromBufferAttribute(pos, c);
    const ab = v1.distanceTo(v2);
    const bc = v2.distanceTo(v3);
    const ca = v3.distanceTo(v1);
    const s = (ab + bc + ca) / 2;
    area += Math.sqrt(Math.max(0, s * (s - ab) * (s - bc) * (s - ca)));
  };

  const index = geometry.index;
  if (!index) {
    for (let i = 0; i < pos.count; i += 3) process(i, i + 1, i + 2);
  } else {
    for (let i = 0; i < index.count; i += 3)
      process(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  }
  return area;
}

/**
 * Extracts triangles from a BufferGeometry (coordinates in mm).
 * Handles both indexed and non-indexed geometries.
 */
function extractTriangles(geometry: THREE.BufferGeometry): Triangle[] {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const triangles: Triangle[] = [];
  const read = (i: number): [number, number, number] => [
    pos.getX(i),
    pos.getY(i),
    pos.getZ(i),
  ];

  if (!index) {
    for (let i = 0; i < pos.count; i += 3) {
      triangles.push({ a: read(i), b: read(i + 1), c: read(i + 2) });
    }
  } else {
    for (let i = 0; i < index.count; i += 3) {
      triangles.push({
        a: read(index.getX(i)),
        b: read(index.getX(i + 1)),
        c: read(index.getX(i + 2)),
      });
    }
  }
  return triangles;
}

/**
 * Estimates the support material volume (in cm³) needed for a mesh.
 *
 * Triangles whose normal points downward (normal Y < -0.7, i.e. facing down
 * more than ~45°) are treated as potential overhangs. The overhang area is
 * multiplied by the layer height and a support density factor:
 *
 *   supportVolume = overhangArea * layerHeight * supportDensity
 *
 * @param triangles Mesh triangles (coordinates in mm).
 * @param options Optional layerHeight (mm, default 0.2) and supportDensity (default 0.15).
 * @returns Estimated support volume in cm³.
 */
export function estimateSupportVolume(
  triangles: Triangle[],
  options: { layerHeight?: number; supportDensity?: number } = {},
): number {
  const layerHeight = options.layerHeight ?? 0.2;
  const supportDensity = options.supportDensity ?? 0.15;
  let overhangAreaMm2 = 0;

  for (const tri of triangles) {
    const [ax, ay, az] = tri.a;
    const [bx, by, bz] = tri.b;
    const [cx, cy, cz] = tri.c;

    // Edges of the triangle
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;

    // Normal = u × v (magnitude = 2 × triangle area)
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len === 0) continue;

    // Normalized Y component: < -0.7 means the face points downward > ~45°
    if (ny / len < -0.7) {
      overhangAreaMm2 += len / 2;
    }
  }

  // mm² * mm = mm³ → convert to cm³ (÷ 1000)
  return (overhangAreaMm2 * layerHeight * supportDensity) / 1000;
}

function validateMesh(geometry: THREE.BufferGeometry) {
  const issues: string[] = [];
  const pos = geometry.attributes.position;
  if (!pos || pos.count === 0) issues.push("Model does not contain vertices");
  if (pos.count % 3 !== 0)
    issues.push("Vertex count does not form complete triangles");
  if (!geometry.attributes.normal) {
    issues.push("Model does not contain normals");
    geometry.computeVertexNormals();
  }
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box && (box.isEmpty() || !isFinite(box.min.x)))
    issues.push("Invalid bounding box");
  return { valid: issues.length === 0, issues };
}

function analyzeGeometry(
  geometry: THREE.BufferGeometry,
  options: ParseOptions = {},
): MeshAnalysis {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  const pos = geometry.attributes.position;

  const analysis: MeshAnalysis = {
    triangleCount: pos.count / 3,
    vertexCount: pos.count,
    dimensions: {
      x: +size.x.toFixed(2),
      y: +size.y.toFixed(2),
      z: +size.z.toFixed(2),
    },
    volume: +calculateVolume(geometry).toFixed(2),
    surfaceArea: +calculateSurfaceArea(geometry).toFixed(2),
    boundingBox: {
      min: {
        x: +box.min.x.toFixed(2),
        y: +box.min.y.toFixed(2),
        z: +box.min.z.toFixed(2),
      },
      max: {
        x: +box.max.x.toFixed(2),
        y: +box.max.y.toFixed(2),
        z: +box.max.z.toFixed(2),
      },
    },
    integrity: validateMesh(geometry),
  };

  if (options.estimateSupport) {
    analysis.supportVolumeCm3 = +estimateSupportVolume(
      extractTriangles(geometry),
      options,
    ).toFixed(2);
  }

  return analysis;
}

export async function analyzeMeshFile(
  file: File,
  options: ParseOptions = {},
): Promise<{ geometry: THREE.BufferGeometry; analysis: MeshAnalysis }> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "3mf") {
    return parse3mf(file, options);
  }

  if (ext === "stl") {
    const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loader = new STLLoader();
          const geometry = loader.parse(e.target?.result as ArrayBuffer);
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          const analysis = analyzeGeometry(geometry, options);
          resolve({ geometry, analysis });
        } catch (err) {
          reject(new Error(`Error processing STL: ${err}`));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsArrayBuffer(file);
    });
  }

  if (ext === "obj") {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loader = new OBJLoader();
          const object = loader.parse(e.target?.result as string);
          const geometries: THREE.BufferGeometry[] = [];
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh)
              geometries.push(
                (child as THREE.Mesh).geometry as THREE.BufferGeometry,
              );
          });
          if (geometries.length === 0)
            throw new Error("No geometry found in OBJ");
          const geometry =
            geometries.length === 1
              ? geometries[0]
              : mergeGeometries(geometries);
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          const analysis = analyzeGeometry(geometry, options);
          resolve({ geometry, analysis });
        } catch (err) {
          reject(new Error(`Error processing OBJ: ${err}`));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  }

  throw new Error(`Unsupported format: ${ext}. Use STL, OBJ or 3MF.`);
}

// ---------------------------------------------------------------------------
// 3MF (OPC/ZIP) hardening limits.
//
// A slicer-produced 3MF is typically 1-20 MB. A zip bomb is orders of
// magnitude bigger once decompressed (GBs out of KBs), so these caps sit far
// above any legitimate file and far below anything dangerous. There is no
// canonical number for them — the values below are justified ranges, not
// standards.
// ---------------------------------------------------------------------------

/** Max total decompressed bytes across all parts of one 3MF package.
//
// Sized from a real-world probe: a 15.6 MB 3MF whose largest part inflates to
// ~76 MB (ratio ~5:1, perfectly legitimate slicer output). Multicolor and
// lithophane parts routinely exceed 100 MB per part, so 1 GB keeps ~10x
// headroom above the probed part while staying orders of magnitude below any
// real bomb (42.zip expands KBs to GBs/TBs, ratio ~10^9).
// Kept in check by MAX_RATIO (100:1) and MAX_ENTRIES below, which are what
// actually stop bombs — not these absolute byte caps. */
export const MAX_DECOMPRESSED_TOTAL = 1024 * 1024 * 1024; // 1 GB
/** Max decompressed bytes of a single ZIP entry.
//
// Was 32 MB and false-positived on the legit ~76 MB part above. 512 MB keeps
// ~6x headroom over it (multicolor/lithophane parts pass 100 MB per part);
// bombs are still caught by MAX_RATIO (a 42.zip-style
// payload claims ratios ~10^9, far above the 100:1 cap) and by the streaming
// during-decompression counters, not by this ceiling. */
export const MAX_EACH_ENTRY = 512 * 1024 * 1024; // 512 MB
/** Max allowed expansion ratio (uncompressed / compressed) per entry. */
export const MAX_RATIO = 100; // 100:1
/** Max number of entries in the ZIP central directory. */
export const MAX_ENTRIES = 200;
/** Max nesting depth of the <components> object graph. */
export const MAX_DEPTH = 8;

/** Thrown when a 3MF package trips any anti-zip-bomb cap. */
export class ZipBombError extends Error {
  constructor(message: string) {
    super(`3MF zip bomb blocked: ${message}`);
    this.name = "ZipBombError";
  }
}

/** Tracks cumulative decompressed bytes to catch flat bombs while streaming. */
interface ZipBudget {
  total: number;
}

/**
 * One entry of the ZIP central directory backing the 3MF package.
 * A 3MF is an OPC package (a ZIP), so reading the file means reading the ZIP first.
 */
interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/**
 * Reads the ZIP central directory and returns ALL entries indexed by
 * resolved part name.
 *
 * Previously this scan stopped at the FIRST entry ending in ".model" and
 * decoded only that one. That breaks files using the "production extension"
 * (OrcaSlicer/BambuStudio projects), where the root model holds no mesh at
 * all — only <components p:path="/3D/Objects/object_N.model"> — and the real
 * meshes live in other parts of the same ZIP.
 *
 * Also enforces the pre-decompression caps from the central directory's
 * declared sizes: entry count, per-entry size, total size and expansion
 * ratio. The streaming (during-decompression) checks in readZipEntryText
 * catch flat bombs that lie in these headers.
 */
function buildZipMap(uint8: Uint8Array): Map<string, ZipEntry> {
  // The End Of Central Directory sits, per spec, within the last
  // 22 + 65535 bytes (the ZIP comment is at most 64 KiB). Limiting the
  // search to that window avoids scanning a hundreds-of-MB file byte by byte.
  const scanStart = Math.max(0, uint8.length - 22 - 0xffff);
  let eocdOffset = -1;
  for (let i = uint8.length - 22; i >= scanStart; i--) {
    if (
      uint8[i] === 0x50 &&
      uint8[i + 1] === 0x4b &&
      uint8[i + 2] === 0x05 &&
      uint8[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1)
    throw new Error("Invalid 3MF file: not a valid ZIP archive");

  const cdOffset =
    (uint8[eocdOffset + 16] |
      (uint8[eocdOffset + 17] << 8) |
      (uint8[eocdOffset + 18] << 16) |
      (uint8[eocdOffset + 19] << 24)) >>>
    0;
  const numEntries = uint8[eocdOffset + 10] | (uint8[eocdOffset + 11] << 8);

  // Pre-check: entry-count cap before allocating anything per entry.
  if (numEntries > MAX_ENTRIES) {
    throw new ZipBombError(
      `central directory declares ${numEntries} entries (limit ${MAX_ENTRIES})`,
    );
  }

  const entries = new Map<string, ZipEntry>();
  let offset = cdOffset;
  let declaredTotal = 0;
  for (let i = 0; i < numEntries; i++) {
    // 0x02014b50 = central-directory header signature.
    if (uint8[offset] !== 0x50 || uint8[offset + 1] !== 0x4b) break;

    const fileNameLen = uint8[offset + 28] | (uint8[offset + 29] << 8);
    const extraLen = uint8[offset + 30] | (uint8[offset + 31] << 8);
    const commentLen = uint8[offset + 32] | (uint8[offset + 33] << 8);
    const name = new TextDecoder().decode(
      uint8.slice(offset + 46, offset + 46 + fileNameLen),
    );
    const compressionMethod = uint8[offset + 10] | (uint8[offset + 11] << 8);
    const compressedSize =
      (uint8[offset + 20] |
        (uint8[offset + 21] << 8) |
        (uint8[offset + 22] << 16) |
        (uint8[offset + 23] << 24)) >>>
      0;
    const uncompressedSize =
      (uint8[offset + 24] |
        (uint8[offset + 25] << 8) |
        (uint8[offset + 26] << 16) |
        (uint8[offset + 27] << 24)) >>>
      0;
    const localHeaderOffset =
      (uint8[offset + 42] |
        (uint8[offset + 43] << 8) |
        (uint8[offset + 44] << 16) |
        (uint8[offset + 45] << 24)) >>>
      0;

    // Pre-checks on declared sizes: cheap, and reject honest bombs outright.
    // Flat bombs that lie here are caught while streaming instead.
    if (uncompressedSize > MAX_EACH_ENTRY) {
      throw new ZipBombError(
        `entry "${name}" declares ${uncompressedSize} bytes (limit ${MAX_EACH_ENTRY})`,
      );
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_RATIO) {
      throw new ZipBombError(
        `entry "${name}" declares expansion ratio ${(uncompressedSize / compressedSize).toFixed(1)}:1 (limit ${MAX_RATIO}:1)`,
      );
    }
    declaredTotal += uncompressedSize;
    if (declaredTotal > MAX_DECOMPRESSED_TOTAL) {
      throw new ZipBombError(
        `package declares ${declaredTotal} bytes total (limit ${MAX_DECOMPRESSED_TOTAL})`,
      );
    }

    entries.set(resolveModelPath(name), {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * Resolves a 3MF part reference (ZIP entry name, `p:path` attribute) into the
 * single canonical key used for the ZIP map.
 *
 * Handles the forms producers emit: a leading `/` (the 3MF `p:path` is
 * absolute, `/3D/Objects/x.model`, while the ZIP stores `3D/Objects/x.model`),
 * backslashes, and `.` / `..` segments resolved lexically.
 *
 * Lookup is exact (case-sensitive) first, per the OPC spec; `loadModelPart`
 * adds a case-insensitive fallback for producers whose ZIP entry casing
 * diverges from the `p:path` casing. three.js
 * ignores `p:path` altogether, so supporting it is our differential.
 * A `..` that would escape the package root is rejected — it is the zip-slip
 * cousin for part references.
 */
export function resolveModelPath(rawPath: string): string {
  const trimmed = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts: string[] = [];
  for (const seg of trimmed.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) {
        throw new Error(
          `Invalid 3MF part path (escapes package root): ${rawPath}`,
        );
      }
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

/** Decompresses one ZIP entry and returns its text (3MF parts are XML). */
async function readZipEntryText(
  uint8: Uint8Array,
  entry: ZipEntry,
  budget: ZipBudget,
): Promise<string> {
  // Sizes come from the central directory; the local header is only used to
  // find where the data starts, because its size fields may be zero when the
  // writer used a data descriptor.
  const lhs = entry.localHeaderOffset;
  const localFileNameLen = uint8[lhs + 26] | (uint8[lhs + 27] << 8);
  const localExtraLen = uint8[lhs + 28] | (uint8[lhs + 29] << 8);
  const dataStart = lhs + 30 + localFileNameLen + localExtraLen;

  if (entry.compressionMethod === 0) {
    // Stored: the bytes already are the content.
    budget.total += entry.uncompressedSize;
    if (budget.total > MAX_DECOMPRESSED_TOTAL) {
      throw new ZipBombError(
        `package exceeds ${MAX_DECOMPRESSED_TOTAL} decompressed bytes total`,
      );
    }
    return new TextDecoder().decode(
      uint8.slice(dataStart, dataStart + entry.uncompressedSize),
    );
  }

  if (entry.compressionMethod === 8) {
    // Raw deflate (no zlib header) — what ZIP uses.
    if (typeof DecompressionStream === "undefined") {
      throw new Error(
        "Cannot decompress 3MF entry: DecompressionStream is unavailable " +
          "(use a modern browser or Node.js 18+)",
      );
    }
    const compressed = uint8.slice(dataStart, dataStart + entry.compressedSize);
    try {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      let entryTotal = 0;
      // Concurrent pump: the read loop must be PENDING before write/close
      // complete. Awaiting `writer.close()` with nobody draining `readable`
      // deadlocks by backpressure once the output exceeds the internal queue
      // (probed: 35 KB compressed -> 164 KB inflated hangs in close(); tiny
      // test payloads fit the buffer and mask the bug). A corrupt stream
      // surfaces its error on read, so the whole block stays in try/catch.
      const pump = (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          entryTotal += value.length;
          // During-decompression caps: byte counting on the stream catches flat
          // bombs whose central-directory headers lie about the sizes.
          if (entryTotal > entry.uncompressedSize) {
            throw new ZipBombError(
              `entry "${entry.name}" expanded past its declared ${entry.uncompressedSize} bytes`,
            );
          }
          if (entryTotal > MAX_EACH_ENTRY) {
            throw new ZipBombError(
              `entry "${entry.name}" exceeds ${MAX_EACH_ENTRY} decompressed bytes`,
            );
          }
          budget.total += value.length;
          if (budget.total > MAX_DECOMPRESSED_TOTAL) {
            throw new ZipBombError(
              `package exceeds ${MAX_DECOMPRESSED_TOTAL} decompressed bytes total`,
            );
          }
          chunks.push(value);
        }
      })();
      try {
        await writer.write(compressed);
        await writer.close();
      } catch (writeErr) {
        // If the write side fails, unblock the pending read so `pump`
        // never hangs forever, then let the outer catch wrap the error.
        try {
          await reader.cancel();
        } catch {
          /* reader already settled — pump carries the real error */
        }
        throw writeErr;
      } finally {
        writer.releaseLock();
      }
      await pump;
      reader.releaseLock();
      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      const decompressed = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, pos);
        pos += chunk.length;
      }
      return new TextDecoder().decode(decompressed);
    } catch (err) {
      if (err instanceof ZipBombError) throw err;
      throw new Error(
        `Error decompressing 3MF entry "${entry.name}": ${err instanceof Error ? err.message : err}`,
        { cause: err },
      );
    }
  }

  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
}

/**
 * Picks the part that is the package root model.
 * Order: the conventional `3D/3dmodel.model` path and, if missing, the first
 * `.model` part in the package.
 */
function pick3mfRootModel(entries: Map<string, ZipEntry>): string {
  if (entries.has("3D/3dmodel.model")) return "3D/3dmodel.model";

  for (const key of entries.keys()) {
    if (key.toLowerCase().endsWith(".model")) return key;
  }
  throw new Error("3MF file does not contain a valid 3D model");
}

/**
 * A 3MF matrix: 12 numbers forming a 4x3 in row-vector convention
 * (`m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32`), where the last row is
 * the translation. Identity is the implicit value when the attribute is missing.
 */
type Mat3mf = number[];

const IDENTITY_3MF: Mat3mf = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parse3mfTransform(value: string | null): Mat3mf {
  if (!value) return IDENTITY_3MF;
  const n = value.trim().split(/\s+/).map(Number);
  if (n.length !== 12 || n.some((v) => !Number.isFinite(v)))
    return IDENTITY_3MF;
  return n;
}

/**
 * Composes two transforms: applies `a` first and `b` after
 * (p' = p · a · b, following the 3MF row-vector convention).
 */
function mul3mf(a: Mat3mf, b: Mat3mf): Mat3mf {
  const out = new Array<number>(12);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] =
        a[row * 3] * b[col] +
        a[row * 3 + 1] * b[3 + col] +
        a[row * 3 + 2] * b[6 + col];
    }
  }
  // Translation row: the translation of `a` goes through the rotation of `b`.
  for (let col = 0; col < 3; col++) {
    out[9 + col] =
      a[9] * b[col] + a[10] * b[3 + col] + a[11] * b[6 + col] + b[9 + col];
  }
  return out;
}

/** Memoized cache of parsed `.model` parts, keyed by resolved part name. */
type ModelDocCache = Map<string, Document>;

/** Loads and memoizes one `.model` part of the package. */
async function loadModelPart(
  uint8: Uint8Array,
  entries: Map<string, ZipEntry>,
  cache: ModelDocCache,
  budget: ZipBudget,
  path: string,
): Promise<Document> {
  const key = resolveModelPath(path);
  const cached = cache.get(key);
  if (cached) return cached;

  let entryKey = key;
  let entry = entries.get(key);
  if (!entry) {
    // Fallback case-insensitive: exact match first (OPC § — URIs are
    // case-sensitive), then a case-folded scan for producers whose ZIP entry
    // casing diverges from the `p:path` casing.
    const lower = key.toLowerCase();
    for (const k of entries.keys()) {
      if (k.toLowerCase() === lower) {
        entryKey = k;
        entry = entries.get(k);
        break;
      }
    }
    const fallbackCached = cache.get(entryKey);
    if (fallbackCached) {
      cache.set(key, fallbackCached);
      return fallbackCached;
    }
  }
  if (!entry) throw new Error(`3MF part not found: ${path}`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    await readZipEntryText(uint8, entry, budget),
    "text/xml",
  );
  if (doc.querySelector("parsererror"))
    throw new Error(`Error parsing 3MF XML in ${path}`);
  cache.set(entryKey, doc);
  if (entryKey !== key) cache.set(key, doc);
  return doc;
}

/** Shared mutable state threaded through the object-graph walk. */
interface GraphWalkState {
  uint8: Uint8Array;
  entries: Map<string, ZipEntry>;
  cache: ModelDocCache;
  budget: ZipBudget;
  positions: number[];
  normals: number[];
}

/**
 * Emits one object (and everything it references) already transformed.
 * `stack` holds the part#id pairs on the current path to stop cycles — a
 * malformed 3MF could reference itself and hang the browser tab. `depth`
 * caps nesting per MAX_DEPTH on top of cycle detection, throwing ZipBombError
 * (never dropping geometry silently) when the cap is exceeded.
 */
async function walkObjectGraph(
  state: GraphWalkState,
  path: string,
  objectId: string,
  transform: Mat3mf,
  stack: Set<string>,
  depth: number,
): Promise<void> {
  if (depth > MAX_DEPTH)
    throw new ZipBombError(
      `maximum component depth exceeded (limit ${MAX_DEPTH})`,
    );
  const key = `${resolveModelPath(path)}#${objectId}`;
  if (stack.has(key)) return;

  const doc = await loadModelPart(
    state.uint8,
    state.entries,
    state.cache,
    state.budget,
    path,
  );
  const obj = Array.from(doc.querySelectorAll("object")).find(
    (o) => o.getAttribute("id") === objectId,
  );
  if (!obj) return;

  stack.add(key);
  try {
    const mesh = obj.querySelector("mesh");
    if (mesh) {
      appendMesh(mesh, transform, state.positions, state.normals);
    }

    for (const component of Array.from(obj.querySelectorAll("component"))) {
      const childId = component.getAttribute("objectid");
      if (!childId) continue;
      // `p:path` points at another part; without it the object is local.
      const childPath =
        component.getAttribute("p:path") ||
        component.getAttribute("path") ||
        path;
      const childTransform = mul3mf(
        parse3mfTransform(component.getAttribute("transform")),
        transform,
      );
      await walkObjectGraph(
        state,
        childPath,
        childId,
        childTransform,
        stack,
        depth + 1,
      );
    }
  } finally {
    stack.delete(key);
  }
}

/**
 * Walks the 3MF object graph from the `<build>` items and accumulates the
 * triangles already transformed into final tray coordinates.
 *
 * Handles the three cases the old parser missed:
 *  - `<components>`, which build one object out of other objects;
 *  - `p:path`, which puts the referenced object in ANOTHER part of the ZIP
 *    (production extension — the OrcaSlicer/BambuStudio project layout);
 *  - the `<item>` and `<component>` matrices, without which multiple objects
 *    all pile up at the origin.
 */
async function collect3mfTriangles(
  uint8: Uint8Array,
  entries: Map<string, ZipEntry>,
  rootPath: string,
  budget: ZipBudget,
): Promise<{ positions: number[]; normals: number[] }> {
  const state: GraphWalkState = {
    uint8,
    entries,
    cache: new Map<string, Document>(),
    budget,
    positions: [],
    normals: [],
  };

  const rootDoc = await loadModelPart(
    uint8,
    entries,
    state.cache,
    budget,
    rootPath,
  );
  const items = Array.from(rootDoc.querySelectorAll("build > item"));

  if (items.length > 0) {
    for (const item of items) {
      const objectId = item.getAttribute("objectid");
      if (!objectId) continue;
      const itemPath =
        item.getAttribute("p:path") || item.getAttribute("path") || rootPath;
      await walkObjectGraph(
        state,
        itemPath,
        objectId,
        parse3mfTransform(item.getAttribute("transform")),
        new Set<string>(),
        0,
      );
    }
  }

  // Last resort: packages without a usable <build> (or whose items resolved
  // to nothing) still yield geometry if a loose mesh sits in <resources>.
  if (state.positions.length === 0) {
    for (const mesh of Array.from(rootDoc.querySelectorAll("object mesh"))) {
      appendMesh(mesh, IDENTITY_3MF, state.positions, state.normals);
    }
  }

  return { positions: state.positions, normals: state.normals };
}

/** Converts one 3MF `<mesh>` into loose triangles, applying the matrix. */
function appendMesh(
  mesh: Element,
  m: Mat3mf,
  positions: number[],
  normals: number[],
): void {
  const vertices = mesh.querySelectorAll("vertex");
  // Already-transformed coordinates, in a flat array: 3 numbers per vertex.
  const coords = new Float64Array(vertices.length * 3);
  let i = 0;
  for (const v of Array.from(vertices)) {
    const x = parseFloat(v.getAttribute("x") || "0");
    const y = parseFloat(v.getAttribute("y") || "0");
    const z = parseFloat(v.getAttribute("z") || "0");
    coords[i++] = x * m[0] + y * m[3] + z * m[6] + m[9];
    coords[i++] = x * m[1] + y * m[4] + z * m[7] + m[10];
    coords[i++] = x * m[2] + y * m[5] + z * m[8] + m[11];
  }

  const vertexCount = vertices.length;
  for (const t of Array.from(mesh.querySelectorAll("triangle"))) {
    const v1 = parseInt(t.getAttribute("v1") || "0");
    const v2 = parseInt(t.getAttribute("v2") || "0");
    const v3 = parseInt(t.getAttribute("v3") || "0");
    if (v1 >= vertexCount || v2 >= vertexCount || v3 >= vertexCount) continue;

    const x1 = coords[v1 * 3],
      y1 = coords[v1 * 3 + 1],
      z1 = coords[v1 * 3 + 2];
    const x2 = coords[v2 * 3],
      y2 = coords[v2 * 3 + 1],
      z2 = coords[v2 * 3 + 2];
    const x3 = coords[v3 * 3],
      y3 = coords[v3 * 3 + 1],
      z3 = coords[v3 * 3 + 2];

    positions.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);

    // Face normal, computed after the transform — so mirroring and rotation
    // come baked in, with no need to transform normals separately.
    const ax = x2 - x1,
      ay = y2 - y1,
      az = z2 - z1;
    const bx = x3 - x1,
      by = y3 - y1,
      bz = z3 - z1;
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let k = 0; k < 3; k++) normals.push(nx, ny, nz);
  }
}

async function parse3mf(
  file: File,
  options: ParseOptions = {},
): Promise<{ geometry: THREE.BufferGeometry; analysis: MeshAnalysis }> {
  const THREE = await import("three");
  const uint8 = new Uint8Array(await file.arrayBuffer());

  const entries = buildZipMap(uint8);
  const rootPath = pick3mfRootModel(entries);
  const budget: ZipBudget = { total: 0 };
  const { positions, normals } = await collect3mfTriangles(
    uint8,
    entries,
    rootPath,
    budget,
  );

  if (positions.length === 0) throw new Error("No triangles found in 3MF file");

  return build3mfGeometry(positions, normals, THREE, options);
}

function build3mfGeometry(
  allPositions: number[],
  allNormals: number[],
  THREE: typeof import("three"),
  options: ParseOptions = {},
): { geometry: THREE.BufferGeometry; analysis: MeshAnalysis } {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(allPositions, 3),
  );
  if (allNormals.length > 0) {
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(allNormals, 3),
    );
  }
  geometry.computeBoundingBox();

  // Analysis reuses the SAME path as STL and OBJ. The 3MF used to have its
  // own copy, which computed volume via the divergence theorem dividing by 6
  // instead of 18 — returning THREE times the real value — while also
  // reporting `integrity: { valid: true }` without checking any mesh.
  return { geometry, analysis: analyzeGeometry(geometry, options) };
}

function mergeGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    }
  }
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (normals.length > 0)
    merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

export function volumeToCm3(volumeMm3: number): number {
  return volumeMm3 / 1000;
}

/**
 * Opções do estimador de volume de material.
 *
 * Todo campo afeta o cálculo — não há params-fantasma. Unidades canônicas
 * vão no nome (`Mm2`, `Mm`, `Cm3`); percentuais levam o sufixo `Percent`.
 * Defaults documentados em `docs/estimators-model.md`.
 */
export interface MaterialVolumeOptions {
  /** Porcentagem de infill (0–100, clamped). Padrão 20. */
  infillPercent?: number;
  /**
   * Área de superfície da malha em mm² (unidade canônica do `MeshAnalysis`).
   * A conversão mm² → cm² acontece AQUI, não no chamador.
   * Ausente ou ≤ 0 cai no modelo legado (20% fixo de casca).
   */
  surfaceAreaMm2?: number;
  /** Perímetros laterais. Padrão 2. */
  wallCount?: number;
  /** Largura da linha extrudada em mm. Padrão 0,42 (bico de 0,4). */
  lineWidthMm?: number;
  /** Camadas sólidas de topo. Padrão 4. */
  topLayers?: number;
  /** Camadas sólidas de base. Padrão 4. */
  bottomLayers?: number;
  /** Altura de camada em mm (só pondera o sólido topo/base). Padrão 0,2. */
  layerHeightMm?: number;
  /**
   * Espessura de casca explícita em mm. Quando omitida, é DERIVADA de
   * `wallCount × lineWidthMm + topo/base` — nunca um 0,84 fixo.
   */
  shellThicknessMm?: number;
  /**
   * Volume de suporte em cm³, somado por cima (padrão Meshy/ThisCalc:
   * `total = casca + núcleo × infill + suporte`). Padrão 0.
   */
  supportVolumeCm3?: number;
}

/** Weight estimator options = volume + material + purge + estimation mode. */
export interface WeightOptions extends MaterialVolumeOptions, EstimateOptions {
  /**
   * Família do filamento (tabela `filamentProfiles`, default PLA).
   * Só define a densidade de fallback — `densityGcm3` explícito vence.
   */
  material?: FilamentFamily | string;
  /** Densidade explícita em g/cm³ (ex: vinda da store). Vence a tabela. */
  densityGcm3?: number;
  /** Porcentagem de purga/troca sobre o volume efetivo. Padrão 0. */
  purgePercent?: number;
}

const VOLUME_DEFAULTS = {
  infillPercent: 20,
  wallCount: 2,
  lineWidthMm: 0.42,
  topLayers: 4,
  bottomLayers: 4,
  layerHeightMm: 0.2,
} as const;

/**
 * Volume de plástico realmente extrudado, em cm³.
 *
 * Modelo consagrado das calculadoras (Meshy/ThisCalc):
 * `casca = área × espessura`, limitada ao volume da peça;
 * `total = casca + max(0, volume − casca) × infill + suporte`.
 *
 * A espessura de casca é derivada do perfil: paredes laterais
 * (`wallCount × lineWidthMm`) + sólido de topo/base
 * (`(topLayers + bottomLayers) × layerHeightMm / 2`, assumindo que as áreas
 * projetadas de topo e base somam ~metade da superfície total — premissa
 * documentada em `docs/estimators-model.md`, com viés de superestimação
 * como margem de preço).
 *
 * `surfaceAreaMm2` ausente ou ≤ 0 cai no modelo legado
 * (`volume × (0,2 + 0,8 × infill)`), para não quebrar quem estima sem malha.
 * Volume ≤ 0 ou não-finito retorna 0.
 */
export function estimateMaterialVolumeCm3(
  volumeCm3: number,
  options: MaterialVolumeOptions = {},
): number {
  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) return 0;

  const {
    infillPercent = VOLUME_DEFAULTS.infillPercent,
    surfaceAreaMm2,
    wallCount = VOLUME_DEFAULTS.wallCount,
    lineWidthMm = VOLUME_DEFAULTS.lineWidthMm,
    topLayers = VOLUME_DEFAULTS.topLayers,
    bottomLayers = VOLUME_DEFAULTS.bottomLayers,
    layerHeightMm = VOLUME_DEFAULTS.layerHeightMm,
    shellThicknessMm,
    supportVolumeCm3 = 0,
  } = options;

  // NaN vaza por Math.min/max (Math.max(0, NaN) = NaN) — fallback
  // para o default antes do clamp.
  const safeInfillPercent = Number.isFinite(infillPercent)
    ? infillPercent
    : VOLUME_DEFAULTS.infillPercent;
  const infillRatio = Math.min(100, Math.max(0, safeInfillPercent)) / 100;
  const support =
    Number.isFinite(supportVolumeCm3) && supportVolumeCm3 > 0
      ? supportVolumeCm3
      : 0;

  if (!surfaceAreaMm2 || surfaceAreaMm2 <= 0) {
    return volumeCm3 * (0.2 + 0.8 * infillRatio) + support;
  }

  const wallMm = wallCount * lineWidthMm;
  const topBottomMm = ((topLayers + bottomLayers) * layerHeightMm) / 2;
  // Each face is EITHER a vertical wall (wallMm) OR a horizontal top/bottom
  // (topBottomMm) — never both, so the thickness applied to the total area is
  // the WEIGHTED AVERAGE of the two, not the sum. Summing double-counted the
  // shell: a 10 mm cube at 15% infill gave 0.99 cm³ vs 0.51 cm³ of exact
  // geometry (1.95×), and the error persisted at 1.22× on the 100 mm cube.
  //
  // Without the real area split between vertical and horizontal faces, use a
  // cube's — 4 vertical to 2 horizontal. With defaults that gives 0.827 mm,
  // exactly the true weighted average of a cube (4×0.84 + 2×0.80)/6.
  const effectiveShellMm = shellThicknessMm ?? (2 * wallMm + topBottomMm) / 3;
  // mm² → cm² (/100); cm² × mm = cm³/10 (1 cm² × 1 mm = 0,1 cm³)
  const shellCm3 = Math.min(
    volumeCm3,
    ((surfaceAreaMm2 / 100) * effectiveShellMm) / 10,
  );
  const innerCm3 = Math.max(0, volumeCm3 - shellCm3);
  return shellCm3 + innerCm3 * infillRatio + support;
}

/**
 * Plastic weight in grams: `(effective volume + purge) × density`.
 * Pricing estimate (rough ±30%, biased upward) — the only ground truth is the slicer (G-code).
 * Non-finite or ≤ 0 volume returns 0.
 *
 * Modes (`EstimateOptions`): `simple`/missing returns the byte-identical
 * legacy result (ignores `calibrationK`/`gcodeGrams`); `advanced` lets the
 * `gcodeGrams` anchor win and scales the rest by `calibrationK`
 * (default 1.0). `fixedMinutes` is time-only and ignored here.
 */
export function estimateWeight(
  volumeCm3: number,
  options: WeightOptions = {},
): number {
  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) return 0;
  const anchor = resolveWeightAnchor(options);
  if (anchor !== undefined) return anchor;

  const {
    material,
    densityGcm3,
    purgePercent = 0,
    mode: _mode,
    calibrationK: _calibrationK,
    gcodeGrams: _gcodeGrams,
    gcodeMinutes: _gcodeMinutes,
    fixedMinutes: _fixedMinutes,
    ...volumeOptions
  } = options;
  void _mode;
  void _calibrationK;
  void _gcodeGrams;
  void _gcodeMinutes;
  void _fixedMinutes;

  const density = resolveFilamentDensity(material, densityGcm3);
  // Mesmo guard anti-NaN do infill: NaN → 0% de purga (default).
  const safePurgePercent = Number.isFinite(purgePercent) ? purgePercent : 0;
  const purgeRatio = Math.min(100, Math.max(0, safePurgePercent)) / 100;
  const effectiveVolume = estimateMaterialVolumeCm3(volumeCm3, volumeOptions);
  const base = effectiveVolume * (1 + purgeRatio) * density;
  const k = resolveCalibrationK(options);
  return k === 1 ? base : base * k;
}
