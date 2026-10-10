/**
 * Minimum effective content width for the compact three-column layout:
 * 7rem section rail + 32rem form + 18rem results + 1rem in grid gaps.
 */
export const CALCULATOR_THREE_REGION_MIN_REM = 58;

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
