import type { ReactNode } from "react";

export interface SidebarGroupProps {
  /** Already-translated group label. */
  readonly label: string;
  readonly children: ReactNode;
  /**
   * The tablet strip is `w-16` with ~47px of usable width, which cannot hold
   * "Navegação" or "Links úteis" without truncating to noise. There the label
   * is kept for assistive technology only and the strip stays icon-only.
   */
  readonly labelVisible?: boolean;
}

/**
 * A named block of sidebar items.
 *
 * The grouping is semantic rather than decorative: each block is a labelled
 * region, so a screen-reader user hears which group an item belongs to instead
 * of one undifferentiated list of ten links.
 */
export function SidebarGroup({
  label,
  children,
  labelVisible = true,
}: SidebarGroupProps): React.ReactElement {
  return (
    <section
      aria-label={label}
      // The label is always the accessible name, so the region is a landmark
      // whether or not the text is painted. A landmark and a visible heading
      // that disagree is worse than either alone.
      className={labelVisible ? "flex flex-col gap-1" : "contents"}
    >
      {labelVisible ? (
        <p className="label-xs px-3 mb-2">{label}</p>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      {children}
    </section>
  );
}
