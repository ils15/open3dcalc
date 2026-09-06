/**
 * Pure G-code totals: extruded filament (E) + header time.
 *
 * Covers what the slicer knows and pre-slice does not: E sum over `G0`/`G1`
 * with `M82` (absolute, default) / `M83` (relative) plus `G92 En` resets, plus
 * `;TIME:seconds` (Cura) and `; estimated printing time ... = Xh Ym Zs`
 * (Prusa/Orca). No catastrophic regex: prefixes only plus one simple `\d`
 * per line. Anti-DoS caps with a friendly error.
 */

export interface GcodeTotals {
  /** Total extruded filament in mm (E sum). */
  extrudedMm: number;
  /** Estimated weight in grams (Ø 1.75 mm, PLA 1.24 g/cm³). */
  extrudedGrams: number;
  /** Header time in minutes, when the G-code reports it. */
  timeMinutes?: number;
}

export interface ParseGcodeTotalsOptions {
  /** Size cap in chars (default 50MB). */
  maxChars?: number;
  /** Line cap (default 2_000_000). */
  maxLines?: number;
  /** Filament diameter in mm (default 1.75). */
  filamentDiameterMm?: number;
  /** Density in g/cm³ (default 1.24 PLA). */
  densityGcm3?: number;
}

/**
 * Single source for G-code upload caps (UI imports these — never duplicate).
 * `file.size` (bytes) is checked against `DEFAULT_MAX_CHARS` as a close
 * approximation: G-code is ASCII, so 1 byte ≈ 1 char.
 */
export const DEFAULT_MAX_CHARS = 50 * 1024 * 1024;
export const DEFAULT_MAX_LINES = 2_000_000;

/**
 * Single-source filament defaults (W1 — never hard-code 1.75/1.24 elsewhere).
 * Density matches the PLA entry of `filamentProfiles.ts`; callers that know
 * the material resolve the density via `resolveFilamentDensity` and pass it
 * through `ParseGcodeTotalsOptions`.
 */
export const DEFAULT_FILAMENT_DIAMETER_MM = 1.75;
export const DEFAULT_FILAMENT_DENSITY_GCM3 = 1.24;

/**
 * Header seconds → whole minutes with the estimator rounding (T1/T2).
 * Single converter consumed by both G-code readers.
 */
export function timeSecondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/**
 * First-header-wins policy (T1/T2): the first time header in the file wins,
 * later headers are ignored. `undefined` means "no header seen yet".
 */
export function firstHeaderMinutes(
  current: number | undefined,
  headerSeconds: number | undefined,
): number | undefined {
  if (current !== undefined) return current;
  if (headerSeconds === undefined) return current;
  return timeSecondsToMinutes(headerSeconds);
}

/**
 * Filament weight from extruded length (W1 — single formula, never duplicate).
 * Volume = π r² L, with mm→cm³ conversion (/1000), times density.
 */
export function filamentWeightGrams(
  lengthMm: number,
  filamentDiameterMm: number = DEFAULT_FILAMENT_DIAMETER_MM,
  densityGcm3: number = DEFAULT_FILAMENT_DENSITY_GCM3,
): number {
  if (!(lengthMm > 0)) return 0;
  const radiusMm = filamentDiameterMm / 2;
  const volumeCm3 = (Math.PI * radiusMm * radiusMm * lengthMm) / 1000;
  return volumeCm3 * densityGcm3;
}

/** `E(-)12.34` — one number per line, no backtracking. */
function readEValue(token: string): number | undefined {
  const idx = token.indexOf("E");
  if (idx === -1) return undefined;
  const rest = token.slice(idx + 1);
  const m = /^(-?\d+(?:\.\d+)?)/.exec(rest);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : undefined;
}

/** `;TIME:7200` → 7200 seconds. Returns undefined when not a TIME header. */
function readCuraTimeSeconds(trimmed: string): number | undefined {
  if (!trimmed.startsWith(";TIME:")) return undefined;
  const v = parseFloat(trimmed.slice(6).trim());
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** `... = 1h 23m 45s` (d/h/m/s) → seconds. Only past the `=`. */
function readEstimatedPrintingTimeSeconds(trimmed: string): number | undefined {
  if (!trimmed.toLowerCase().includes("estimated printing time")) {
    return undefined;
  }
  const eq = trimmed.indexOf("=");
  if (eq === -1) return undefined;
  const part = trimmed.slice(eq + 1);
  const re = /(\d+)\s*([dhms])/gi;
  let total = 0;
  let m: RegExpExecArray | null;
  // Anti-loop guard: at most 16 pairs per comment line.
  let guard = 0;
  while ((m = re.exec(part)) !== null && guard++ < 16) {
    const val = parseInt(m[1], 10);
    if (!Number.isFinite(val)) continue;
    const unit = m[2].toLowerCase();
    if (unit === "d") total += val * 86400;
    else if (unit === "h") total += val * 3600;
    else if (unit === "m") total += val * 60;
    else total += val;
    // Avoid empty-loop on a global regex with no advance.
    if (m[0].length === 0) re.lastIndex++;
  }
  return total > 0 ? total : undefined;
}

/**
 * Unified time-header reader: Cura `;TIME:seconds` first, then Prusa/Orca
 * `estimated printing time`. Returns seconds, or undefined for other lines.
 *
 * Single place for every slicer time format — issue #84 (Klipper time-header
 * variants) will extend THIS function, and both `parseGcodeTotals` and the
 * legacy `parseGcode` reader already consume it.
 */
export function parseTimeHeaderSeconds(trimmed: string): number | undefined {
  return (
    readCuraTimeSeconds(trimmed) ?? readEstimatedPrintingTimeSeconds(trimmed)
  );
}

/**
 * E sum + header time. Pure, no I/O.
 *
 * @throws Friendly Error when over the caps (`maxChars`/`maxLines`).
 */
export function parseGcodeTotals(
  gcodeText: string,
  options: ParseGcodeTotalsOptions = {},
): GcodeTotals {
  const {
    maxChars = DEFAULT_MAX_CHARS,
    maxLines = DEFAULT_MAX_LINES,
    filamentDiameterMm = DEFAULT_FILAMENT_DIAMETER_MM,
    densityGcm3 = DEFAULT_FILAMENT_DENSITY_GCM3,
  } = options;

  if (typeof gcodeText !== "string") {
    throw new Error("Invalid G-code: text expected.");
  }
  if (gcodeText.length > maxChars) {
    throw new Error(
      `G-code too large (${(gcodeText.length / 1024 / 1024).toFixed(1)} MB, limit ${(maxChars / 1024 / 1024).toFixed(0)} MB). Upload a smaller snippet.`,
    );
  }

  let absolute = true; // M82 (default) vs M83
  // Eprev: last absolute reference. `G92 En` redefines Eprev without adding.
  // M82 only adds delta = E − Eprev when delta > 0; retraction (E steps back
  // without zeroing) is ignored WITHOUT moving Eprev, so the following
  // de-retraction yields delta 0 — net zero, no total inflation. Implicit
  // restart without G92 (spool swap zeroes E: E drops to ≤ 0) re-bases Eprev
  // without adding.
  let lastRawE = 0;
  let totalMm = 0;
  let timeMinutes: number | undefined;

  let lineCount = 0;
  let start = 0;
  const n = gcodeText.length;

  // Manual per-line iteration: avoids `split` on a giant file.
  const visitLine = (line: string): void => {
    lineCount++;
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    const timeS = parseTimeHeaderSeconds(trimmed);
    const next = firstHeaderMinutes(timeMinutes, timeS);
    if (next !== timeMinutes) {
      timeMinutes = next;
      return;
    }

    // Strip trailing comment (`G1 X0 E1 ; comment`) before reading the command.
    const semi = trimmed.indexOf(";");
    const code = (semi === -1 ? trimmed : trimmed.slice(0, semi)).trim();
    if (code.length === 0) return;
    const upper = code.toUpperCase();

    if (upper === "M82") {
      absolute = true;
      return;
    }
    if (upper === "M83") {
      absolute = false;
      return;
    }
    if (upper.startsWith("G92")) {
      // `G92 En` redefines Eprev without adding: next extrusion counts from n.
      const e = readEValue(upper);
      if (e !== undefined) lastRawE = e;
      return;
    }
    // Linear move G0/G00/G1/G01 (with or without space: `G1X0E1` counts).
    // The lookahead rejects G10/G11/G28 (`G` + digits other than 0/1).
    if (!/^G(0{1,2}|1{1,2})(?![0-9])/u.test(upper)) return;
    const e = readEValue(upper);
    if (e === undefined) return;
    if (absolute) {
      if (e <= 0 && e < lastRawE) {
        lastRawE = e; // implicit restart (spool zeroed E): re-base without adding
      } else if (e > lastRawE) {
        totalMm += e - lastRawE; // delta > 0 adds; retraction yields delta ≤ 0
        lastRawE = e;
      }
      // Retraction: ignored WITHOUT moving Eprev (de-retraction → delta 0, net zero).
    } else {
      // M83 relative: sum deltas WITH SIGN (negative retraction included).
      totalMm += e;
    }
  };

  for (let i = 0; i <= n; i++) {
    if (i === n || gcodeText[i] === "\n") {
      // Line without `\n`; tolerate Windows `\r`.
      let line = gcodeText.slice(start, i);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      visitLine(line);
      if (lineCount > maxLines) {
        throw new Error(
          `G-code has too many lines (limit ${maxLines.toLocaleString("en-US")}). Upload a smaller snippet.`,
        );
      }
      start = i + 1;
    }
  }

  // Clamp: total never negative (malformed G-code with negative balance).
  if (!(totalMm > 0)) totalMm = 0;

  const result: GcodeTotals = {
    extrudedMm: totalMm,
    extrudedGrams: filamentWeightGrams(totalMm, filamentDiameterMm, densityGcm3),
  };
  if (timeMinutes !== undefined) result.timeMinutes = timeMinutes;
  return result;
}
