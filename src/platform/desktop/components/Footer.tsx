/**
 * Desktop footer — minimal attribution line, hidden below lg. Extracted
 * verbatim from the desktop App.tsx body (the web footer is a different
 * surface with the secondary-surface hub).
 */
export function Footer(): React.ReactElement {
  return (
    <footer className="hidden lg:block text-center text-xs text-[var(--color-text-muted)] py-3 border-t border-[var(--color-border)]">
      <div className="flex items-center justify-center gap-3">
        <a
          href="https://github.com/ils15/open3dcalc"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
        >
          Open3DCalc — Open Source · MIT License
        </a>
        <span className="text-[var(--color-text-muted)]">·</span>
        <a
          href="https://ofertachina.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none px-1 rounded"
        >
          ofertachina.com.br
        </a>
      </div>
    </footer>
  );
}
