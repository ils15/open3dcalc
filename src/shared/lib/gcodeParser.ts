import {
  DEFAULT_FILAMENT_DIAMETER_MM,
  DEFAULT_MAX_CHARS,
  filamentWeightGrams,
  firstHeaderMinutes,
  parseTimeHeaderSeconds,
  parseGcodeTotals,
} from "./gcodeTotals";
import {
  resolveFilamentDensity,
  type FilamentFamily,
} from "./filamentProfiles";
import {
  GcodeBounds,
  readSlicerGeometryComment,
  type GcodeBoundsResult,
} from "./gcodeGeometry";

export interface GcodeInfo {
  printTimeMinutes: number;
  filamentUsedMm: number;
  filamentUsedGrams: number;
  layerHeight: number;
  /**
   * Extrusion line width in mm when the slicer reports it (`; line_width`,
   * Cura `;WIDTH:`). D-EA6b: auto-fills the slicing profile. Absent when the
   * slicer reports nothing.
   */
  lineWidthMm?: number;
  nozzleTemp: number;
  bedTemp: number;
  printSize: { x: number; y: number; z: number };
  /**
   * Toolhead bounding box from G0/G1/G2/G3 moves (D-EA6). `null` when no
   * positioned move was seen — the UI shows "—" instead of a fake
   * `0.0×0.0×0.0`. `printSize` keeps its own precedence (metadata > bbox).
   */
  bounds?: GcodeBoundsResult | null;
  slicer: string;
  filamentType: string;
}

export interface ParseGcodeOptions {
  /** Filament diameter in mm (default 1.75, single-sourced from gcodeTotals). */
  filamentDiameterMm?: number;
  /** Density in g/cm³ — explicit value wins over the family table. */
  densityGcm3?: number;
  /** Material family for density lookup (default PLA). */
  filamentFamily?: FilamentFamily | string;
}

/**
 * `parseFloat` that rejects NaN/Infinity so malformed `;MINX:`-style metadata
 * can never poison the dimensions (falls back to the move bbox instead).
 */
function parseFiniteFloat(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Parse the supported filament total formats without accepting partial or
 * non-finite values. Plain numbers are millimetres; an `m` suffix is metres.
 */
function parseFilamentHeaderMm(trimmed: string): number | undefined {
  const match = trimmed.match(
    /^;Filament used:\s*([+]?((?:\d+(?:\.\d*)?)|(?:\.\d+)))\s*(mm|m)?\s*$/i,
  );
  if (!match) return undefined;

  const value = Number(match[1]);
  const unit = match[3]?.toLowerCase();
  const millimetres = unit === "m" ? value * 1000 : value;
  if (
    !Number.isFinite(millimetres) ||
    millimetres < 0 ||
    millimetres > DEFAULT_MAX_CHARS
  ) {
    return undefined;
  }
  return millimetres;
}

export function parseGcode(
  text: string,
  options: ParseGcodeOptions = {},
): GcodeInfo {
  const info: GcodeInfo = {
    printTimeMinutes: 0,
    filamentUsedMm: 0,
    filamentUsedGrams: 0,
    layerHeight: 0,
    nozzleTemp: 0,
    bedTemp: 0,
    printSize: { x: 0, y: 0, z: 0 },
    slicer: "",
    filamentType: "",
  };

  const lines = text.split("\n");

  // D-EA6: toolhead bounding box from G0/G1/G2/G3 moves, accumulated in the
  // same single pass (xyz-tools/gcode-preview approach, reimplemented).
  const bounds = new GcodeBounds();
  // Slicer geometry metadata per axis: `;MINX:` & friends win over the bbox
  // (they describe the PART, the box describes the TOOLHEAD).
  const metaSize: { x?: number; y?: number; z?: number } = {};

  // First-header-wins time: shared policy with parseGcodeTotals (T1/T2).
  // `undefined` = no header seen yet; the finished info exposes 0 when absent.
  let headerMinutes: number | undefined;
  let filamentHeaderMm: number | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Bounding box sees every line (moves + G90/G91/G92/G28 state machine).
    bounds.visitLine(trimmed);

    // D-EA6b: slicer-reported extrusion geometry (`; layer_height`,
    // `; line_width`, Cura `;HEIGHT:`/`;WIDTH:`). The config block is
    // authoritative; per-layer/initial values only fill what is still empty.
    const geometryComment = readSlicerGeometryComment(trimmed);
    if (geometryComment.layerHeightMm !== undefined) {
      info.layerHeight = geometryComment.layerHeightMm;
    } else if (
      geometryComment.perLayerHeightMm !== undefined &&
      !(info.layerHeight > 0)
    ) {
      info.layerHeight = geometryComment.perLayerHeightMm;
    } else if (
      geometryComment.initialLayerHeightMm !== undefined &&
      !(info.layerHeight > 0)
    ) {
      info.layerHeight = geometryComment.initialLayerHeightMm;
    }
    if (
      geometryComment.lineWidthMm !== undefined &&
      (info.lineWidthMm ?? 0) <= 0
    ) {
      info.lineWidthMm = geometryComment.lineWidthMm;
    }

    // Slicer header time via the shared reader (Cura/Prusa/Orca — see
    // parseTimeHeaderSeconds; first header wins, matching parseGcodeTotals).
    const headerSeconds = parseTimeHeaderSeconds(trimmed);
    headerMinutes = firstHeaderMinutes(headerMinutes, headerSeconds);
    if (headerMinutes !== undefined) info.printTimeMinutes = headerMinutes;
    const parsedFilamentHeaderMm = parseFilamentHeaderMm(trimmed);
    if (parsedFilamentHeaderMm !== undefined) {
      // A valid header is authoritative. Preserve the established last-valid
      // header precedence while preventing moves from replacing its value.
      filamentHeaderMm = parsedFilamentHeaderMm;
      info.filamentUsedMm = parsedFilamentHeaderMm;
    }
    if (trimmed.startsWith(";MINX:")) {
      const minX = parseFiniteFloat(trimmed.split(":")[1]);
      const maxXLine = lines.find((l) => l.trim().startsWith(";MAXX:"));
      const minYLine = lines.find((l) => l.trim().startsWith(";MINY:"));
      const maxYLine = lines.find((l) => l.trim().startsWith(";MAXY:"));
      const minZLine = lines.find((l) => l.trim().startsWith(";MINZ:"));
      const maxZLine = lines.find((l) => l.trim().startsWith(";MAXZ:"));
      if (minX !== undefined && maxXLine) {
        const maxX = parseFiniteFloat(maxXLine.trim().split(":")[1]);
        if (maxX !== undefined) metaSize.x = maxX - minX;
      }
      if (minYLine && maxYLine) {
        const minY = parseFiniteFloat(minYLine.trim().split(":")[1]);
        const maxY = parseFiniteFloat(maxYLine.trim().split(":")[1]);
        if (minY !== undefined && maxY !== undefined) metaSize.y = maxY - minY;
      }
      if (minZLine && maxZLine) {
        const minZ = parseFiniteFloat(minZLine.trim().split(":")[1]);
        const maxZ = parseFiniteFloat(maxZLine.trim().split(":")[1]);
        if (minZ !== undefined && maxZ !== undefined) metaSize.z = maxZ - minZ;
      }
    }
    if (trimmed.startsWith("; generated by")) {
      info.slicer = trimmed.replace("; generated by", "").trim();
    }
    if (trimmed.startsWith(";Slicer:")) {
      info.slicer = trimmed.split(":")[1].trim();
    }
    if (trimmed.startsWith(";Filament type:")) {
      info.filamentType = trimmed.split(":")[1].trim();
    }
    if (trimmed.startsWith(";Material:")) {
      info.filamentType = trimmed.split(":")[1].trim();
    }
    if (trimmed.startsWith("; nozzle_temperature")) {
      info.nozzleTemp = parseFloat(
        trimmed.split("=")[1] || trimmed.split(":")[1],
      );
    }
    if (trimmed.startsWith("; bed_temperature")) {
      info.bedTemp = parseFloat(trimmed.split("=")[1] || trimmed.split(":")[1]);
    }

    // G-code commands
    if (trimmed.startsWith("M104") || trimmed.startsWith("M109")) {
      const tempMatch = trimmed.match(/S(\d+)/);
      if (tempMatch && !info.nozzleTemp)
        info.nozzleTemp = parseInt(tempMatch[1]);
    }
    if (trimmed.startsWith("M140") || trimmed.startsWith("M190")) {
      const tempMatch = trimmed.match(/S(\d+)/);
      if (tempMatch && !info.bedTemp) info.bedTemp = parseInt(tempMatch[1]);
    }

    // E movements for filament calculation
    if (trimmed.startsWith("G1") || trimmed.startsWith("G0")) {
      const eMatch = trimmed.match(/E([\d.]+)/);
      if (eMatch) {
        const e = parseFloat(eMatch[1]);
        if (filamentHeaderMm === undefined && e > info.filamentUsedMm) {
          info.filamentUsedMm = e;
        }
      }
    }
  }

  // A G-code header is the slicer's authoritative total when present. Without
  // one, use the stateful totals reader so absolute E resets, relative E and
  // retractions are handled instead of taking the largest raw E value.
  if (filamentHeaderMm === undefined) {
    const totals = parseGcodeTotals(text, {
      filamentDiameterMm: options.filamentDiameterMm,
      densityGcm3: resolveFilamentDensity(
        options.filamentFamily,
        options.densityGcm3,
      ),
    });
    info.filamentUsedMm = totals.extrudedMm;
  }

  // Estimate filament weight from length via the parameterized profile (W1):
  // diameter defaults to DEFAULT_FILAMENT_DIAMETER_MM, density resolves from
  // the family table (filamentProfiles) with an explicit override winning.
  // NOTE (T3): this legacy path tracks max-E (largest absolute E seen), while
  // parseGcodeTotals sums signed deltas with M82/M83 + G92 resets — the two
  // can diverge on retraction-heavy or relative-extrusion files (no behavior
  // change here; see docs/estimators-model.md §10).
  if (info.filamentUsedMm > 0) {
    const diameterMm =
      options.filamentDiameterMm ?? DEFAULT_FILAMENT_DIAMETER_MM;
    const density = resolveFilamentDensity(
      options.filamentFamily,
      options.densityGcm3,
    );
    info.filamentUsedGrams = filamentWeightGrams(
      info.filamentUsedMm,
      diameterMm,
      density,
    );
  }

  // D-EA6: dimensions precedence — slicer metadata (`;MINX:`, part extents)
  // > move bounding box (toolhead extents) > zeros. `bounds === null` flags
  // "no geometry at all" so the UI can show "—" instead of a fake 0.0.
  const bboxSize = bounds.size;
  info.printSize = {
    x: metaSize.x ?? bboxSize?.x ?? 0,
    y: metaSize.y ?? bboxSize?.y ?? 0,
    z: metaSize.z ?? bboxSize?.z ?? 0,
  };
  info.bounds = bounds.bounds;

  return info;
}
