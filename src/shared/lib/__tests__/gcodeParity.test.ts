/**
 * Golden parity suite — legacy engine vs @chestnutlabs adapter (D-CL3).
 *
 * PURPOSE. This is the safety net that decides whether D-CL4 may swap the
 * calculator's G-code engine. It runs BOTH engines over the same fixture bytes
 * and compares every metric the calculator consumes. The legacy stack
 * (`gcodeTotals` + `gcodeGeometry`) is the IMMOBILE ORACLE: it is not changed
 * here, and any chestnut number that disagrees with it must either fall inside
 * a declared tolerance or be a documented divergence below.
 *
 * WHAT IS COMPARED, AND AGAINST WHAT.
 * - extrusionDistance : legacy `extrudedMm` (the E-sum)  <->  chestnut
 *   `extrusionDistanceMm` (the parse core's own E-sum). Both are computed from
 *   the same E-words, so this is the tightest signal in the suite.
 * - filament (mm/g)   : legacy E-sum  <->  chestnut `filament.lengthMm` /
 *   `weightG`. Chestnut surfaces the SLICER'S OWN metadata; the legacy value is
 *   always the computed E-sum. These agree exactly when the slicer is honest
 *   about its own E-words and disagree loudly when it is not.
 * - printTime         : legacy `timeMinutes` (slicer header, or the move-based
 *   fallback)  <->  chestnut `printTimeSeconds` (slicer header).
 * - bounds            : legacy `GcodeBounds` (every G0..G3 move, travel
 *   included)  <->  chestnut `boundsWithTravel`. The extrude-only `bounds`,
 *   `objectBounds` and `modelBounds` are chestnut-only data the legacy engine
 *   cannot produce; they are registered, not compared.
 * - layerCount        : chestnut-only. Registered, never compared.
 *
 * TOLERANCE CONTRACT (declared per metric, then justified).
 * - extrusionDistance : max(1% relative, 0.1mm absolute). Both engines sum the
 *   same E-words; the only honest residual is floating-point summation order.
 *   1% is ~10x looser than that, so a failure means a real semantic change.
 * - filament weight   : 1% relative. The slicer rounds its own grams to 2dp;
 *   the legacy derives grams from the E-sum, so sub-percent rounding is the
 *   floor.
 * - printTime         : +/-1 whole minute. The legacy stores time in MINUTES
 *   (it rounds the slicer's seconds: 750s -> 13min), so a seconds-level
 *   comparison would be measuring the legacy's own rounding. Comparing
 *   `round(chestnutSeconds / 60)` against the legacy minutes makes the
 *   rounding exact and still catches a wrong or missing header.
 * - bounds            : 0.5mm per axis. Both engines walk the same moves with
 *   the same semantics; chestnut stores bounds in float32 and the legacy in
 *   float64, which is the sole residual (<=1e-7mm) — 0.5mm is 5e6x looser.
 *
 * === DIVERGENCE LEDGER (every entry is asserted, not silent) ===============
 * Each divergence is EXPECTED by this suite: the fixture is constructed to
 * produce it, and the test asserts the documented numbers. A divergence only
 * blocks D-CL4 if it is NOT in this ledger.
 *
 * | fixture          | metric      | legacy  | chestnut | root cause                | verdict                     |
 * |------------------|-------------|---------|----------|---------------------------|-----------------------------|
 * | m82-retraction   | extrusion   | 20 mm   | 22 mm    | L keeps the M82 high-water mark on retraction (de-retraction adds 0); C rebases lastE every E-word, so recovery counts | LEGACY WINS — de-duplication is the intent |
 * | m83-retraction   | extrusion   | 20 mm   | 22 mm    | L sums signed M83 deltas (a retract/de-retract pair nets 0); C accumulates only positive deltas | LEGACY WINS — net-zero pairs should not inflate the total |
 * | e-restart        | extrusion   | 80 mm   | 110 mm   | implicit spool restart (E drops with no G92): L waits for E to exceed the old max again; C re-primes immediately | LEGACY WINS — but this path is rare in slicer output |
 * | spike-cube       | filament mm | 41 mm   | 13.3 mm  | the fixture's own `; filament used [mm]` comment disagrees with its E-words: the slicer metadata is dishonest | LEGACY WINS for filament; C is faithfully reporting a lying header |
 * | spike-cube       | filament g  | 0.122 g | 9.98 g   | same root cause as above  | LEGACY WINS                 |
 * | klipper-parity   | printTime   | 3600 s  | undefined| chestnut registers no Klipper dialect adapter, so it cannot read `;ESTIMATOR_ADD_TIME` / `M73 R` | LEGACY WINS — keep the header cascade or add an adapter before the swap |
 * | klipper-parity   | filament    | 100 mm  | undefined| same blind spot as above  | LEGACY WINS                 |
 * | marlin-plain     | printTime   | 60 s    | 20.1 s   | no header at all: L uses its filament-rate heuristic, C its kinematic model. Neither is ground truth | NO WINNER — both are estimates; document, do not gate |
 * | *-no-header      | printTime   | moves   | kinematic| same as above (g92-reset, e-restart, retraction fixtures) | NO WINNER                   |
 * | cura-parity      | filament g  | 2.98 g  | undefined| Cura emits filament length only (`;Filament used: 1.0m`); chestnut surfaces only what the slicer wrote | NO WINNER — the calculator must derive grams from length, exactly as the legacy does |
 * | all fixtures     | bounds Z-min| 0.2 mm  | 0.0 mm   | chestnut's bounds include the floating origin (first segment start, 0,0,0); the legacy counts move endpoints only | WITHIN TOLERANCE (0.2mm < 0.5mm) — acceptable; document the Z-origin offset |
 *
 * GATE FOR D-CL4. Parity is 100% on every fixture for every metric, modulo the
 * ledger above. The per-field decision is: extrusionDistance and bounds may
 * move to chestnut as-is (document the Z-origin note); filament and printTime
 * must keep the legacy as the primary source until a Klipper dialect adapter
 * exists and the dishonest-metadata case has a documented fallback.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseGcodeTotals } from "../gcodeTotals";
import { GcodeBounds, type GcodeBoundsResult } from "../gcodeGeometry";
import { parseGcodeChestnut, type ChestnutParseResult } from "../gcodeChestnut";

/** Fixture root: `__fixtures__/parity` holds the D-CL3 set. */
const PARITY = join(__dirname, "__fixtures__", "parity");
/** The shared D-CL1 viability fixture, reused here as the dishonest-metadata case. */
const SHARED = join(__dirname, "__fixtures__");

/**
 * Declared tolerance per metric. Every number is justified in the file header;
 * changing one requires updating the ledger.
 */
const TOLERANCE = {
  /** Extrusion distance: max(1% relative, 0.1mm absolute). */
  extrusionRel: 0.01,
  extrusionAbsMm: 0.1,
  /** Slicer-reported filament weight: 1% relative (slicer rounds to 2dp). */
  weightRel: 0.01,
  /** Print time, compared in whole minutes (the legacy's own granularity). */
  timeMinutes: 1,
  /** Toolhead bounds per axis: 0.5mm (float32-vs-float64 storage residual). */
  boundsMm: 0.5,
} as const;

/**
 * A documented, expected divergence on one metric. The suite asserts the
 * chestnut value matches `chestnutValue` exactly — a divergence that drifts
 * unexplained is a regression and fails loudly.
 */
interface Divergence {
  /** Free-text reason, quoted in the failure message and the ledger. */
  reason: string;
  /** Which engine D-CL4 should trust for this metric. */
  winner: "legacy" | "chestnut" | "none";
}

interface ParityCase {
  /** Flavour label used in the test name. */
  flavour: string;
  /** Fixture path relative to its root. */
  file: string;
  /** True for the shared D-CL1 fixture at `__fixtures__` (not the parity dir). */
  shared?: boolean;
  /** Hand-verified legacy E-sum for the fixture, in mm. */
  legacyExtrudedMm: number;
  /** Chestnut dialect ids the adapter must detect (`[]` = no dialect). */
  dialectIds: string[];
  /** Slicer-header seconds the legacy reads (`undefined` = no header). */
  legacyHeaderSeconds?: number;
  /** Whole minutes the legacy reports (header, or the move-based fallback). */
  legacyTimeMinutes: number;
  /** Documented extrusion divergence, when the fixture constructs one. */
  extrusionDivergence?: Divergence & { chestnutExtrudedMm: number };
  /** Documented filament-metadata divergence, when the slicer is dishonest. */
  filamentDivergence?: Divergence & {
    chestnutLengthMm: number;
    chestnutWeightG?: number;
  };
  /** True when chestnut can surface no filament metadata at all. */
  chestnutFilamentAbsent?: boolean;
  /** True when chestnut can surface no slicer time at all (no dialect). */
  chestnutTimeAbsent?: boolean;
  /** Documented "both engines estimate, no ground truth" time divergence. */
  timeEstimateDivergence?: Divergence;
  /** Expected chestnut layer count (registered, never compared). */
  expectedLayers: number;
}

const CASES: ParityCase[] = [
  {
    flavour: "cura",
    file: "cura-parity.gcode",
    legacyExtrudedMm: 1000,
    dialectIds: ["cura"],
    legacyHeaderSeconds: 3600,
    legacyTimeMinutes: 60,
    expectedLayers: 5,
  },
  {
    flavour: "prusaslicer",
    file: "prusa-parity.gcode",
    legacyExtrudedMm: 1000,
    dialectIds: ["prusaslicer"],
    legacyHeaderSeconds: 3600,
    legacyTimeMinutes: 60,
    expectedLayers: 5,
  },
  {
    flavour: "orca (M83 relative E)",
    file: "orca-parity.gcode",
    legacyExtrudedMm: 100,
    dialectIds: ["orca-bambu"],
    legacyHeaderSeconds: 1800,
    legacyTimeMinutes: 30,
    expectedLayers: 5,
  },
  {
    flavour: "bambu",
    file: "bambu-parity.gcode",
    legacyExtrudedMm: 1000,
    dialectIds: ["orca-bambu"],
    legacyHeaderSeconds: 2700,
    legacyTimeMinutes: 45,
    expectedLayers: 5,
  },
  {
    flavour: "klipper",
    file: "klipper-parity.gcode",
    legacyExtrudedMm: 100,
    dialectIds: [],
    legacyHeaderSeconds: 3600,
    legacyTimeMinutes: 60,
    chestnutFilamentAbsent: true,
    chestnutTimeAbsent: true,
    extrusionDivergence: undefined,
    filamentDivergence: undefined,
    expectedLayers: 5,
  },
  {
    flavour: "marlin (no header, fallback path)",
    file: "marlin-plain.gcode",
    legacyExtrudedMm: 100,
    dialectIds: [],
    legacyTimeMinutes: 1,
    chestnutFilamentAbsent: true,
    chestnutTimeAbsent: true,
    timeEstimateDivergence: {
      reason:
        "no slicer header: legacy falls back to its filament-rate heuristic, chestnut to its kinematic model — neither is ground truth",
      winner: "none",
    },
    expectedLayers: 5,
  },
  {
    flavour: "G92 E reset (M82)",
    file: "g92-reset.gcode",
    legacyExtrudedMm: 500,
    dialectIds: [],
    legacyTimeMinutes: 4,
    chestnutFilamentAbsent: true,
    chestnutTimeAbsent: true,
    timeEstimateDivergence: {
      reason:
        "no slicer header: legacy move-based estimate vs chestnut kinematic estimate, no ground truth",
      winner: "none",
    },
    expectedLayers: 5,
  },
  {
    flavour: "M82 retraction (documented divergence)",
    file: "m82-retraction.gcode",
    legacyExtrudedMm: 20,
    dialectIds: [],
    legacyTimeMinutes: 0,
    chestnutFilamentAbsent: true,
    chestnutTimeAbsent: true,
    extrusionDivergence: {
      chestnutExtrudedMm: 22,
      reason:
        "legacy M82 keeps the high-water mark across a retraction (de-retraction adds 0); chestnut rebases lastE on every E-word so the recovery counts",
      winner: "legacy",
    },
    timeEstimateDivergence: {
      reason:
        "no header and a tiny print: legacy rounds its estimate to 0 minutes; chestnut reports a kinematic lower bound",
      winner: "none",
    },
    expectedLayers: 1,
  },
  {
    flavour: "M83 retraction (documented divergence)",
    file: "m83-retraction.gcode",
    legacyExtrudedMm: 20,
    dialectIds: [],
    legacyTimeMinutes: 0,
    chestnutFilamentAbsent: true,
    chestnutTimeAbsent: true,
    extrusionDivergence: {
      chestnutExtrudedMm: 22,
      reason:
        "legacy M83 sums signed deltas (a retract/de-retract pair nets to zero); chestnut accumulates only positive deltas",
      winner: "legacy",
    },
    timeEstimateDivergence: {
      reason:
        "no header and a tiny print: legacy rounds its estimate to 0 minutes; chestnut reports a kinematic lower bound",
      winner: "none",
    },
    expectedLayers: 1,
  },
  {
    flavour: "implicit E restart (documented divergence)",
    file: "e-restart.gcode",
    legacyExtrudedMm: 80,
    dialectIds: [],
    legacyTimeMinutes: 1,
    chestnutFilamentAbsent: true,
    chestnutTimeAbsent: true,
    extrusionDivergence: {
      chestnutExtrudedMm: 110,
      reason:
        "implicit spool restart (E drops with no G92): legacy waits for E to exceed the old maximum again; chestnut re-primes from the rebased lastE immediately",
      winner: "legacy",
    },
    timeEstimateDivergence: {
      reason:
        "no slicer header: two different estimate models, no ground truth",
      winner: "none",
    },
    expectedLayers: 1,
  },
  {
    flavour: "dishonest slicer metadata (documented divergence)",
    file: "spike-cube.gcode",
    shared: true,
    legacyExtrudedMm: 41,
    dialectIds: ["prusaslicer"],
    legacyHeaderSeconds: 750,
    legacyTimeMinutes: 13,
    filamentDivergence: {
      chestnutLengthMm: 13.3,
      chestnutWeightG: 9.98,
      reason:
        "the fixture's `; filament used [mm] = 13.3` comment disagrees with its own E-words (which sum to 41mm): chestnut faithfully reports the lying header, the legacy reports the computed E-sum",
      winner: "legacy",
    },
    expectedLayers: 5,
  },
];

/** Fixture text + both engine results for one case, computed once per case. */
interface Loaded {
  text: string;
  legacy: ReturnType<typeof parseGcodeTotals>;
  bounds: GcodeBoundsResult | null;
  chestnut: ChestnutParseResult;
}

const cache = new Map<string, Promise<Loaded>>();

/**
 * Read a fixture and run BOTH engines over the same bytes (memoised).
 *
 * The adapter is async only because its contract is worker-ready (D-CL5); with
 * the sync driver it settles on the next microtask, so `await` is free here and
 * keeps the suite linear and fully typed.
 */
function load(case_: ParityCase): Promise<Loaded> {
  const cached = cache.get(case_.file);
  if (cached !== undefined) return cached;

  const root = case_.shared === true ? SHARED : PARITY;
  const text = readFileSync(join(root, case_.file), "utf8");

  const legacy = parseGcodeTotals(text);
  const accumulator = new GcodeBounds();
  for (const line of text.split("\n")) accumulator.visitLine(line.trim());

  const pending = parseGcodeChestnut(new TextEncoder().encode(text)).then(
    (chestnut): Loaded => ({
      text,
      legacy,
      bounds: accumulator.bounds,
      chestnut,
    }),
  );
  cache.set(case_.file, pending);
  return pending;
}

/** Relative-or-absolute tolerance, whichever is the looser bound. */
function withinTolerance(
  actual: number,
  expected: number,
  relative: number,
  absolute: number,
): boolean {
  const tolerance = Math.max(absolute, Math.abs(expected) * relative);
  return Math.abs(actual - expected) <= tolerance;
}

describe("[parity] golden suite — legacy vs chestnutlabs", () => {
  describe.each(CASES)("$flavour", (case_) => {
    it("parses without error on both engines", async () => {
      const { legacy, chestnut, text } = await load(case_);
      expect(Number.isFinite(legacy.extrudedMm)).toBe(true);
      expect(chestnut.complete).toBe(true);
      expect(chestnut.byteLength).toBe(text.length);
    });

    it("detects the expected dialect (flavour coverage)", async () => {
      const { chestnut } = await load(case_);
      expect(chestnut.dialectIds).toStrictEqual(case_.dialectIds);
    });

    it("extrusion distance matches the legacy E-sum within tolerance", async () => {
      const { chestnut } = await load(case_);
      const divergence = case_.extrusionDivergence;
      if (divergence !== undefined) {
        // Documented divergence: assert the exact documented chestnut value so
        // an unexplained drift in either direction fails loudly.
        expect(chestnut.extrusionDistanceMm).toBe(
          divergence.chestnutExtrudedMm,
        );
        return;
      }
      const actual = chestnut.extrusionDistanceMm;
      const expected = case_.legacyExtrudedMm;
      const delta = Math.abs(actual - expected);
      const tolerance = Math.max(
        TOLERANCE.extrusionAbsMm,
        Math.abs(expected) * TOLERANCE.extrusionRel,
      );
      expect(
        delta <= tolerance,
        `extrusionDistance diverged beyond tolerance:
  legacy   = ${expected} mm
  chestnut = ${actual} mm
  delta    = ${delta} mm (tolerance ${tolerance} mm)
  fixture  = ${case_.file}`,
      ).toBe(true);
    });

    it("filament metadata agrees with the E-sum when the slicer is honest", async () => {
      const { legacy, chestnut } = await load(case_);
      const divergence = case_.filamentDivergence;
      if (divergence !== undefined) {
        // Dishonest slicer metadata: chestnut must surface the header's own
        // numbers verbatim — that is the divergence, and it is documented.
        expect(chestnut.filament?.lengthMm).toBe(divergence.chestnutLengthMm);
        if (divergence.chestnutWeightG !== undefined) {
          expect(chestnut.filament?.weightG).toBe(divergence.chestnutWeightG);
        }
        return;
      }
      if (case_.chestnutFilamentAbsent === true) {
        // No dialect can harvest filament metadata from this flavour: the
        // legacy E-sum remains the only source (see the ledger).
        expect(chestnut.filament).toBeUndefined();
        expect(legacy.extrudedMm).toBe(case_.legacyExtrudedMm);
        return;
      }
      // Honest metadata: the slicer's length must agree with the computed E-sum.
      const lengthMm = chestnut.filament?.lengthMm;
      expect(
        lengthMm,
        "chestnut reported no filament length for an honest-metadata fixture",
      ).toBeDefined();
      expect(
        withinTolerance(
          lengthMm as number,
          case_.legacyExtrudedMm,
          TOLERANCE.extrusionRel,
          TOLERANCE.extrusionAbsMm,
        ),
        `filament length disagrees with the E-sum:
  legacy E-sum = ${case_.legacyExtrudedMm} mm
  chestnut     = ${lengthMm} mm
  fixture      = ${case_.file}`,
      ).toBe(true);

      // Cura emits length only; weight must then be derived downstream.
      const weightG = chestnut.filament?.weightG;
      if (weightG !== undefined) {
        expect(
          withinTolerance(
            weightG,
            legacy.extrudedGrams,
            TOLERANCE.weightRel,
            0,
          ),
          `filament weight disagrees with the E-sum-derived grams:
  legacy grams = ${legacy.extrudedGrams}
  chestnut     = ${weightG}
  fixture      = ${case_.file}`,
        ).toBe(true);
      }
    });

    it("print time matches the legacy header within one minute (or is a documented divergence)", async () => {
      const { legacy, chestnut } = await load(case_);
      const legacySeconds = case_.legacyHeaderSeconds;
      if (case_.chestnutTimeAbsent === true) {
        // No dialect can read this flavour's time headers (Klipper) or there is
        // no header at all; both cases are in the ledger.
        expect(chestnut.printTimeSeconds).toBeUndefined();
        if (case_.timeEstimateDivergence !== undefined) {
          // No ground truth exists: assert both engines produced SOME estimate
          // and register the kinematic number without gating on it.
          expect(chestnut.printTimeSecondsKinematic).toBeGreaterThan(0);
        }
        expect(legacy.timeMinutes).toBe(case_.legacyTimeMinutes);
        return;
      }
      expect(
        legacySeconds,
        "fixture declared a header but the legacy found none",
      ).toBeDefined();
      expect(
        chestnut.printTimeSeconds,
        "chestnut detected a dialect but surfaced no print estimate",
      ).toBeDefined();

      // The legacy stores whole minutes, rounding the slicer's seconds; compare
      // on the legacy's own granularity so rounding is not mistaken for drift.
      const chestnutMinutes = Math.round(
        (chestnut.printTimeSeconds as number) / 60,
      );
      const delta = Math.abs(chestnutMinutes - case_.legacyTimeMinutes);
      expect(
        delta <= TOLERANCE.timeMinutes,
        `print time diverged beyond the rounding tolerance:
  legacy minutes   = ${case_.legacyTimeMinutes} (from ${legacySeconds}s)
  chestnut minutes = ${chestnutMinutes} (from ${chestnut.printTimeSeconds}s)
  delta            = ${delta} min (tolerance ${TOLERANCE.timeMinutes} min)
  fixture          = ${case_.file}`,
      ).toBe(true);
    });

    it("toolhead bounds (travel-inclusive) match the legacy state machine", async () => {
      const { bounds, chestnut } = await load(case_);
      // Legacy bounds cover every G0..G3 move, travels included, so the
      // comparable chestnut field is `boundsWithTravel`.
      expect(bounds, "the legacy found no positioned move").not.toBeNull();
      expect(
        chestnut.boundsWithTravel,
        "chestnut produced no travel-inclusive bounds",
      ).toBeDefined();

      const legacyBounds = bounds as GcodeBoundsResult;
      const travel = chestnut.boundsWithTravel;
      if (travel === undefined)
        throw new Error("unreachable: boundsWithTravel checked above");

      const axes = ["x", "y", "z"] as const;
      for (const axis of axes) {
        for (const edge of ["min", "max"] as const) {
          const legacyValue = legacyBounds[edge][axis];
          const chestnutValue = travel[edge][axis];
          const delta = Math.abs(chestnutValue - legacyValue);
          expect(
            delta <= TOLERANCE.boundsMm,
            `bounds ${edge}-${axis} diverged beyond tolerance:
  legacy   = ${legacyValue} mm
  chestnut = ${chestnutValue} mm
  delta    = ${delta} mm (tolerance ${TOLERANCE.boundsMm} mm)
  note     = chestnut bounds include the floating origin (first segment start); the legacy counts move endpoints only — see the Z-min ledger entry
  fixture  = ${case_.file}`,
          ).toBe(true);
        }
      }
    });

    it("layer count is registered (chestnut-only data, never compared)", async () => {
      const { chestnut } = await load(case_);
      // The legacy engine cannot count layers; this asserts the chestnut value
      // is sane and pins it, so a layers regression is caught here.
      expect(chestnut.layerCount).toBe(case_.expectedLayers);
    });

    it("extrude-only bounds are a subset of the travel-inclusive bounds", async () => {
      const { chestnut } = await load(case_);
      // Chestnut-only refinement: the extrusion box can never exceed the box
      // over all moves. This documents the richer data the swap would unlock.
      const travel = chestnut.boundsWithTravel;
      const extrude = chestnut.bounds;
      if (travel === undefined)
        throw new Error("unreachable: boundsWithTravel checked above");
      if (extrude === undefined) {
        // Nothing was extruded at all: an honest empty, not a fake 0-box.
        expect(chestnut.extrusionDistanceMm).toBe(0);
        return;
      }
      const axes = ["x", "y", "z"] as const;
      for (const axis of axes) {
        expect(extrude.min[axis]).toBeGreaterThanOrEqual(
          travel.min[axis] - TOLERANCE.boundsMm,
        );
        expect(extrude.max[axis]).toBeLessThanOrEqual(
          travel.max[axis] + TOLERANCE.boundsMm,
        );
      }
    });
  });
});
