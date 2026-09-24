import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface BentoCardProps {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
}

/** Shared keyboard-focusable shell for the five bento cards. */
export function BentoCard({
  title,
  icon: Icon,
  children,
  className = "",
  id,
}: BentoCardProps): React.ReactElement {
  const headingId = useId();

  return (
    <article
      id={id}
      tabIndex={0}
      aria-labelledby={headingId}
      className={`min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)] outline-none focus-visible:border-[var(--border-accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2 text-[var(--text-primary)]">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-[var(--accent)]" />
        <h2 id={headingId} className="text-base font-bold">
          {title}
        </h2>
      </div>
      {children}
    </article>
  );
}
