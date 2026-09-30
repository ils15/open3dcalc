import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { CURRENCIES, type CurrencyCode } from "@/shared/lib/currency";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";

/**
 * The currency control: a trigger that opens a `role="menu"` of units, closing
 * on outside click / Escape via `useDismissablePopover`.
 *
 * IT IS SHARED, AND THAT IS A MERGE, NOT A NEW ABSTRACTION. The web and desktop
 * headers each carried their own copy, and the two were byte-identical modulo
 * token NAME: `text-[var(--color-text-secondary)]` on desktop is
 * `text-[var(--text-secondary)]` on web because `tokens.css:480` declares
 * `--color-text-secondary: var(--text-secondary)` (and likewise
 * `--color-border` → `--border-subtle`, `--color-bg-hover` → `--surface-sunken`,
 * `--color-accent` → `--accent`). Rendering the `--*` family therefore produces
 * the same pixels in both shells, and ninety duplicated lines became one.
 *
 * What genuinely differed was where the SETTING came from — the web shell reads
 * `calculatorStore`, the desktop one a `CurrencyContext` — so that stays a prop
 * and each shell keeps wiring its own store. Only the presentational half is
 * shared.
 *
 * `hidden sm:inline` on the "auto" marker is the web shell's rule, kept as
 * written. In the band it is always satisfied, because the band itself is
 * `hidden lg:block`: below `lg` neither this nor the band is rendered, and the
 * mobile settings sheet carries the currency row instead. So the marker reads
 * exactly as it does in the desktop header today.
 *
 * The menu is PORTALED to `document.body` and positioned from the trigger's
 * measured rect, because the band is `overflow-x-auto`: an in-flow panel would
 * be clipped by the row that scrolls. That is the same reason the original
 * portal lived where it did, and it is why the panel is `fixed`.
 *
 * The `id` is unchanged from the header copy (`header-currency-menu`) because
 * `Header.test.tsx:133,237,244` asserts it, and `aria-controls` on the trigger
 * is the other half of that pairing.
 */
interface CurrencySelectProps {
  /** The current unit, or `"auto"` to follow the locale. */
  setting: CurrencyCode | "auto";
  /** Called with the new unit; the shell owns the store write. */
  onChange: (next: CurrencyCode | "auto") => void;
}

export function CurrencySelect({
  setting,
  onChange,
}: CurrencySelectProps): React.ReactElement {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const { open, toggle, triggerRef, contentRef } =
    useDismissablePopover<HTMLButtonElement>();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    toggle();
  };

  return (
    <div className="flex items-center">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="header-currency-menu"
        className="flex min-w-[80px] shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[13px] font-semibold px-3 py-2.5 rounded-lg min-h-[44px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        title={t("settings.currency")}
        aria-label={t("settings.currency")}
      >
        <span className="font-mono">{symbol}</span>
        {setting === "auto" && (
          <span className="hidden sm:inline text-[10px] text-[var(--text-muted)] font-normal">
            auto
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-40" />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={contentRef}
            id="header-currency-menu"
            role="menu"
            aria-label={t("settings.currency")}
            className="fixed w-44 rounded-xl shadow-2xl overflow-hidden surface border border-[var(--border-subtle)]"
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              // --z-dropdown, where every other menu lives. This was a bare
              // z-[60] — a magic literal that merely happened to equal a
              // declared step, which is how two surfaces ended up filed as
              // modals. Unreachable in Focus Mode (the Header unmounts there,
              // and the band is inside it), so it was never an occlusion bug,
              // but it was drift waiting to become one.
              zIndex: "var(--z-dropdown)",
            }}
          >
            <button
              role="menuitem"
              onClick={() => {
                onChange("auto");
                toggle();
              }}
              className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--surface-sunken)] transition-colors ${setting === "auto" ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
            >
              <span className="font-mono font-bold w-6">{symbol}</span>
              <span>{t("settings.currencyAuto")}</span>
              {setting === "auto" && (
                <span className="text-[var(--accent)]">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </button>
            <div className="border-t border-[var(--border-subtle)]" />
            {(
              Object.entries(CURRENCIES) as [
                CurrencyCode,
                (typeof CURRENCIES)[CurrencyCode],
              ][]
            ).map(([code, info]) => (
              <button
                key={code}
                role="menuitem"
                onClick={() => {
                  onChange(code);
                  toggle();
                }}
                className={`w-full px-3.5 py-2.5 text-left text-[12px] flex items-center gap-2 hover:bg-[var(--surface-sunken)] transition-colors ${setting === code ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
              >
                <span className="font-mono font-bold w-6">{info.symbol}</span>
                <span>{code}</span>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                  {info.name}
                </span>
                {setting === code && (
                  <span className="text-[var(--accent)] ml-1">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
