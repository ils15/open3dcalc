import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { DataSyncModal } from "./DataSyncModal";

interface DataSyncButtonProps {
  /**
   * "menu" renders a full-width settings-sheet item (icon + label);
   * "icon" renders a compact header action button matching ThemeToggle.
   */
  variant?: "menu" | "icon";
  /** When true on the "icon" variant, renders an icon-only 44x44 button (keeping aria-label & title). */
  hideLabel?: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Button that opens the DataSyncModal. Supports two variants:
 * - "menu": full-width settings-sheet entry (icon + label)
 * - "icon": compact header action button (icon + optional label, tooltip/aria-label)
 */
export function DataSyncButton({
  variant = "menu",
  hideLabel = false,
  className = "",
  onOpenChange,
}: DataSyncButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    onOpenChange?.(true);
  };

  const handleClose = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  const isIcon = variant === "icon";
  const isCompactIcon = isIcon && hideLabel;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("sync.title")}
        title={t("sync.title")}
        className={
          isIcon
            ? `flex items-center justify-center ${
                isCompactIcon ? "px-2.5 py-2.5" : "gap-1.5 px-3.5 py-2.5"
              } min-h-[44px] min-w-[44px] whitespace-nowrap rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] ${className}`
            : `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none min-h-[48px] ${className}`
        }
      >
        <RefreshCw
          className={
            isCompactIcon
              ? "w-4 h-4 shrink-0"
              : isIcon
                ? "w-5 h-5 shrink-0"
                : "w-[18px] h-[18px] shrink-0 text-[var(--accent)]"
          }
        />
        {!isCompactIcon &&
          (isIcon ? (
            <span className="hidden sm:inline text-[13px] font-semibold">
              {t("sync.title")}
            </span>
          ) : (
            <span className="text-sm font-medium">{t("sync.title")}</span>
          ))}
      </button>

      <DataSyncModal open={open} onRequestClose={handleClose} />
    </>
  );
}
