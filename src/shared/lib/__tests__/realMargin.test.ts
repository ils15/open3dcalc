import { describe, expect, it } from "vitest";

import {
  deriveRealMarginPercent,
  formatRealMarginPercent,
} from "../realMargin";

describe("deriveRealMarginPercent", () => {
  it("derives net margin as profit divided by the sell price", () => {
    expect(deriveRealMarginPercent(25, 100)).toBe(25);
    expect(deriveRealMarginPercent(45, 90)).toBe(50);
  });

  it("keeps negative profit as a negative real margin", () => {
    expect(deriveRealMarginPercent(-15, 100)).toBe(-15);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns null for an invalid sell price (%s)",
    (sellPrice) => {
      expect(deriveRealMarginPercent(25, sellPrice)).toBeNull();
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "returns null for an invalid profit (%s)",
    (profit) => {
      expect(deriveRealMarginPercent(profit, 100)).toBeNull();
    },
  );
});

describe("formatRealMarginPercent", () => {
  it("formats a valid derived margin with a percentage sign", () => {
    expect(formatRealMarginPercent(25, "en-US")).toBe("25%");
  });

  it("uses the supplied safe placeholder for an unavailable margin", () => {
    expect(formatRealMarginPercent(null, "en-US", "—")).toBe("—");
  });
});
