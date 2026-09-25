import { useRef, useEffect, useReducer } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

type DialogState = "visible" | "closing" | "hidden";
type DialogAction =
  { type: "open" } | { type: "close" } | { type: "closeComplete" };

function dialogReducer(_state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "open":
      return "visible";
    case "close":
      return "closing";
    case "closeComplete":
      return "hidden";
  }
}

/**
 * Each variant owns its OWN foreground. The confirm button used to hardcode
 * `text-[var(--color-text-primary)]` in the shared className and take only its
 * background from here, so no single edit could fix one variant without
 * breaking the others: the `info` variant paints an accent fill, and white ink
 * would have been correct for it while landing 2.49:1 on `warning`'s
 * bg-amber-600. Moving the text token into the map makes each pairing explicit
 * and independently checkable.
 *
 * `info` uses --accent-fill / --accent-fill-fg, not --color-accent: the latter
 * flips to #818cf8 in .dark, which put --text-primary ink at 2.72:1 on it.
 */
const variantStyles = {
  danger: {
    button: "bg-red-600 text-[var(--color-text-primary)] hover:bg-red-500",
    icon: "text-[var(--color-danger)]",
  },
  warning: {
    button: "bg-amber-600 text-[var(--color-text-primary)] hover:bg-amber-500",
    icon: "text-[var(--color-warning)]",
  },
  info: {
    button:
      "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] hover:bg-[var(--accent-fill-hover)]",
    icon: "text-[var(--color-accent)]",
  },
};

export function ConfirmDialog({
  open,
  title = "Confirmar",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [dialogState, dispatch] = useReducer(dialogReducer, "hidden");

  useEffect(() => {
    if (open) {
      dispatch({ type: "open" });
      const focusTimer = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(focusTimer);
    }
    dispatch({ type: "close" });
    const closeTimer = setTimeout(
      () => dispatch({ type: "closeComplete" }),
      200,
    );
    return () => clearTimeout(closeTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = setTimeout(() => confirmRef.current?.focus(), 50);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>("button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (dialogState === "hidden") return null;

  const styles = variantStyles[variant];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={dialogRef}
        className={`surface rounded-xl p-6 w-[90%] max-w-sm animate-fade-in transition-transform duration-200 ${open ? "scale-100" : "scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-2 rounded-full bg-[var(--color-bg-elevated)] ${styles.icon}`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
              {title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 focus-visible:outline-none ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
