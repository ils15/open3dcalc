import { describe, it, expect } from "vitest";
import { printers, getPrinter } from "@/shared/lib/printers";

describe("printers", () => {
  it("exports an array of printer profiles", () => {
    expect(Array.isArray(printers)).toBe(true);
    expect(printers.length).toBeGreaterThan(0);
  });

  it("every printer has the required fields", () => {
    for (const p of printers) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("brand");
      expect(p).toHaveProperty("power");
      expect(p).toHaveProperty("value");
      expect(p).toHaveProperty("usefulLife");
      expect(p).toHaveProperty("maintenancePerHour");
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.brand).toBe("string");
      expect(typeof p.power).toBe("number");
      expect(typeof p.value).toBe("number");
      expect(typeof p.usefulLife).toBe("number");
      expect(typeof p.maintenancePerHour).toBe("number");
    }
  });

  it("has unique ids", () => {
    const ids = printers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has positive power and value for every printer", () => {
    for (const p of printers) {
      expect(p.power).toBeGreaterThan(0);
      expect(p.value).toBeGreaterThan(0);
      expect(p.usefulLife).toBeGreaterThan(0);
      expect(p.maintenancePerHour).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers multiple brands", () => {
    const brands = new Set(printers.map((p) => p.brand));
    expect(brands.size).toBeGreaterThanOrEqual(5);
  });

  it("matches snapshot", () => {
    expect(printers).toMatchSnapshot();
  });

  it("every printer has a thumbnail", () => {
    for (const p of printers) {
      expect(p.image, `printer ${p.id} must define an image`).toBeTruthy();
      expect(typeof p.image).toBe("string");
    }
  });

  it("every printer has an official websiteUrl or none at all", () => {
    for (const p of printers) {
      if (p.websiteUrl !== undefined) {
        expect(p.websiteUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it("buildVolumeMm, when present, is three positive axes", () => {
    for (const p of printers) {
      if (p.buildVolumeMm) {
        expect(p.buildVolumeMm.x).toBeGreaterThan(0);
        expect(p.buildVolumeMm.y).toBeGreaterThan(0);
        expect(p.buildVolumeMm.z).toBeGreaterThan(0);
      }
    }
  });
});

describe("getPrinter", () => {
  it("returns the matching printer by id", () => {
    const result = getPrinter("bambu_p1s");
    expect(result.id).toBe("bambu_p1s");
    expect(result.name).toBe("P1S");
    expect(result.brand).toBe("Bambu Lab");
  });

  it("returns the first printer for unknown ids", () => {
    const result = getPrinter("nonexistent");
    expect(result.id).toBe(printers[0].id);
    expect(result.name).toBe(printers[0].name);
  });
});
