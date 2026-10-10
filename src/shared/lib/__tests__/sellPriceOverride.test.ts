import { describe, it, expect } from "vitest";
import { reverseFromSellPrice } from "../sellPriceOverride";

describe("reverseFromSellPrice", () => {
  it("derives tax, fee, profit and margins from an overridden sell price", () => {
    // S=100, base=60, tax 10%, fee 5% → tax=10, fee=5, profit=25
    const r = reverseFromSellPrice(100, 60, 10, 5);
    expect(r.sellPrice).toBe(100);
    expect(r.baseCost).toBe(60);
    expect(r.taxAmount).toBeCloseTo(10, 2);
    expect(r.marketplaceFee).toBeCloseTo(5, 2);
    expect(r.profit).toBeCloseTo(25, 2);
    expect(r.marginReal).toBeCloseTo(25, 2);
    expect(r.markupEffective).toBeCloseTo(41.67, 2);
    expect(r.belowBreakEven).toBe(false);
  });

  it("flags the price as below break-even when S < base", () => {
    const r = reverseFromSellPrice(50, 60, 10, 5);
    expect(r.belowBreakEven).toBe(true);
    // 50 - 60 - 5 - 2.5 = -17.5
    expect(r.profit).toBeCloseTo(-17.5, 2);
    expect(r.marginReal).toBeCloseTo(-35, 2);
  });

  it("does not flag break-even itself as below", () => {
    const r = reverseFromSellPrice(60, 60, 10, 5);
    expect(r.belowBreakEven).toBe(false);
  });

  it("includes the marketplace fixed fee and keeps an exact break-even at zero profit", () => {
    // S=(100+5)/(1-10%-10%) = 131.25
    const r = reverseFromSellPrice(131.25, 100, 10, 10, 5);
    expect(r.taxAmount).toBe(13.13);
    expect(r.marketplaceFee).toBe(18.13);
    expect(r.profit).toBe(0);
    expect(r.marginReal).toBe(0);
  });

  it("never returns NaN margins for zero sell price", () => {
    const r = reverseFromSellPrice(0, 60, 10, 5);
    expect(r.marginReal).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.marketplaceFee).toBe(0);
    expect(r.profit).toBeCloseTo(-60, 2);
  });

  it("never returns NaN markup for zero base cost", () => {
    const r = reverseFromSellPrice(100, 0, 10, 5);
    expect(r.markupEffective).toBe(0);
    expect(r.profit).toBeCloseTo(85, 2);
    expect(r.belowBreakEven).toBe(false);
  });

  it("sanitizes non-finite inputs to zero", () => {
    const r = reverseFromSellPrice(NaN, 60, 10, 5);
    expect(r.sellPrice).toBe(0);
    expect(r.profit).toBeCloseTo(-60, 2);
    const r2 = reverseFromSellPrice(100, 60, NaN, Infinity);
    expect(r2.taxAmount).toBe(0);
    expect(r2.marketplaceFee).toBe(0);
    expect(r2.profit).toBeCloseTo(40, 2);
    const r3 = reverseFromSellPrice(100, 60, 10, 5, Infinity);
    expect(r3.marketplaceFee).toBe(5);
    expect(r3.profit).toBeCloseTo(25, 2);
  });
});
