import { useState } from "react";
import { Store } from "lucide-react";
import { resolveMarketplaceImageSource } from "./marketplaceImageSource";

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
  const imageSource = resolveMarketplaceImageSource(source) ?? "";
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
