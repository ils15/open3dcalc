import { marketplaces } from "@/shared/lib/marketplace";

// Only the shipped seed artwork may render: custom channel logos entered by
// users are data, not assets, and never hit the img path.
const SHIPPED_MARKETPLACE_LOGOS = new Set(
  marketplaces.flatMap((marketplace) =>
    marketplace.logo ? [marketplace.logo] : [],
  ),
);

/**
 * Resolve a marketplace logo path to a URL, or null when the source is not
 * shipped seed artwork (custom user channels never hit the img path).
 * Single source for both the workshop manager and the calculator's channel
 * comparison — previously duplicated in CatalogTab and MarketplaceArt.
 */
export function resolveMarketplaceImageSource(
  source: string | undefined,
): string | null {
  const normalized = source?.trim();
  if (!normalized || !SHIPPED_MARKETPLACE_LOGOS.has(normalized)) return null;
  const baseUrl = import.meta.env.BASE_URL;
  if (baseUrl === "/") return normalized;
  return `${baseUrl.replace(/\/?$/, "/")}${normalized.slice(1)}`;
}
