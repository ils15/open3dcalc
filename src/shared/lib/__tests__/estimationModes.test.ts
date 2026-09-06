import { describe, it, expect } from "vitest";
import { estimateWeight } from "@/shared/lib/stlParser";
import {
  estimatePrintTime,
  estimatePrintTimeFromFilamentMm,
} from "@/shared/lib/printTimeEstimator";
import {
  parseGcodeTotals,
  parseTimeHeaderSeconds,
  DEFAULT_MAX_CHARS,
  DEFAULT_MAX_LINES,
} from "@/shared/lib/gcodeTotals";
import {
  K_MIN,
  K_MAX,
  MODE_BEHAVIOR,
  resolveFixedMinutes,
} from "@/shared/types/estimation";
import { resolveDisplayEstimate } from "@/shared/components/StlPreview/estimationDisplay";

/**
 * Estimation modes — ANTI-COMPLEXITY contract:
 * the default (simple/missing) path must stay byte-identical to current.
 */

const CUBE_WEIGHT_ARGS = {
  infillPercent: 20,
  surfaceAreaMm2: 2400,
  densityGcm3: 1.24,
} as const;
const CUBE_TIME_ARGS = {
  volumeCm3: 8,
  dimensions: { x: 20, y: 20, z: 20 },
} as const;

describe("estimationModes — regressão simple byte-idêntica", () => {
  it("cubo 20mm: peso travado (shell path)", () => {
    // Post-#82: shell thickness is the weighted average (2*wall+topBottom)/3, not the sum -- 3.952128, not the old 5.888512. Do not 'fix' back: see PR #82 / issue #81.
    expect(estimateWeight(8, { ...CUBE_WEIGHT_ARGS })).toBeCloseTo(3.952128, 6);
  });

  it("cubo 20mm: tempo travado", () => {
    const t = estimatePrintTime({ ...CUBE_TIME_ARGS });
    expect(t.estimatedMinutes).toBe(32);
    expect(t.estimatedHours).toBe(0.5);
    expect(t.layers).toBe(100);
  });

  it("bloco 100cm³ legado: peso + tempo travados", () => {
    expect(
      estimateWeight(100, { infillPercent: 20, densityGcm3: 1.24 }),
    ).toBeCloseTo(44.64, 6);
    const t = estimatePrintTime({
      volumeCm3: 100,
      dimensions: { x: 200, y: 200, z: 20 },
    });
    expect(t.estimatedMinutes).toBe(367);
    expect(t.estimatedHours).toBe(6.1);
  });

  it("litofania/extrusão real: tempo travado", () => {
    const t = estimatePrintTime({
      volumeCm3: 92.52,
      materialVolumeCm3: 72.78,
      dimensions: { x: 405.7, y: 391.6, z: 90.2 },
      layerHeightMm: 0.2,
      printSpeedMmPerS: 60,
    });
    expect(t.estimatedMinutes).toBe(280);
    expect(t.estimatedHours).toBe(4.7);
    expect(
      estimateWeight(92.52, { infillPercent: 20, densityGcm3: 1.24 }),
    ).toBeCloseTo(41.300928, 5);
  });

  it("mode='simple' (ou ausente) ignora k e âncoras", () => {
    const baseW = estimateWeight(8, { ...CUBE_WEIGHT_ARGS });
    expect(
      estimateWeight(8, {
        ...CUBE_WEIGHT_ARGS,
        mode: "simple",
        calibrationK: 1.2,
        gcodeGrams: 999,
      }),
    ).toBe(baseW);

    const baseT = estimatePrintTime({ ...CUBE_TIME_ARGS });
    const simpleT = estimatePrintTime({
      ...CUBE_TIME_ARGS,
      mode: "simple",
      calibrationK: 1.2,
      gcodeMinutes: 999,
    });
    expect(simpleT).toEqual(baseT);
  });
});

describe("estimationModes — advanced: calibrationK", () => {
  it("k=1.2 escala peso em +20%", () => {
    const base = estimateWeight(8, { ...CUBE_WEIGHT_ARGS });
    const scaled = estimateWeight(8, {
      ...CUBE_WEIGHT_ARGS,
      mode: "advanced",
      calibrationK: 1.2,
    });
    expect(scaled).toBeCloseTo(base * 1.2, 6);
  });

  it("k=1.2 escala tempo em +20% (arredondado)", () => {
    const base = estimatePrintTime({ ...CUBE_TIME_ARGS });
    const scaled = estimatePrintTime({
      ...CUBE_TIME_ARGS,
      mode: "advanced",
      calibrationK: 1.2,
    });
    expect(scaled.estimatedMinutes).toBe(
      Math.round(base.estimatedMinutes * 1.2),
    );
    // demais campos do trajeto não mudam
    expect(scaled.layers).toBe(base.layers);
    expect(scaled.filamentLengthMm).toBe(base.filamentLengthMm);
  });

  it("k ausente/inválido = 1.0 (sem efeito)", () => {
    const base = estimateWeight(8, { ...CUBE_WEIGHT_ARGS });
    expect(estimateWeight(8, { ...CUBE_WEIGHT_ARGS, mode: "advanced" })).toBe(
      base,
    );
    expect(
      estimateWeight(8, {
        ...CUBE_WEIGHT_ARGS,
        mode: "advanced",
        calibrationK: NaN,
      }),
    ).toBe(base);
  });
});

describe("estimationModes — advanced: âncoras G-code", () => {
  it("gcodeGrams vence a estimativa", () => {
    const w = estimateWeight(8, {
      ...CUBE_WEIGHT_ARGS,
      mode: "advanced",
      gcodeGrams: 7.5,
    });
    expect(w).toBe(7.5);
  });

  it("gcodeMinutes vence a estimativa", () => {
    const t = estimatePrintTime({
      ...CUBE_TIME_ARGS,
      mode: "advanced",
      gcodeMinutes: 42,
    });
    expect(t.estimatedMinutes).toBe(42);
    expect(t.estimatedHours).toBeCloseTo(0.7, 5);
  });
});

describe("parseGcodeTotals — soma E + resets + tempo", () => {
  it("soma E absoluto (G1/G0 com E)", () => {
    const totals = parseGcodeTotals(
      ["G1 X0 Y0 E0", "G1 X10 Y10 E5.5", "G0 X20 Y20 E7.5"].join("\n"),
    );
    expect(totals.extrudedMm).toBeCloseTo(7.5, 5);
  });

  it("G92 E0 reseta a baseline (sem subtrair)", () => {
    const totals = parseGcodeTotals(
      ["G1 X0 Y0 E10", "G92 E0", "G1 X10 Y10 E4"].join("\n"),
    );
    // 10 + 4 = 14 (não 4, não -6)
    expect(totals.extrudedMm).toBeCloseTo(14, 5);
  });

  it("retração absoluta não infla o total", () => {
    const totals = parseGcodeTotals(
      ["G1 X0 Y0 E5", "G1 X1 Y1 E4.5", "G1 X2 Y2 E5"].join("\n"),
    );
    expect(totals.extrudedMm).toBeCloseTo(5, 5);
  });

  it("M83 (relativo) soma deltas", () => {
    const totals = parseGcodeTotals(
      ["M83", "G1 X0 Y0 E2", "G1 X10 Y10 E3"].join("\n"),
    );
    expect(totals.extrudedMm).toBeCloseTo(5, 5);
  });

  it("M83 relativo: retrair E-0.8/desretrair E+0.8 dá líquido zero", () => {
    const totals = parseGcodeTotals(
      ["M83", "G1 X0 Y0 E2", "G1 X1 Y1 E-0.8", "G1 X2 Y2 E0.8"].join("\n"),
    );
    // 2 − 0.8 + 0.8 = 2 (retração negativa inclusa, com sinal).
    expect(totals.extrudedMm).toBeCloseTo(2, 5);
    const bare = parseGcodeTotals(["M83", "G1 E-0.8", "G1 E0.8"].join("\n"));
    expect(bare.extrudedMm).toBeCloseTo(0, 5);
  });

  it("M83 relativo: saldo negativo malformado nunca dá total negativo", () => {
    const totals = parseGcodeTotals(["M83", "G1 X0 Y0 E-5"].join("\n"));
    expect(totals.extrudedMm).toBe(0);
  });

  it("lê ;TIME: (segundos → minutos)", () => {
    const totals = parseGcodeTotals(";TIME:7200\nG1 X0 Y0 E1");
    expect(totals.timeMinutes).toBe(120);
  });

  it("lê '; estimated printing time' (Prusa/Orca)", () => {
    const totals = parseGcodeTotals(
      "; estimated printing time (normal mode) = 1h 23m 45s",
    );
    // 5025s / 60 = 83.75 → round 84 (mesmo arredondamento do parseGcode legado).
    expect(totals.timeMinutes).toBe(84);
  });

  it("returns grams consistent with the summed E", () => {
    const totals = parseGcodeTotals("G1 X0 Y0 E10");
    // 10mm of 1.75mm PLA 1.24g/cm³ filament ≈ 0.0298g
    expect(totals.extrudedGrams).toBeGreaterThan(0);
    expect(totals.extrudedGrams).toBeCloseTo(0.0298, 3);
  });
});

describe("parseTimeHeaderSeconds — Bambu/Klipper variants (issue #84)", () => {
  it("reads the Bambu structured-block time (`model printing time`)", () => {
    // 5025s / 60 = 83.75 → round 84 (same rounding as the legacy reader).
    expect(parseTimeHeaderSeconds("; model printing time: 1h 23m 45s")).toBe(
      5025,
    );
  });

  it("reads the Bambu per-plate time", () => {
    // 2h 5m = 7500s.
    expect(
      parseTimeHeaderSeconds("; estimated printing time for plate 1 = 2h 5m"),
    ).toBe(7500);
  });

  it("reads the Klipper `;ESTIMATOR_ADD_TIME` seconds", () => {
    expect(parseTimeHeaderSeconds(";ESTIMATOR_ADD_TIME: 3600")).toBe(3600);
  });

  it("reads the Klipper M73 remaining minutes (`M73 P.. R..`)", () => {
    // R42 = 42 remaining minutes → 2520s (progress-line estimate).
    expect(parseTimeHeaderSeconds("M73 P10 R42")).toBe(2520);
  });

  it("first header wins across formats (Cura beats a later Bambu line)", () => {
    const totals = parseGcodeTotals(
      [";TIME:7200", "; model printing time: 1h 23m 45s"].join("\n"),
    );
    expect(totals.timeMinutes).toBe(120);
  });

  it("returns undefined for unrelated lines", () => {
    expect(parseTimeHeaderSeconds("; layer_height = 0.2")).toBeUndefined();
  });
});

describe("parseGcodeTotals — moves fallback (issue #84)", () => {
  it("estimates time from moves when no header is present (approximate)", () => {
    const totals = parseGcodeTotals("G1 X0 Y0 E500\nG1 X10 Y10 E1000");
    // Move-based fallback: documented as approximate, single source in
    // printTimeEstimator (no slicer header to trust here).
    expect(totals.timeSource).toBe("moves");
    expect(totals.timeMinutes).toBe(estimatePrintTimeFromFilamentMm(1000));
    expect(totals.timeMinutes).toBe(9);
  });

  it("omits time when there is no header and no extrusion", () => {
    const totals = parseGcodeTotals("G1 X0 Y0\nG1 X10 Y10");
    expect(totals.timeMinutes).toBeUndefined();
    expect(totals.timeSource).toBeUndefined();
  });
});

describe("parseGcodeTotals — caps anti-DoS", () => {
  it("rejects text over the char cap with a friendly error", () => {
    const big = "x".repeat(51 * 1024 * 1024);
    expect(() => parseGcodeTotals(big)).toThrow(/too large/i);
  });

  it("rejects too many lines with a friendly error", () => {
    const many = Array(300001).fill("G1 X0 Y0").join("\n");
    expect(() => parseGcodeTotals(many, { maxLines: 300000 })).toThrow(
      /too many lines/i,
    );
  });
});

describe("estimationModes — zero nunca vira NaN", () => {
  it("peso zero com k avançado continua 0", () => {
    expect(
      estimateWeight(0, {
        densityGcm3: 1.24,
        mode: "advanced",
        calibrationK: 1.2,
      }),
    ).toBe(0);
    expect(
      estimateWeight(NaN, {
        densityGcm3: 1.24,
        mode: "advanced",
        calibrationK: 1.2,
      }),
    ).toBe(0);
  });

  it("tempo zero com k avançado continua 0 finito", () => {
    const t = estimatePrintTime({
      volumeCm3: 0,
      dimensions: { x: 0, y: 0, z: 0 },
      mode: "advanced",
      calibrationK: 1.2,
    });
    expect(t.estimatedMinutes).toBe(0);
    expect(Number.isFinite(t.estimatedHours)).toBe(true);
  });
});

describe("athena — caps single-source from gcodeTotals", () => {
  it("exports DEFAULT_MAX_CHARS (50MB) and DEFAULT_MAX_LINES (2M)", () => {
    expect(DEFAULT_MAX_CHARS).toBe(50 * 1024 * 1024);
    expect(DEFAULT_MAX_LINES).toBe(2_000_000);
  });

  it("rejects text over DEFAULT_MAX_CHARS with a friendly EN error", () => {
    const big = "x".repeat(DEFAULT_MAX_CHARS + 1);
    expect(() => parseGcodeTotals(big)).toThrow(/too large/i);
  });

  it("rejects too many lines with a friendly EN error", () => {
    const many = Array(11).fill("G1 X0 Y0").join("\n");
    expect(() => parseGcodeTotals(many, { maxLines: 10 })).toThrow(
      /too many lines/i,
    );
  });
});

describe("athena — domain exports K_MIN/K_MAX single-source", () => {
  it("exports calibration bounds used by the UI slider", () => {
    expect(K_MIN).toBe(0.5);
    expect(K_MAX).toBe(2);
  });

  it("clamps out-of-range k into [K_MIN, K_MAX]", () => {
    const base = estimateWeight(8, { ...CUBE_WEIGHT_ARGS });
    const clampedHigh = estimateWeight(8, {
      ...CUBE_WEIGHT_ARGS,
      mode: "advanced",
      calibrationK: 10,
    });
    expect(clampedHigh).toBeCloseTo(base * K_MAX, 6);
    const clampedLow = estimateWeight(8, {
      ...CUBE_WEIGHT_ARGS,
      mode: "advanced",
      calibrationK: 0.1,
    });
    expect(clampedLow).toBeCloseTo(base * K_MIN, 6);
  });
});

describe("athena — MODE_BEHAVIOR OCP table", () => {
  it("standard (simple) ignores k and anchors; custom (advanced) applies both", () => {
    expect(MODE_BEHAVIOR.simple).toEqual({
      applyCalibration: false,
      applyAnchors: false,
    });
    expect(MODE_BEHAVIOR.advanced).toEqual({
      applyCalibration: true,
      applyAnchors: true,
    });
  });
});

describe("athena — unified parseTimeHeaderSeconds (see issue #84)", () => {
  it("parses Cura ';TIME:' seconds", () => {
    expect(parseTimeHeaderSeconds(";TIME:7200")).toBe(7200);
  });

  it("parses Prusa/Orca 'estimated printing time' to seconds", () => {
    expect(
      parseTimeHeaderSeconds(
        "; estimated printing time (normal mode) = 1h 23m 45s",
      ),
    ).toBe(5025);
  });

  it("returns undefined for non-time headers", () => {
    expect(parseTimeHeaderSeconds("G1 X0 Y0 E1")).toBeUndefined();
    expect(parseTimeHeaderSeconds(";TIME:abc")).toBeUndefined();
  });
});

describe("athena — fixedMinutes (t_real = t_fixed + k*t, default 0)", () => {
  it("resolveFixedMinutes defaults invalid values to 0", () => {
    expect(resolveFixedMinutes(undefined)).toBe(0);
    expect(resolveFixedMinutes({})).toBe(0);
    expect(resolveFixedMinutes({ fixedMinutes: NaN })).toBe(0);
    expect(resolveFixedMinutes({ fixedMinutes: -5 })).toBe(0);
    expect(resolveFixedMinutes({ fixedMinutes: 10 })).toBe(10);
  });

  it("advanced time adds fixed setup on top of k-scaled time", () => {
    const base = estimatePrintTime({ ...CUBE_TIME_ARGS });
    const withFixed = estimatePrintTime({
      ...CUBE_TIME_ARGS,
      mode: "advanced",
      calibrationK: 1.2,
      fixedMinutes: 10,
    });
    expect(withFixed.estimatedMinutes).toBe(
      Math.round(base.estimatedMinutes * 1.2 + 10),
    );
  });

  it("fixedMinutes stacks on top of the G-code time anchor", () => {
    const t = estimatePrintTime({
      ...CUBE_TIME_ARGS,
      mode: "advanced",
      gcodeMinutes: 42,
      fixedMinutes: 10,
    });
    expect(t.estimatedMinutes).toBe(52);
  });

  it("simple mode ignores fixedMinutes (legacy byte-identical)", () => {
    const base = estimatePrintTime({ ...CUBE_TIME_ARGS });
    expect(
      estimatePrintTime({
        ...CUBE_TIME_ARGS,
        mode: "simple",
        fixedMinutes: 10,
      }),
    ).toEqual(base);
  });

  it("display estimate applies fixedMinutes to advanced time", () => {
    const d = resolveDisplayEstimate({
      weight: 10,
      minutes: 60,
      hours: 1,
      mode: "advanced",
      calibrationK: 1,
      anchor: null,
      fixedMinutes: 15,
    });
    expect(d.hours).toBeCloseTo(1.25, 5);
    expect(d.timeFromGcode).toBe(false);
  });
});
