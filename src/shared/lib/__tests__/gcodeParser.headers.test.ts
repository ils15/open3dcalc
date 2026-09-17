import { describe, it, expect } from "vitest";
import { parseGcode } from "@/shared/lib/gcodeParser";

describe("parseGcode — headers no formato com ':' (Orca/Bambu)", () => {
  it("extrai layer height de '; layer_height:' sem '='", () => {
    expect(parseGcode("; layer_height: 0.3").layerHeight).toBe(0.3);
  });

  it("extrai layer height de initial_layer_line_height no formato ':'", () => {
    expect(parseGcode("; initial_layer_line_height: 0.25").layerHeight).toBe(
      0.25,
    );
  });

  it("layer_height vence sobre initial_layer_line_height (ambos com ':')", () => {
    const info = parseGcode(
      "; layer_height: 0.15\n; initial_layer_line_height: 0.3",
    );
    expect(info.layerHeight).toBe(0.15);
  });

  it("initial_layer_line_height não sobrescreve layer_height já setado", () => {
    const info = parseGcode(
      "; layer_height: 0.2\n; initial_layer_line_height: 0.4",
    );
    expect(info.layerHeight).toBe(0.2);
  });

  it("extrai temperaturas no formato ':'", () => {
    expect(parseGcode("; nozzle_temperature: 215").nozzleTemp).toBe(215);
    expect(parseGcode("; bed_temperature: 65").bedTemp).toBe(65);
  });
});

describe("parseGcode — print size parcial", () => {
  it("MINX sem MAXX deixa x zerado", () => {
    expect(parseGcode(";MINX:10").printSize.x).toBe(0);
  });

  it("MINY sem MAXY deixa y zerado", () => {
    const info = parseGcode(";MINX:10\n;MAXX:20\n;MINY:5");
    expect(info.printSize.x).toBeCloseTo(10, 6);
    expect(info.printSize.y).toBe(0);
  });
});

describe("parseGcode — comandos sem parâmetro", () => {
  it("M140 sem S não define bedTemp", () => {
    expect(parseGcode("M140").bedTemp).toBe(0);
  });

  it("M104 sem S não define nozzleTemp", () => {
    expect(parseGcode("M104").nozzleTemp).toBe(0);
  });
});
