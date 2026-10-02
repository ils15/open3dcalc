/**
 * Minimum effective content width for three useful tracks:
 * 8rem rail + 32rem form + 18rem results + 3rem of gaps, with 2rem spare.
 */
export const CALCULATOR_THREE_REGION_MIN_REM = 63;

export function hasCalculatorRailSpace(
  availableWidthPx: number,
  rootFontSizePx: number,
): boolean {
  return (
    Number.isFinite(availableWidthPx) &&
    Number.isFinite(rootFontSizePx) &&
    rootFontSizePx > 0 &&
    availableWidthPx >= CALCULATOR_THREE_REGION_MIN_REM * rootFontSizePx
  );
}
