/**
 * Display-only formatting helpers for numeric inputs.
 *
 * IMPORTANT: these functions are for RENDER ONLY. Callers must keep full
 * precision in the store so downstream math is unaffected — rounding here
 * would silently corrupt calculations.
 */

/**
 * Formats a weight in grams for display, rounding to `decimals` places and
 * trimming trailing zeros (43.073033794858695 -> "43.1", 43.0 -> "43").
 *
 * Non-finite values (NaN, Infinity, null, undefined) return "" so a
 * `type="number"` input stays empty instead of rendering "NaN".
 */
export function formatWeight(grams: number, decimals = 1): string {
  if (!Number.isFinite(grams)) return "";
  return Number(grams.toFixed(decimals)).toString();
}
