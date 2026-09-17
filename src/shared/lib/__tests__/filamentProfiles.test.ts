import { describe, it, expect } from "vitest";
import {
  maxVolumetricSpeedFor,
  resolveFilamentDensity,
  FILAMENT_PROFILES,
} from "@/shared/lib/filamentProfiles";

describe("maxVolumetricSpeedFor", () => {
  it("familha conhecida devolve o MVS da tabela", () => {
    expect(maxVolumetricSpeedFor("pla")).toBe(15);
    expect(maxVolumetricSpeedFor("petg")).toBe(12);
    expect(maxVolumetricSpeedFor("tpu")).toBe(5);
  });

  it("ausência de família cai no PLA (default)", () => {
    expect(maxVolumetricSpeedFor()).toBe(
      FILAMENT_PROFILES.pla.maxVolumetricSpeedMm3PerS,
    );
    expect(maxVolumetricSpeedFor(undefined)).toBe(15);
    expect(maxVolumetricSpeedFor(null as unknown as string)).toBe(15);
  });

  it("família desconhecida cai no teto seguro (10 mm³/s)", () => {
    expect(maxVolumetricSpeedFor("carbon-filled")).toBe(10);
    expect(maxVolumetricSpeedFor("wood")).toBe(10);
  });
});

describe("resolveFilamentDensity", () => {
  it("família conhecida devolve a densidade da tabela", () => {
    expect(resolveFilamentDensity("pla")).toBe(1.24);
    expect(resolveFilamentDensity("petg")).toBe(1.27);
    expect(resolveFilamentDensity("abs")).toBe(1.04);
  });

  it("ausência de família cai no PLA", () => {
    expect(resolveFilamentDensity()).toBe(1.24);
    expect(resolveFilamentDensity(undefined)).toBe(1.24);
  });

  it("família desconhecida cai na densidade do PLA", () => {
    expect(resolveFilamentDensity("experimental")).toBe(1.24);
  });

  it("densidade explícita vence a tabela", () => {
    expect(resolveFilamentDensity("petg", 2)).toBe(2);
    expect(resolveFilamentDensity("unknown", 1.5)).toBe(1.5);
  });

  it("densidade explícita não-finita é ignorada (volta à tabela)", () => {
    expect(resolveFilamentDensity("petg", NaN)).toBe(1.27);
  });
});

// ── D-EA4: lookup case-insensitive + override de MVS ──────────────────────

describe("filamentProfiles — lookup case-insensitive (D-EA4)", () => {
  it('"PLA"/"PlA" matcheiam o perfil "pla" no MVS', () => {
    expect(maxVolumetricSpeedFor("PLA")).toBe(15);
    expect(maxVolumetricSpeedFor("PlA")).toBe(15);
    expect(maxVolumetricSpeedFor("pla")).toBe(15);
  });

  it('"PETG" matcheia "petg" no MVS (antes caía no teto seguro 10)', () => {
    // Pré-D-EA4 o lookup era case-sensitive: "PETG" não existia na tabela →
    // DEFAULT_MAX_VOLUMETRIC_SPEED_MM3_PER_S (10), não o perfil real (12).
    expect(maxVolumetricSpeedFor("PETG")).toBe(12);
    expect(maxVolumetricSpeedFor("PeTg")).toBe(12);
  });

  it('"ABS"/"ASA"/"TPU"/"NYLON" matcheiam na densidade', () => {
    expect(resolveFilamentDensity("ABS")).toBe(1.04);
    expect(resolveFilamentDensity("Asa")).toBe(1.05);
    expect(resolveFilamentDensity("TPU")).toBe(1.21);
    expect(resolveFilamentDensity("Nylon")).toBe(1.14);
  });

  it("família desconhecida continua no fallback (case não cria perfil novo)", () => {
    expect(maxVolumetricSpeedFor("PLA+")).toBe(10);
    expect(resolveFilamentDensity("PLA+")).toBe(1.24);
  });

  it("a normalização não muta a tabela persistida (chaves continuam minúsculas)", () => {
    // O snapshot do perfil original é preservado — só a CHAVE de lookup é
    // normalizada; nada do que o usuário persistiu é reescrito.
    expect(Object.keys(FILAMENT_PROFILES)).toEqual([
      "pla",
      "petg",
      "abs",
      "asa",
      "tpu",
      "nylon",
    ]);
  });

  it("o nome de material do caller nunca é mutado", () => {
    const name = "PETG";
    expect(maxVolumetricSpeedFor(name)).toBe(12);
    expect(resolveFilamentDensity(name)).toBe(1.27);
    expect(name).toBe("PETG");
  });
});

describe("maxVolumetricSpeedFor — override manual (D-EA4)", () => {
  it("override finito e > 0 vence a tabela", () => {
    expect(maxVolumetricSpeedFor("pla", 30)).toBe(30);
    expect(maxVolumetricSpeedFor("petg", 30)).toBe(30);
  });

  it("override vence mesmo família desconhecida (teto seguro não se aplica)", () => {
    expect(maxVolumetricSpeedFor("carbon-filled", 22)).toBe(22);
  });

  it("override ausente usa a tabela (byte-identical ao pré-D-EA4)", () => {
    expect(maxVolumetricSpeedFor("pla", undefined)).toBe(15);
    expect(maxVolumetricSpeedFor("petg")).toBe(12);
    expect(maxVolumetricSpeedFor()).toBe(15);
  });

  it.each([NaN, Infinity, 0, -5])(
    "override inválido (%s) é ignorado — volta à tabela",
    (bad) => {
      expect(maxVolumetricSpeedFor("pla", bad)).toBe(15);
      expect(maxVolumetricSpeedFor("petg", bad)).toBe(12);
    },
  );

  it("override em mixed-case + valor válido — override vence", () => {
    expect(maxVolumetricSpeedFor("PLA", 18)).toBe(18);
  });
});
