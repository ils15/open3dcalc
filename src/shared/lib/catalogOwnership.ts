import { materials } from "@/shared/lib/materials";
import { marketplaces } from "@/shared/lib/marketplace";

type CatalogOwnershipIdentity = { id: string; custom?: boolean };

const BUILTIN_MATERIAL_IDS = new Set(materials.map((m) => m.id));
const BUILTIN_MARKETPLACE_IDS = new Set(marketplaces.map((m) => m.id));

/**
 * "Meus X | Biblioteca" ownership test for catalog entities — the same
 * contract as `isPersonalPrinter`: an explicit `custom` flag wins, and a
 * missing flag falls back to "not in the shipped seed" so legacy entries
 * with user-generated ids still count as personal.
 */
export function isPersonalMaterial(
  material: CatalogOwnershipIdentity,
): boolean {
  return (
    material.custom === true ||
    (material.custom === undefined && !BUILTIN_MATERIAL_IDS.has(material.id))
  );
}

export function isPersonalMarketplace(
  marketplace: CatalogOwnershipIdentity,
): boolean {
  return (
    marketplace.custom === true ||
    (marketplace.custom === undefined &&
      !BUILTIN_MARKETPLACE_IDS.has(marketplace.id))
  );
}
