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
      return (
        <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
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
            <h2 className="text-xl font-bold text-white mb-2">
              Ops! Ocorreu um problema ao carregar
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Um erro inesperado aconteceu durante a inicialização. Você pode
              tentar recarregar ou limpar os dados locais temporários.
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-red-300 overflow-x-auto mb-6 max-h-40">
              {this.state.error?.message || "Erro desconhecido"}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors cursor-pointer"
              >
                Recarregar Página
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors cursor-pointer"
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
