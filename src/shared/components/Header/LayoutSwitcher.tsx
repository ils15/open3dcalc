import { useTranslation } from "react-i18next";
import {
  Grid3x3,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { useLayoutStore, type LayoutMode } from "@/shared/stores/layoutStore";

interface LayoutOption {
  mode: LayoutMode;
  labelKey: string;
  icon: LucideIcon;
}

const LAYOUT_OPTIONS: readonly LayoutOption[] = [
  { mode: "classic", labelKey: "layoutSwitcher.classic", icon: LayoutGrid },
  { mode: "guided", labelKey: "layoutSwitcher.guided", icon: ListChecks },
  { mode: "bento", labelKey: "layoutSwitcher.bento", icon: Grid3x3 },
];

export interface LayoutSwitcherProps {
  className?: string;
  /** Show labels at every breakpoint (useful inside the mobile settings sheet). */
  showLabels?: boolean;
}

/**
 * Header control for the persisted calculator layout preference.
 *
 * The buttons intentionally call the dedicated layout store only. In
 * particular, selecting bento is safe today: CalculatorSurface keeps its
 * classic fallback until the BentoSurface wave lands.
 */
export function LayoutSwitcher({
  className = "",
  showLabels = false,
}: LayoutSwitcherProps): React.ReactElement {
  const { t } = useTranslation();
  const layoutMode = useLayoutStore((state) => state.layoutMode);
  const setLayoutMode = useLayoutStore((state) => state.setLayoutMode);

  return (
    <div
      role="group"
      aria-label={t("layoutSwitcher.ariaLabel")}
      className={`inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1 ${className}`}
    >
      {LAYOUT_OPTIONS.map(({ mode, labelKey, icon: Icon }) => {
        const isActive = layoutMode === mode;
        const label = t(labelKey);

        return (
          <button
            key={mode}
            type="button"
            data-layout-mode={mode}
            aria-label={label}
            aria-current={isActive ? "true" : undefined}
            aria-pressed={isActive}
            onClick={() => setLayoutMode(mode)}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
              isActive
                ? "bg-[var(--accent)] text-[var(--text-inverse)] shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={showLabels ? "whitespace-nowrap" : "hidden lg:inline"}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
