/**
 * @vitest-environment node
 *
 * Unit tests for the swordlab enrichment matcher.
 * Network-independent: the catalog is injected as a fixture.
 *
 * Merge rules verified here (W10a requirements):
 *   - exact / partial / no match behavior
 *   - technical fields only; economic fields (value, power) NEVER overwritten
 *   - no match => technical fields stay absent
 */

import { describe, it, expect } from "vitest";
import {
  normalize,
  fallbackImage,
  inferTechnology,
  cubeFromCm3,
  extractTechnical,
  matchPrinter,
  enrich,
} from "../enrich-printers.mjs";

// Mini catalog exercising the real naming quirks: case variants, spaced
// digits, concatenated models, an unrelated manufacturer, and SLS tech.
const SW_FIXTURE = [
  {
    full_name: "Bambu Lab P1S",
    manufacturer: "Bambu Lab",
    model: "P1S",
    technology: "FDM",
    specs: { build_volume_cm3: 16777, power_w: 1000, heater_power_w: 350 },
  },
  {
    full_name: "Anycubic PHOTON M3",
    manufacturer: "Anycubic",
    model: "PHOTON M3",
    technology: "SLA",
    specs: { build_volume_mm: { x: 163.8, y: 102.4, z: 180 }, power_w: 120 },
  },
  {
    full_name: "Elegoo SATURN3",
    manufacturer: "Elegoo",
    model: "SATURN3",
    technology: "SLA",
    specs: {
      build_volume_mm: { x: 218.9, y: 122.9, z: 250 },
      nozzle_diameter_mm: 0.4,
    },
  },
  {
    full_name: "Creality Ender 3 V3 SE",
    manufacturer: "Creality",
    model: "Ender 3 V3 SE",
    technology: "FDM",
    specs: {
      build_volume_cm3: 12100,
      nozzle_diameter_mm: 0.4,
      max_speed_mm_s: 600,
      power_w: 270,
    },
  },
  {
    full_name: "Qidi X-Plus 3",
    manufacturer: "QIDI",
    model: "X-Plus 3",
    technology: "FDM",
    specs: { build_volume_mm: { x: 245, y: 200, z: 200 } },
  },
  // distractor — same brand, different model, must not match
  {
    full_name: "Creality K2",
    manufacturer: "Creality",
    model: "K2",
    technology: "FDM",
    specs: { build_volume_cm3: 24000 },
  },
  // SLS must map to resin
  {
    full_name: "Sinterit LISA",
    manufacturer: "Sinterit",
    model: "LISA",
    technology: "SLS",
    specs: { build_volume_mm: { x: 100, y: 100, z: 130 } },
  },
];

describe("normalize", () => {
  it("lowercases and strips punctuation/spaces", () => {
    expect(normalize("Bambu Lab P1S")).toBe("bambulabp1s");
    expect(normalize("PHOTON M3")).toBe("photonm3");
    expect(normalize("X-Plus 3")).toBe("xplus3");
    expect(normalize("")).toBe("");
  });
});

describe("cubeFromCm3", () => {
  it("converts cm³ to a perfect cube in mm³", () => {
    const v = cubeFromCm3(1000);
    // 1000 cm³ = 1e6 mm³ -> side = 100 mm
    expect(v.x).toBeCloseTo(100, 5);
    expect(v.x).toBe(v.y);
    expect(v.y).toBe(v.z);
  });
});

describe("extractTechnical", () => {
  it("maps FDM and SLA/SLS technology", () => {
    expect(extractTechnical({ technology: "FDM", specs: {} }).technology).toBe(
      "fdm",
    );
    expect(extractTechnical({ technology: "SLA", specs: {} }).technology).toBe(
      "resin",
    );
    expect(extractTechnical({ technology: "SLS", specs: {} }).technology).toBe(
      "resin",
    );
    expect(
      extractTechnical({ technology: "UNKNOWN", specs: {} }).technology,
    ).toBeUndefined();
  });

  it("keeps real build dimensions when present", () => {
    const t = extractTechnical({
      technology: "SLA",
      specs: { build_volume_mm: { x: 10, y: 20, z: 30 } },
    });
    expect(t.buildVolumeMm).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("derives an approximate cube from cm³ when dimensions are absent", () => {
    const t = extractTechnical({
      technology: "FDM",
      specs: { build_volume_cm3: 8000 },
    });
    // 8000 cm³ = 8e6 mm³ -> side = 200 mm
    expect(t.buildVolumeMm).toBeDefined();
    expect(t.buildVolumeMm.x).toBeCloseTo(200, 3);
  });

  it("never exposes swordlab economic or power fields", () => {
    const t = extractTechnical({
      technology: "FDM",
      specs: { power_w: 1000, heater_power_w: 350 },
      cost: { typical_price_eur: 300, maintenance_eur_year: 40 },
    });
    expect(Object.keys(t)).not.toContain("power");
    expect(Object.keys(t)).not.toContain("cost");
    expect(t.nozzleDiameterMm).toBeUndefined();
  });
});

describe("matchPrinter", () => {
  it("matches an exact manufacturer+model", () => {
    const hit = matchPrinter({ brand: "Bambu Lab", name: "P1S" }, SW_FIXTURE);
    expect(hit?.model).toBe("P1S");
  });

  it("matches despite casing and spacing variants", () => {
    const hit = matchPrinter(
      { brand: "Anycubic", name: "Photon M3" },
      SW_FIXTURE,
    );
    expect(hit?.model).toBe("PHOTON M3");
  });

  it("matches a concatenated model name (partial/prefix match)", () => {
    // swordlab "SATURN3" vs app "Saturn 3"
    const hit = matchPrinter({ brand: "Elegoo", name: "Saturn 3" }, SW_FIXTURE);
    expect(hit?.model).toBe("SATURN3");
  });

  it("matches across brand case/spelling variants (QIDI vs Qidi)", () => {
    const hit = matchPrinter(
      { brand: "Qidi Tech", name: "X-Plus 3" },
      SW_FIXTURE,
    );
    expect(hit?.model).toBe("X-Plus 3");
  });

  it("picks the shortest prefix match to avoid over-matching a variant", () => {
    // "Ender 3 V3 SE" should match the SE entry, not a longer superstring.
    const hit = matchPrinter(
      { brand: "Creality", name: "Ender 3 V3 SE" },
      SW_FIXTURE,
    );
    expect(hit?.model).toBe("Ender 3 V3 SE");
  });

  it("returns null when only the brand matches", () => {
    const hit = matchPrinter(
      { brand: "Creality", name: "Ender 5 Neo" },
      SW_FIXTURE,
    );
    expect(hit).toBeNull();
  });

  it("returns null for unknown manufacturers", () => {
    const hit = matchPrinter({ brand: "AnkerMake", name: "M5" }, SW_FIXTURE);
    expect(hit).toBeNull();
  });
});

describe("enrich", () => {
  const appPrinter = {
    id: "bambu_p1s",
    brand: "Bambu Lab",
    name: "P1S",
    power: 350,
    value: 5500,
    usefulLife: 4000,
    maintenancePerHour: 0.4,
  };

  it("merges technical fields", () => {
    const src = matchPrinter(appPrinter, SW_FIXTURE);
    expect(src).not.toBeNull();
    const out = enrich(appPrinter, src);
    expect(out.technology).toBe("fdm");
    expect(out.buildVolumeMm).toBeDefined();
  });

  it("NEVER overwrites the app's economic data", () => {
    const out = enrich(appPrinter, matchPrinter(appPrinter, SW_FIXTURE));
    expect(out.value).toBe(5500);
    expect(out.power).toBe(350);
    expect(out.usefulLife).toBe(4000);
    expect(out.maintenancePerHour).toBe(0.4);
  });

  it("fills a fallback image by technology when none exists", () => {
    const out = enrich({ ...appPrinter }, matchPrinter(appPrinter, SW_FIXTURE));
    expect(out.image).toBe("/images/printers/fallback-fdm.svg");
  });

  it("uses the resin fallback for SLA printers", () => {
    const p = { id: "photon", brand: "Anycubic", name: "Photon M3" };
    const out = enrich(p, matchPrinter(p, SW_FIXTURE));
    expect(out.image).toBe("/images/printers/fallback-resin.svg");
  });

  it("keeps an existing image untouched", () => {
    const out = enrich(
      {
        ...appPrinter,
        image: "/images/printers/brands/bambu-lab/bambu-lab-p1s-card-300.png",
      },
      matchPrinter(appPrinter, SW_FIXTURE),
    );
    expect(out.image).toBe(
      "/images/printers/brands/bambu-lab/bambu-lab-p1s-card-300.png",
    );
  });

  it("leaves technical fields absent when there is no match", () => {
    const p = {
      id: "m5",
      brand: "AnkerMake",
      name: "M5",
      value: 3500,
      power: 300,
    };
    const out = enrich(p, matchPrinter(p, SW_FIXTURE));
    expect(out.technology).toBeUndefined();
    expect(out.buildVolumeMm).toBeUndefined();
    expect(out.value).toBe(3500);
  });

  it("infers technology by name when the brand is absent from the catalog", () => {
    const p = { id: "sl1s", brand: "Prusa", name: "SL1S Speed" };
    const out = enrich(p, matchPrinter(p, SW_FIXTURE));
    expect(out.image).toBe("/images/printers/fallback-resin.svg");
  });
});

describe("fallbackImage", () => {
  it("honors explicit technology", () => {
    expect(fallbackImage({ technology: "resin" })).toBe(
      "/images/printers/fallback-resin.svg",
    );
    expect(fallbackImage({ technology: "fdm" })).toBe(
      "/images/printers/fallback-fdm.svg",
    );
  });

  it("infers resin from known model families", () => {
    expect(fallbackImage({ brand: "Elegoo", name: "Saturn 3" })).toBe(
      "/images/printers/fallback-resin.svg",
    );
    expect(fallbackImage({ brand: "Anycubic", name: "Photon M3" })).toBe(
      "/images/printers/fallback-resin.svg",
    );
    expect(fallbackImage({ brand: "Creality", name: "Halot Sky" })).toBe(
      "/images/printers/fallback-resin.svg",
    );
  });

  it("defaults to FDM", () => {
    expect(fallbackImage({ brand: "Creality", name: "Ender 3 V3" })).toBe(
      "/images/printers/fallback-fdm.svg",
    );
  });
});

describe("inferTechnology", () => {
  it("classifies known resin model families", () => {
    expect(inferTechnology({ name: "Photon M3" })).toBe("resin");
    expect(inferTechnology({ name: "Saturn 3" })).toBe("resin");
    expect(inferTechnology({ name: "SL1S Speed" })).toBe("resin");
    expect(inferTechnology({ name: "Halot Sky" })).toBe("resin");
  });

  it("defaults to FDM for anything else", () => {
    expect(inferTechnology({ name: "Ender 3 V3" })).toBe("fdm");
    expect(inferTechnology({ name: "K1 Max" })).toBe("fdm");
  });

  it("does not treat the FlashForge BRAND as the resin family 'forge'", () => {
    // Regression: "flashFORGE" matched the 'forge' resin pattern when the
    // whole "brand model" string was scanned. Now only the model is scanned.
    expect(inferTechnology({ name: "Guider 3" })).toBe("fdm");
    expect(inferTechnology({ name: "Adventurer 4" })).toBe("fdm");
    expect(inferTechnology({ name: "Finder 3" })).toBe("fdm");
  });

  it("still recognizes 'Forge' when it is the actual model", () => {
    expect(inferTechnology({ name: "Forge" })).toBe("resin");
  });
});

describe("enrich — websiteUrl", () => {
  it("adds the official manufacturer site when known", () => {
    const out = enrich({ brand: "Bambu Lab", name: "P1S" }, null);
    expect(out.websiteUrl).toBe("https://bambulab.com");
  });

  it("leaves websiteUrl absent for unknown brands (e.g. custom)", () => {
    const out = enrich({ brand: "Outra", name: "Personalizada" }, null);
    expect(out.websiteUrl).toBeUndefined();
  });

  it("never overwrites an existing websiteUrl", () => {
    const out = enrich(
      { brand: "Prusa", name: "MK4", websiteUrl: "https://example.com" },
      null,
    );
    expect(out.websiteUrl).toBe("https://example.com");
  });
});
