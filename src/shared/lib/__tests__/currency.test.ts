import { describe, expect, it } from "vitest";

import { formatCurrency, INVALID_CURRENCY_MARKER } from "@/shared/lib/currency";

describe("formatCurrency", () => {
  it("formats finite zero as a real zero value", () => {
    expect(formatCurrency(0, "BRL")).toContain("0,00");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "returns the invalid-value marker for non-finite input (%s)",
    (value) => {
      expect(formatCurrency(value, "BRL")).toBe(INVALID_CURRENCY_MARKER);
    },
  );
});
