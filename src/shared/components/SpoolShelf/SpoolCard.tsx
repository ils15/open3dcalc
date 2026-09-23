import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { FilamentSpool, SpoolStatus } from "@/shared/stores/spoolStore";
import { remainingPct } from "@/shared/stores/spoolStore";
import { SpoolThumb, FALLBACK_HEX } from "./SpoolThumb";

/** Limiar (g) abaixo do qual um carretel em estoque é sinalizado como baixo. */
export const LOW_STOCK_GRAMS = 100;

const STATUS_CLASS: Record<SpoolStatus, string> = {
  in_stock:
    "bg-emerald-600/20 text-emerald-400 border-emerald-600/30 dark:text-emerald-300",
  on_the_way: "bg-amber-600/20 text-amber-400 border-amber-600/30 dark:text-amber-300",
  empty:
    "bg-gray-600/20 text-[var(--color-text-secondary)] border-gray-600/30",
};

const STATUS_I18N_KEY: Record<SpoolStatus, string> = {
  in_stock: "spools.statusInStock",
  on_the_way: "spools.statusOnTheWay",
  empty: "spools.statusEmpty",
};

interface SpoolCardProps {
  spool: FilamentSpool;
  onEdit: (spool: FilamentSpool) => void;
  onRemove: (spool: FilamentSpool) => void;
}

export const SpoolCard = memo(function SpoolCard({
  spool,
  onEdit,
  onRemove,
}: SpoolCardProps) {
  const { t } = useTranslation();
  const pct = remainingPct(spool);
  const status: SpoolStatus = spool.status || "in_stock";
  const isLow = status === "in_stock" && spool.weightGrams < LOW_STOCK_GRAMS;
  // O hex armazenado é a fonte da verdade; sem ele, fallback indigo
  // (mesmo último recurso do resolveHex do FilamentInventory).
  const hex = spool.colorHex || FALLBACK_HEX;
  const barColor = pct < 20 ? "#f97316" : hex;

  return (
    <article
      className="surface rounded-xl p-4 flex flex-col gap-3 hover:shadow-xl transition-shadow focus-within:ring-2 focus-within:ring-[var(--color-accent)]"
      aria-labelledby={`spool-${spool.id}-title`}
    >
      {isLow && (
        <span className="self-start flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[6px] bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 font-semibold">
          <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
          {t("spools.lowStock")}
        </span>
      )}

      <div className="flex items-center gap-3">
        <SpoolThumb hex={spool.colorHex} monogramFrom={spool.brand || spool.color} />
        <div className="min-w-0 flex-1">
          <h3
            id={`spool-${spool.id}-title`}
            className="font-bold text-[var(--color-text-primary)] text-[15px] leading-tight break-words"
          >
            {spool.color || "—"}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
            {spool.material} · {spool.brand || "—"}
          </p>
        </div>
        <span
          className={`text-[11px] px-2.5 py-0.5 rounded-[6px] border font-semibold whitespace-nowrap ${STATUS_CLASS[status]}`}
        >
          {t(STATUS_I18N_KEY[status])}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-[var(--color-text-secondary)] font-medium">
            {t("spools.remaining")}
          </span>
          <span aria-hidden="true">
            <span className="font-bold text-[var(--color-text-primary)]">
              {spool.weightGrams}g
            </span>
            <span className="text-[var(--color-text-muted)]">
              {" "}
              / {spool.originalWeightGrams}g
            </span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={`spool-${spool.id}-title`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${pct}%, ${spool.weightGrams} de ${spool.originalWeightGrams} gramas`}
          className="h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="text-right text-[10px] text-[var(--color-text-muted)] mt-1">
          {pct}%
        </div>
      </div>

      {spool.notes && (
        <p className="text-xs text-[var(--color-text-secondary)] italic line-clamp-2 break-words">
          {spool.notes}
        </p>
      )}

      <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => onEdit(spool)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 min-h-[36px] rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <Pencil className="w-3 h-3" aria-hidden="true" />
          {t("spools.editSpool")}
        </button>
        <button
          type="button"
          onClick={() => onRemove(spool)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600/10 text-[var(--color-danger)] hover:bg-red-600/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t("spools.removeSpool")}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
});
