/**
 * Pure G-code geometry primitives — no I/O, no dependencies.
 *
 * Two concerns shared by `gcodeParser` (file view) and `gcodeTotals` (anchor):
 *
 * 1. `GcodeBounds` — a small state machine that accumulates the toolhead
 *    bounding box from `G0`/`G1`/`G2`/`G3` moves, honouring `G90`/`G91`
 *    (absolute/relative), `G92` (position redefinition) and `G28` (homing).
 *    Approach reimplemented from xyz-tools/gcode-preview (MIT) — **no new
 *    dependency**.
 * 2. `readSlicerGeometryComment` — extrusion geometry metadata the slicer
 *    writes as comments (`; layer_height`, `; line_width`, Cura `;HEIGHT:` /
 *    `;WIDTH:`), used by D-EA6b to auto-fill the slicing profile.
 *
 * Contract: `size`/`bounds` are `null` until a positioned move is seen on
 * **every** axis — the module never emits zeros or NaN for unknown extents
 * (D-EA6: the UI shows "—" instead of a fake `0.0×0.0×0.0`).
 *
 * Approximation (documented): arcs (`G2`/`G3`) contribute only their
 * endpoints, so the arc bulge can fall outside the box; and the box is the
 * **toolhead** extents — travels/purge/wipe-tower outside the part are
 * included, which is why slicer `;MINX:` metadata keeps precedence in
 * `gcodeParser`.
 */

/** Axis-aligned box in G-code coordinates. */
export interface GcodeBoundsResult {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

type Axis = "x" | "y" | "z";

const AXES: readonly Axis[] = ["x", "y", "z"];

/** X/Y/Z word of a move: `X10`, `x-1.5`, `Z0.2` (optional exponent). */
const WORD_RE = /([XYZ])(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g;

/** Move command G0..G3 (with or without leading zeros), rejecting G28/G92. */
const MOVE_RE = /^G([0-3]{1,2})(?![0-9])/i;

interface AxisState {
  /** Current position; `undefined` until established by a move/home/rebase. */
  pos?: number;
  min: number;
  max: number;
  /**
   * True once the position is established by a move or homing (G28). G92
   * rebases `pos` without marking the axis known — a coordinate relabel is
   * not a physical position.
   */
  known: boolean;
  /** True once at least one move endpoint expanded the box on this axis. */
  hasPoints: boolean;
}

function createAxis(): AxisState {
  return {
    pos: undefined,
    min: Infinity,
    max: -Infinity,
    known: false,
    hasPoints: false,
  };
}

/** Finite, non-NaN number guard (never propagates NaN to the caller). */
function finiteOrUndefined(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Line-fed bounding-box accumulator. Feed each trimmed G-code line via
 * `visitLine`; read `size`/`bounds` at the end (both null when invalid).
 */
export class GcodeBounds {
  private readonly state: Record<Axis, AxisState> = {
    x: createAxis(),
    y: createAxis(),
    z: createAxis(),
  };
  private absolute = true; // G90 (default) vs G91

  /** True once every axis has a known position. */
  get isValid(): boolean {
    return AXES.every((axis) => this.state[axis].known);
  }

  /** Extents per axis, or `null` when any axis was never positioned. */
  get size(): { x: number; y: number; z: number } | null {
    if (!this.isValid) return null;
    // A known-but-never-moved axis (homing only) is a single point: extent 0.
    const extent = (axis: Axis): number =>
      this.state[axis].hasPoints
        ? this.state[axis].max - this.state[axis].min
        : 0;
    return { x: extent("x"), y: extent("y"), z: extent("z") };
  }

  /** Min/max box, or `null` when any axis was never positioned. */
  get bounds(): GcodeBoundsResult | null {
    if (!this.isValid) return null;
    // Fall back to the established position for axes without move endpoints.
    const lo = (axis: Axis): number =>
      this.state[axis].hasPoints
        ? this.state[axis].min
        : (this.state[axis].pos ?? 0);
    const hi = (axis: Axis): number =>
      this.state[axis].hasPoints
        ? this.state[axis].max
        : (this.state[axis].pos ?? 0);
    return {
      min: { x: lo("x"), y: lo("y"), z: lo("z") },
      max: { x: hi("x"), y: hi("y"), z: hi("z") },
    };
  }

  /**
   * Consume one trimmed line. Safe on any input: comments are stripped, and
   * non-finite coordinates are rejected instead of poisoning the state.
   */
  visitLine(trimmed: string): void {
    if (!trimmed) return;

    // Strip the trailing comment (`G1 X0 ; move to X0`) before reading words.
    const semi = trimmed.indexOf(";");
    const code = (semi === -1 ? trimmed : trimmed.slice(0, semi)).trim();
    if (!code) return;

    if (/^G90(?![0-9])/i.test(code)) {
      this.absolute = true;
      return;
    }
    if (/^G91(?![0-9])/i.test(code)) {
      this.absolute = false;
      return;
    }
    if (/^G92(?![0-9])/i.test(code)) {
      // G92 redefines the current position without moving: no point is added.
      this.rebase(code);
      return;
    }
    if (/^G28(?![0-9])/i.test(code)) {
      // Homing: the axes are at 0 (known), but the home point itself is not a
      // move endpoint — only moves expand the box.
      this.home(code);
      return;
    }
    if (!MOVE_RE.test(code)) return;

    // Linear/travel/arc moves — G2/G3 contribute their endpoints only.
    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(code)) !== null) {
      const axis = match[1].toLowerCase() as Axis;
      const raw = parseFloat(match[2]);
      const value = finiteOrUndefined(raw);
      if (value === undefined) continue; // e.g. X1e999 → Infinity: ignored

      if (this.absolute) {
        // Absolute: only the arrived endpoint belongs to the box (the segment
        // start was already added by the previous move, or is genuinely
        // unknown — never invent the homed origin, which would over-include
        // parts printed away from 0,0,0).
        this.state[axis].pos = value;
        this.expand(axis, value);
      } else {
        // Relative: both endpoints belong to the box. The segment starts at
        // the current position, or at the implicit origin 0 when none was
        // ever established (relative coordinates are meaningless without it).
        const start = this.state[axis].pos ?? 0;
        this.state[axis].pos = start;
        this.expand(axis, start);
        this.state[axis].pos = start + value;
        this.expand(axis, this.state[axis].pos);
      }
    }
  }

  private expand(axis: Axis, value: number): void {
    const s = this.state[axis];
    s.min = Math.min(s.min, value);
    s.max = Math.max(s.max, value);
    s.hasPoints = true;
    s.known = true;
  }

  /** G92 X.. Y.. Z.. — set the position, never expand the box. */
  private rebase(code: string): void {
    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(code)) !== null) {
      const axis = match[1].toLowerCase() as Axis;
      const value = finiteOrUndefined(parseFloat(match[2]));
      if (value === undefined) continue;
      this.state[axis].pos = value;
    }
  }

  /** G28 [X] [Y] [Z] — bare G28 homes every axis to 0 (position, no extent). */
  private home(code: string): void {
    const words = AXES.filter((axis) =>
      new RegExp(`\\b${axis}\\b`, "i").test(code),
    );
    const targets = words.length > 0 ? words : AXES;
    for (const axis of targets) {
      this.state[axis].pos = 0;
      this.state[axis].known = true;
    }
  }
}

/** Slicer-reported extrusion geometry found in a comment line. */
export interface SlicerGeometryComment {
  /** Layer height (mm) from `; layer_height` — the authoritative config value. */
  layerHeightMm?: number;
  /** Layer height (mm) from `;HEIGHT:` — Cura per-layer comment, first wins. */
  perLayerHeightMm?: number;
  /** First-layer height (mm): `; initial_layer_line_height` (lower priority). */
  initialLayerHeightMm?: number;
  /** Extrusion line width (mm): `; line_width`, `;WIDTH:`. */
  lineWidthMm?: number;
}

const PROFILE_COMMENT_RE =
  /^;\s*(layer_height|initial_layer_line_height|line_width|WIDTH|HEIGHT)\s*[=:]\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/i;

/**
 * Read one slicer geometry comment. Returns an empty object for anything else
 * (including non-physical values: layer/width must be finite and > 0). The
 * caller applies precedence: `layerHeightMm` (config) > `perLayerHeightMm`
 * (Cura, first occurrence) > `initialLayerHeightMm`.
 */
export function readSlicerGeometryComment(
  trimmed: string,
): SlicerGeometryComment {
  const match = PROFILE_COMMENT_RE.exec(trimmed);
  if (!match) return {};

  const key = match[1].toLowerCase();
  const value = finiteOrUndefined(parseFloat(match[2]));
  if (value === undefined || value <= 0) return {};

  switch (key) {
    case "layer_height":
      return { layerHeightMm: value };
    case "height":
      return { perLayerHeightMm: value };
    case "initial_layer_line_height":
      return { initialLayerHeightMm: value };
    case "line_width":
    case "width":
      return { lineWidthMm: value };
    default:
      return {};
  }
}
