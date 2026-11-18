import React from "react";
import { X } from "lucide-react";

interface StudioSplitInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  inspectorContent: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  dataTestId?: string;
}

export const StudioSplitInspector: React.FC<StudioSplitInspectorProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  inspectorContent,
  footer,
  children,
  dataTestId = "studio-split-inspector",
}) => {
  if (!isOpen) {
    return <div className="min-w-0">{children}</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] gap-5 items-start">
      <div className="min-w-0">{children}</div>

      <aside
        data-testid={dataTestId}
        aria-label={title}
        className="bg-surface-raised border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-lg lg:sticky lg:top-20 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="min-w-0">
            {badge ? <div className="mb-1.5">{badge}</div> : null}
            <h3 className="text-sm font-bold text-text-primary truncate">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-[11px] text-text-secondary truncate mt-0.5">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de detalhes"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs">{inspectorContent}</div>

        {footer ? (
          <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center gap-2">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
};
