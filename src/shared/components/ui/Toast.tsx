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

const typeStyles: Record<ToastItem["type"], string> = {
  error:
    "bg-[var(--color-danger)]/90 border-red-500/30 text-[var(--color-text-primary)]",
  success:
    "bg-[var(--color-success)]/90 border-emerald-500/30 text-[var(--color-text-primary)]",
  info: "bg-[var(--color-accent)]/90 border-[var(--color-accent-muted)] text-[var(--color-text-primary)]",
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
