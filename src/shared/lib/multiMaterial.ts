import type { AMSSlot } from "@/shared/types";

/**
 * Returns true only when multi-material is enabled and has a real material
 * weight in at least one enabled slot.
 */
export function isMultiMaterialActive(
  enabled: boolean | undefined,
  slots: readonly AMSSlot[] | undefined,
): boolean {
  return (
    enabled === true &&
    (slots?.some(
      (slot) =>
        slot.enabled &&
        Number.isFinite(slot.weightUsedGrams) &&
        slot.weightUsedGrams > 0,
    ) ?? false)
  );
}
