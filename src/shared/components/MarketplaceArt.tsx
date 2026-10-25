import { useState } from "react";
import { Store } from "lucide-react";
import { marketplaces } from "@/shared/lib/marketplace";

// Only the shipped seed artwork may render: custom channel logos entered by
// users are data, not assets, and never hit the img path.
const SHIPPED_MARKETPLACE_LOGOS = new Set(
  marketplaces.flatMap((marketplace) =>
    marketplace.logo ? [marketplace.logo] : [],
  ),
);

interface MarketplaceArtProps {
  source?: string;
  className?: string;
}

/**
 * Marketplace channel artwork (original stylized bag silhouettes, not
 * registered trademarks) with a neutral Store-icon fallback.
 */
export function MarketplaceArt({
  source,
  className = "",
}: MarketplaceArtProps): React.ReactElement {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Only shipped seed artwork resolves; anything else (custom user channels,
  // unknown paths) falls back to the Store icon.
  const normalized = source?.trim();
  const allowed = normalized
    ? SHIPPED_MARKETPLACE_LOGOS.has(normalized)
    : false;
  const baseUrl = import.meta.env.BASE_URL;
  const imageSource = allowed
    ? baseUrl === "/"
      ? (normalized ?? "")
      : `${baseUrl.replace(/\/?$/, "/")}${normalized?.slice(1)}`
    : "";
  const showImage = Boolean(imageSource) && failedSource !== imageSource;

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] ${className}`}
    >
      {showImage ? (
        <img
          src={imageSource}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(imageSource)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <Store className="h-1/2 w-1/2" />
      )}
    </span>
  );
}
