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
