import React from "react";
import { Briefcase } from "lucide-react";

interface StudioSubHeaderProps {
  onOpenQuoteModal: () => void;
}

export const StudioSubHeader: React.FC<StudioSubHeaderProps> = ({
  onOpenQuoteModal,
}) => (
  <button
    type="button"
    onClick={onOpenQuoteModal}
    aria-label="Orçamento"
    title="Gerar Proposta & Orçamento"
    className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent-fill)] px-2.5 py-1 font-semibold text-[var(--color-accent-fill-fg)] shadow-sm transition-colors hover:bg-[var(--color-accent-fill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
  >
    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
    <span className="hidden sm:inline">Orçamento</span>
  </button>
);
