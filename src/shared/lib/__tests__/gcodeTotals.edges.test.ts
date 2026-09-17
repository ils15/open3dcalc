import { describe, it, expect } from "vitest";
import {
  parseGcodeTotals,
  parseTimeHeaderSeconds,
} from "@/shared/lib/gcodeTotals";

describe("parseTimeHeaderSeconds — headers inúteis devolvem undefined", () => {
  it("Cura ;TIME: não-positivo", () => {
    expect(parseTimeHeaderSeconds(";TIME:0")).toBeUndefined();
    expect(parseTimeHeaderSeconds(";TIME:-5")).toBeUndefined();
  });

  it("linha normal não é header", () => {
    expect(parseTimeHeaderSeconds("G1 X10 Y20 E1.5")).toBeUndefined();
    expect(parseTimeHeaderSeconds("")).toBeUndefined();
  });

  it("Prusa/Orca sem o separador =", () => {
    expect(
      parseTimeHeaderSeconds("; estimated printing time 1h 23m 45s"),
    ).toBeUndefined();
  });

  it("Bambu sem separador : ou =", () => {
    expect(
      parseTimeHeaderSeconds("; printing time 1h 23m 45s"),
    ).toBeUndefined();
  });

  it("Bambu com duração que soma zero", () => {
    expect(parseTimeHeaderSeconds("; model printing time: 0s")).toBeUndefined();
    expect(
      parseTimeHeaderSeconds("; total print time: 0h 0m 0s"),
    ).toBeUndefined();
  });

  it("Klipper ESTIMATOR_ADD_TIME sem número ou não-positivo", () => {
    expect(parseTimeHeaderSeconds(";ESTIMATOR_ADD_TIME:")).toBeUndefined();
    expect(parseTimeHeaderSeconds(";ESTIMATOR_ADD_TIME: 0")).toBeUndefined();
    expect(parseTimeHeaderSeconds(";ESTIMATOR_ADD_TIME: -1")).toBeUndefined();
  });

  it("M73 sem R, ou R não-positivo", () => {
    expect(parseTimeHeaderSeconds("M73 P10")).toBeUndefined();
    expect(parseTimeHeaderSeconds("M73 P10 R0")).toBeUndefined();
    expect(parseTimeHeaderSeconds("M73 R-5")).toBeUndefined();
  });
});

describe("parseGcodeTotals — robustez da entrada", () => {
  it("rejeita texto não-string", () => {
    expect(() => parseGcodeTotals(null as unknown as string)).toThrow(
      /Invalid G-code/,
    );
    expect(() => parseGcodeTotals(undefined as unknown as string)).toThrow(
      /Invalid G-code/,
    );
    expect(() => parseGcodeTotals(42 as unknown as string)).toThrow(
      /Invalid G-code/,
    );
  });

  it("tolera finais de linha Windows (\\r\\n)", () => {
    const gcode = "G1 X0 E1 ; first\r\nG1 X0 E5 ; second\r\n";
    const totals = parseGcodeTotals(gcode);
    // E1 → 1; E5 → +4 = 5 (delta positivo soma).
    expect(totals.extrudedMm).toBe(5);
    expect(totals.extrudedGrams).toBeGreaterThan(0);
  });

  it("re-basa E quando o carretel zera E sem G92 (restart implícito)", () => {
    // E10 adiciona 10; E0 cai abaixo do último E sem adicionar (restart);
    // E8 então adiciona 8 — e não 18 (não dobro).
    const totals = parseGcodeTotals("G1 E10\nG1 E0\nG1 E8\n");
    expect(totals.extrudedMm).toBe(18);
  });

  it("retração não inflacion o total (delta <= 0 é ignorado)", () => {
    const totals = parseGcodeTotals("G1 E10\nG1 E8\nG1 E10\n");
    // 10 → +10; 8 → retração ignorada; 10 → delta 0 → nada. Total 10.
    expect(totals.extrudedMm).toBe(10);
  });

  it("modo relativo M83 soma deltas com sinal", () => {
    const totals = parseGcodeTotals("M83\nG1 E10\nG1 E-3\nG1 E5\n");
    expect(totals.extrudedMm).toBe(12);
  });

  it("G92 redefine a referência sem adicionar", () => {
    const totals = parseGcodeTotals("G1 E10\nG92 E0\nG1 E5\n");
    // 10 → +10; G92 E0 → referência 0; E5 → +5. Total 15.
    expect(totals.extrudedMm).toBe(15);
  });
});
