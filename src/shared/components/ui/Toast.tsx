import { useEffect } from "react";
import { X } from "lucide-react";

export interface ToastItem {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastProps {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}

/**
 * Per-variant background + ink, as a PAIR.
 *
 * These are the `--*-fill` / `--*-fill-fg` families, not the `--color-*`
 * foreground tokens this used to paint. The old form was
 * `bg-[var(--color-danger)]/90 text-[var(--color-text-primary)]`, which failed
 * WCAG AA in BOTH themes: the backdrop came from a FOREGROUND token that is
 * theme-independent while the ink flipped to near-white in `.dark`, so error
 * measured 3.10:1 light / 2.07:1 dark and success 3.84:1 / 2.10:1. A light pink
 * pill behind near-white text is not a contrast miss, it is an unreadable toast.
 *
 * No single text token can fix a backdrop that does not move with the theme,
 * which is the whole reason `--danger-fill-fg` and `--accent-fill-fg` already
 * exist for the dialog and the primary button. So each variant carries its own
 * non-flipping ink over a SOLID fill, declared in both `:root` and `.dark` with
 * identical values.
 *
 * Solid, not `/90`: at 90% alpha the effective colour still depends on whatever
 * is behind the toast, and the toast is `fixed` over arbitrary content, so the
 * pairing would be undecidable rather than merely wrong. A solid fill is decided
 * by the tokens alone — and it is also in reach of `accentBackgroundContrast`,
 * whose scan covers solid backgrounds and skips translucent ones. Leaving the
 * alpha on would have kept this surface in that guard's documented blind spot.
 *
 * The variant colour is the toast's only state distinction — it is not a
 * control, so there is no hover — and the three fills stay far apart in hue so
 * a failure remains tellable from a success.
 */
const typeStyles: Record<ToastItem["type"], string> = {
  error:
    "bg-[var(--color-danger-fill)] border-red-500/30 text-[var(--color-danger-fill-fg)]",
  success:
    "bg-[var(--color-positive-fill)] border-emerald-500/30 text-[var(--color-positive-fill-fg)]",
  info: "bg-[var(--color-accent-fill)] border-[var(--color-accent-muted)] text-[var(--color-accent-fill-fg)]",
};

export function ToastContainer({ items, onDismiss }: ToastProps) {
  return (
    // --z-passive, not the modal tier it used to sit in. A toast owns no scrim,
    // no focus trap and no key — it is `role="region"` and dismisses itself
    // after 4s — so it is not a modal, and at `sm+` it shares the exit's exact
    // top-right anchor (both `sm:top-4 sm:right-4`). Filed at z-50 it painted
    // over the only way out of Focus Mode for four seconds. See the ownership
    // rule in the layering scale in tokens.css.
    <div
      className="fixed bottom-4 left-4 right-4 sm:top-4 sm:right-4 sm:left-auto sm:bottom-auto flex flex-col gap-2 sm:max-w-sm"
      style={{ zIndex: "var(--z-passive)" }}
      role="region"
      aria-label="Notificações"
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-slide-left ${typeStyles[item.type]}`}
      role="alert"
    >
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 focus-visible:outline-none rounded"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
