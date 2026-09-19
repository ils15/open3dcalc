import { describe, it, expect } from "vitest";
import {
  compareMaterialsForPart,
  type MaterialComparisonInput,
  type MaterialComparisonRow,
} from "@/shared/lib/compareMaterials";
import type { Material } from "@/shared/types";

const PLA: Material = {
  id: "pla",
  name: "PLA",
  density: 1.24,
  avgPrice: 90,
  type: "fdm",
};
const ABS: Material = {
  id: "abs",
  name: "ABS",
  density: 1.04,
  avgPrice: 100,
  type: "fdm",
};
const PETG: Material = {
  id: "petg",
  name: "PETG",
  density: 1.27,
  avgPrice: 110,
  type: "fdm",
};

function rowById(
  rows: MaterialComparisonRow[],
  id: string,
): MaterialComparisonRow {
  const r = rows.find((row) => row.id === id);
  if (!r) throw new Error(`row ${id} missing`);
  return r;
}

describe("compareMaterialsForPart", () => {
  it("weighs each material from the same volume (ABS is lighter than PLA)", () => {
    const rows = compareMaterialsForPart({ volumeCm3: 100 }, [PLA, ABS]);
    expect(rowById(rows, "pla").weightGrams).toBeCloseTo(124, 6); // 100 * 1.24
    expect(rowById(rows, "abs").weightGrams).toBeCloseTo(104, 6); // 100 * 1.04
    expect(rowById(rows, "abs").weightGrams).toBeLessThan(
      rowById(rows, "pla").weightGrams,
    );
  });

  it("keeps a fixed weight when the caller passes weightGrams instead", () => {
    const rows = compareMaterialsForPart({ weightGrams: 100 }, [PLA, ABS]);
    expect(rowById(rows, "pla").weightGrams).toBe(100);
    expect(rowById(rows, "abs").weightGrams).toBe(100);
  });

  it("prefers an explicit weightGrams over volumeCm3", () => {
    const rows = compareMaterialsForPart({ volumeCm3: 100, weightGrams: 50 }, [
      PLA,
      ABS,
    ]);
    expect(rowById(rows, "pla").weightGrams).toBe(50);
    expect(rowById(rows, "abs").weightGrams).toBe(50);
  });

  it("ranks rows by part cost, ascending", () => {
    const rows = compareMaterialsForPart({ volumeCm3: 100 }, [PLA, ABS, PETG]);
    // PLA: 124 g * 0.09 = 11.16 | ABS: 104 g * 0.10 = 10.40 | PETG: 127 g * 0.11 = 13.97
    expect(rows.map((r) => r.id)).toEqual(["abs", "pla", "petg"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.materialCost)).toEqual([
      100 * 1.04 * (100 / 1000),
      100 * 1.24 * (90 / 1000),
      100 * 1.27 * (110 / 1000),
    ]);
  });

  it("derives costPerGram from the price per kilogram", () => {
    const rows = compareMaterialsForPart({ volumeCm3: 100 }, [PLA, ABS]);
    expect(rowById(rows, "pla").costPerGram).toBeCloseTo(0.09, 6);
    expect(rowById(rows, "abs").costPerGram).toBeCloseTo(0.1, 6);
  });

  it("scales the cost by the quantity multiplier", () => {
    const single = compareMaterialsForPart({ volumeCm3: 100 }, [PLA]);
    const triple = compareMaterialsForPart({ volumeCm3: 100, quantity: 3 }, [
      PLA,
    ]);
    expect(rowById(triple, "pla").materialCost).toBeCloseTo(
      rowById(single, "pla").materialCost * 3,
      6,
    );
  });

  it("applies the global failure rate uniformly to every material", () => {
    const rows = compareMaterialsForPart(
      { volumeCm3: 100, failureRatePercent: 100 },
      [PLA, ABS],
    );
    // +100% de falha dobra o custo da peça para todos os materiais
    expect(rowById(rows, "pla").materialCost).toBeCloseTo(11.16 * 2, 6);
    expect(rowById(rows, "abs").materialCost).toBeCloseTo(10.4 * 2, 6);
    const base = compareMaterialsForPart({ volumeCm3: 100 }, [PLA, ABS]);
    expect(rows.map((r) => r.materialCost)).toEqual(
      base.map((r) => r.materialCost * 2),
    );
  });

  it("keeps the same ranking order with a positive failure rate", () => {
    const rows = compareMaterialsForPart(
      { volumeCm3: 100, failureRatePercent: 25 },
      [PLA, ABS, PETG],
    );
    expect(rows.map((r) => r.id)).toEqual(["abs", "pla", "petg"]);
  });

  it("defaults quantity to 1 and failure rate to 0 when omitted", () => {
    const rows = compareMaterialsForPart({ volumeCm3: 100 }, [PLA]);
    expect(rowById(rows, "pla").materialCost).toBeCloseTo(11.16, 6);
  });

  it("treats a non-positive or invalid quantity/failure rate as the default", () => {
    const rows = compareMaterialsForPart(
      { volumeCm3: 100, quantity: Number.NaN, failureRatePercent: -10 },
      [PLA],
    );
    expect(rowById(rows, "pla").materialCost).toBeCloseTo(11.16, 6);
  });

  it("marks every row invalid when there is no volume and no weight", () => {
    const rows = compareMaterialsForPart({}, [PLA, ABS]);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.isValid).toBe(false);
      expect(r.name).toBe("—");
      expect(Number.isNaN(r.weightGrams)).toBe(true);
      expect(Number.isNaN(r.materialCost)).toBe(true);
    }
  });

  it("marks rows invalid for null/NaN/zero volume", () => {
    for (const volumeCm3 of [null, Number.NaN, 0]) {
      const rows = compareMaterialsForPart(
        { volumeCm3: volumeCm3 as number | null },
        [PLA],
      );
      expect(rowById(rows, "pla").isValid).toBe(false);
    }
  });

  it("marks a material row invalid when its own data is broken", () => {
    const broken: Material = {
      id: "broken",
      name: "Broken",
      density: Number.NaN,
      avgPrice: 200,
      type: "fdm",
    };
    const rows = compareMaterialsForPart({ volumeCm3: 100 }, [
      PLA,
      broken,
      ABS,
    ]);
    // válidos primeiro, ordenados por custo; o quebrado vai ao final
    expect(rows.map((r) => r.id)).toEqual(["abs", "pla", "broken"]);
    expect(rowById(rows, "broken").isValid).toBe(false);
    expect(rowById(rows, "broken").name).toBe("—");
    expect(rowById(rows, "broken").rank).toBe(3);
    expect(rowById(rows, "abs").rank).toBe(1);
    expect(rowById(rows, "pla").rank).toBe(2);
  });

  it("is pure: the same input always yields the same output", () => {
    const input: MaterialComparisonInput = { volumeCm3: 100, quantity: 2 };
    expect(compareMaterialsForPart(input, [PLA, ABS])).toEqual(
      compareMaterialsForPart(input, [PLA, ABS]),
    );
  });

  it("returns an empty array for an empty material list", () => {
    expect(compareMaterialsForPart({ volumeCm3: 100 }, [])).toEqual([]);
  });
});
