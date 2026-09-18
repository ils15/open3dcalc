import { describe, it, expect } from "vitest";
import { formatWeight } from "@/shared/lib/format";

// ---------------------------------------------------------------------------
// Peso da Peça display bug: store keeps full float precision, display shows
// 1 decimal without trailing zeros. See MaterialSection weightUsed input.
// ---------------------------------------------------------------------------

describe("formatWeight", () => {
  it("rounds the reported STL weight to 1 decimal", () => {
    expect(formatWeight(43.073033794858695)).toBe("43.1");
  });

  it("trims trailing zeros for integer-valued weights", () => {
    expect(formatWeight(43.0)).toBe("43");
    expect(formatWeight(100)).toBe("100");
  });

  it("returns '0' for a zero weight instead of an empty field", () => {
    expect(formatWeight(0)).toBe("0");
  });

  it("keeps the sign for negative weights", () => {
    expect(formatWeight(-5.27)).toBe("-5.3");
  });

  it("never emits a NaN/Infinity string into a number input", () => {
    expect(formatWeight(NaN)).toBe("");
    expect(formatWeight(Infinity)).toBe("");
    expect(formatWeight(-Infinity)).toBe("");
    // Defensive: store fields typed as number can still arrive null/undefined.
    expect(formatWeight(null as unknown as number)).toBe("");
    expect(formatWeight(undefined as unknown as number)).toBe("");
  });

  it("normalizes negative zero", () => {
    expect(formatWeight(-0)).toBe("0");
  });

  it("respects the decimals argument", () => {
    expect(formatWeight(43.073033794858695, 2)).toBe("43.07");
    expect(formatWeight(43.073033794858695, 0)).toBe("43");
    expect(formatWeight(43.5, 0)).toBe("44");
  });

  it("rounds an in-progress typed value for display while the store keeps precision", () => {
    // User types 45.678 -> store keeps 45.678, display shows "45.7".
    const store = 45.678;
    expect(formatWeight(store)).toBe("45.7");
    expect(store).toBe(45.678); // store precision untouched
  });

  it("does not pad small fractional weights into trailing zeros", () => {
    expect(formatWeight(0.04)).toBe("0");
    expect(formatWeight(0.15)).toBe("0.1");
  });
});
