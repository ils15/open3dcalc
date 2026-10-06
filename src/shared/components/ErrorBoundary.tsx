import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      /*
       * VIS-005 — migrated from a hardcoded dark-only palette to semantic
       * tokens. This screen renders on BOTH targets, and it is the screen a
       * user sees when something has already gone wrong, so a palette that
       * ignores the theme is the worst possible place for one.
       *
       * `--color-danger` / `--color-danger-muted` are used here, and
       * `--color-critical` would have been equally valid: both are emitted at
       * runtime and both alias `var(--critical)`, so they resolve to the same
       * colour (#b91c1c light, #fda4af dark — measured in a live page, not
       * read off the stylesheet). `--color-danger` is the spelling the rest of
       * the alias layer already uses.
       *
       * An earlier version of this comment claimed `--color-critical` lived
       * only in `@theme inline` and therefore "resolved to nothing". That was
       * wrong: `@theme` DOES emit its custom properties. The genuinely
       * unresolvable names in this codebase are a different, small, and
       * pre-existing set — `--color-bg-tertiary`, `--color-surface`,
       * `--color-surface-hover` and `--surface-elevated` — all of which measure
       * empty in a live page. None is used here. Do not "fix" them in a change
       * that is not about them; they need a token-layer decision first.
       *
       * Measured contrast, both themes (light / dark):
       *   heading on screen   16.57 / 17.94    body copy on card   7.58 / 10.29
       *   alert chip           5.89 /  8.52    error box           5.67 / 10.65
       *   reload button        6.29 /  6.29    clear-cache        17.32 / 15.65
       */
      return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-danger-muted)] text-[var(--color-danger)] flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              Ops! Ocorreu um problema ao carregar
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Um erro inesperado aconteceu durante a inicialização. Você pode
              tentar recarregar ou limpar os dados locais temporários.
            </p>
            <div className="bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border)] text-xs font-mono text-[var(--color-danger)] overflow-x-auto mb-6 max-h-40">
              {this.state.error?.message || "Erro desconhecido"}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-accent-fill)] hover:bg-[var(--color-accent-fill-hover)] text-[var(--color-accent-fill-fg)] font-medium text-sm transition-colors cursor-pointer"
              >
                Recarregar Página
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] font-medium text-sm transition-colors cursor-pointer"
              >
                Limpar Cache Local
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
