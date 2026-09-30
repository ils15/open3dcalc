import { describe, expect, it } from "vitest";

import {
  LEVEL_SECTIONS,
  OUTPUT_SECTION_IDS,
  sectionStepNumbers,
} from "../Calculator.constants";

describe("section step numbering", () => {
  it("numbers the visible set, so the first level runs 1..N and not 1,4,7,10", () => {
    // "Rápido" shows material, print, sales and results. The three input
    // sections are steps 1..3 — not 1, 4 and 7 of the full ten.
    const steps = sectionStepNumbers("basic");

    expect(steps.get("material")).toBe(1);
    expect(steps.get("print")).toBe(2);
    expect(steps.get("sales")).toBe(3);
    expect(steps.size).toBe(3);
  });

  it("numbers 1..N at every level without ever exceeding the visible count", () => {
    for (const level of ["basic", "intermediate", "advanced"] as const) {
      const steps = sectionStepNumbers(level);
      const visible = LEVEL_SECTIONS[level].filter(
        (id) => !OUTPUT_SECTION_IDS.includes(id),
      );

      expect(steps.size, `${level} numbers every visible input section`).toBe(
        visible.length,
      );
      // Contiguous from 1 with no gaps: the last step is N, the size of the set.
      expect([...steps.values()].sort((a, b) => a - b)).toEqual(
        visible.map((_, i) => i + 1),
      );
    }
  });

  it("leaves the output section unnumbered", () => {
    for (const level of ["basic", "intermediate", "advanced"] as const) {
      expect(sectionStepNumbers(level).has("results")).toBe(false);
    }
  });

  it("keeps a section's number stable across levels that both show it", () => {
    // material is the first visible section at every level, so it must not
    // drift; sales moves because the set grows, which is the intended reading.
    expect(sectionStepNumbers("basic").get("material")).toBe(
      sectionStepNumbers("advanced").get("material"),
    );
    expect(sectionStepNumbers("advanced").get("sales")).toBe(9);
  });
});
