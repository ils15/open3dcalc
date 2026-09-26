import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-[var(--color-text-muted)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)] max-w-[260px]">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          /* Solid PRIMARY, deliberately not a tinted wash like its sibling
             buttons. This is the only interactive element in the empty region
             — it is the way out of the empty state, not an optional shortcut
             — so it carries the accent FILL rather than a 12-20% tint, which
             under-signalled it. --accent-fill is the app's house treatment for
             a primary action and is theme-independent with a fixed ink, so it
             measures 6.29:1 at rest and 7.90:1 on hover in BOTH themes with a
             firm rest->hover step. The previous pairing (accent ink on a 20%
             accent wash) was 4.11:1 light / 4.17:1 dark at rest and dropped to
             3.52:1 / 3.48:1 on its 30% hover. */
          className="mt-4 min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] hover:bg-[var(--color-accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
