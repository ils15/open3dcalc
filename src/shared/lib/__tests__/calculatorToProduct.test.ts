import { describe, it, expect } from "vitest";
import {
  calculatorToProduct,
  isDuplicateProductName,
} from "../calculatorToProduct";

describe("calculatorToProduct", () => {
  it("maps calculator state to product form data (display price included)", () => {
    const data = calculatorToProduct({
      productName: "  Vaso Espiral  ",
      unitWeight: 85.5,
      filamentType: "PLA",
      totalCost: 12.34,
      displaySellPrice: 39.9,
    });
    expect(data).toEqual({
      name: "Vaso Espiral",
      weightGrams: 85.5,
      filamentType: "PLA",
      costPrice: 12.34,
      salePrice: 39.9,
    });
  });

  it("uses the on-screen (override) price as sale price", () => {
    const data = calculatorToProduct({
      productName: "Peça",
      unitWeight: 10,
      filamentType: "PETG",
      totalCost: 5,
      displaySellPrice: 19.99,
    });
    expect(data.salePrice).toBe(19.99);
    expect(data.costPrice).toBe(5);
  });

  it("rounds money/weight to 2 decimals", () => {
    const data = calculatorToProduct({
      productName: "Peça",
      unitWeight: 10.126,
      filamentType: "PLA",
      totalCost: 5.555,
      displaySellPrice: 19.999,
    });
    expect(data.weightGrams).toBe(10.13);
    expect(data.costPrice).toBe(5.56);
    expect(data.salePrice).toBe(20);
  });

  it("throws on empty product name (UI must prompt first)", () => {
    expect(() =>
      calculatorToProduct({
        productName: "   ",
        unitWeight: 10,
        filamentType: "PLA",
        totalCost: 5,
        displaySellPrice: 15,
      }),
    ).toThrow();
  });

  it("clamps negative/non-finite numbers to zero", () => {
    const data = calculatorToProduct({
      productName: "Peça",
      unitWeight: -3,
      filamentType: "PLA",
      totalCost: NaN,
      displaySellPrice: Infinity,
    });
    expect(data.weightGrams).toBe(0);
    expect(data.costPrice).toBe(0);
    expect(data.salePrice).toBe(0);
  });
});

describe("isDuplicateProductName", () => {
  const existing = [{ name: "Vaso Espiral" }, { name: "Suporte Headset" }];

  it("matches case- and whitespace-insensitively", () => {
    expect(isDuplicateProductName("  vaso espiral ", existing)).toBe(true);
    expect(isDuplicateProductName("VASO ESPIRAL", existing)).toBe(true);
  });

  it("returns false when there is no match", () => {
    expect(isDuplicateProductName("Vaso Novo", existing)).toBe(false);
  });

  it("returns false for empty names or empty lists", () => {
    expect(isDuplicateProductName("", existing)).toBe(false);
    expect(isDuplicateProductName("  ", existing)).toBe(false);
    expect(isDuplicateProductName("Vaso", [])).toBe(false);
  });
});
