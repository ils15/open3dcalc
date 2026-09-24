import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { FilamentSpool, SpoolStatus } from "@/shared/stores/spoolStore";
import { isLowStockSpool, remainingPct } from "@/shared/stores/spoolStore";
import { SpoolRemainingBlock } from "@/shared/components/Catalog/SpoolRemainingBlock";
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

/** Escolhe texto claro/escuro pelo contraste real do hex (WCAG AA). */
function readableTextColor(hex: string): "#111827" | "#ffffff" {
  const match = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "#ffffff";
  const raw = match[1].length === 3
    ? match[1].split("").map((part) => `${part}${part}`).join("")
    : match[1];
  const channels = [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  const darkContrast = (luminance + 0.05) / 0.05;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? "#111827" : "#ffffff";
}

interface SpoolCardProps {
  spool: FilamentSpool;
  requiredGrams?: number;
  onEdit: (spool: FilamentSpool) => void;
  onRemove: (spool: FilamentSpool) => void;
}

export const SpoolCard = memo(function SpoolCard({
  spool,
  requiredGrams = 0,
  onEdit,
  onRemove,
}: SpoolCardProps) {
  const { t } = useTranslation();
  const pct = remainingPct(spool);
  const status: SpoolStatus = spool.status || "in_stock";
  const isLow = isLowStockSpool(spool, LOW_STOCK_GRAMS);
  // O hex armazenado é a fonte da verdade; sem ele, fallback indigo
  // (mesmo último recurso do resolveHex do FilamentInventory).
  const hex = spool.colorHex?.trim() || FALLBACK_HEX;
  const barColor = pct < 20 ? "#f97316" : hex;
  const textOnColor = readableTextColor(hex);

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
        <SpoolThumb hex={hex} monogramFrom={spool.brand || spool.color} />
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

      <div
        data-testid={`spool-color-${spool.id}`}
        className="rounded-xl border border-black/10 px-3 py-2.5 shadow-sm"
        style={{ backgroundColor: hex, color: textOnColor }}
      >
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-80">
          <span>{t("spools.color")}</span>
          <span className="font-mono normal-case tracking-normal">{hex}</span>
        </div>
        <p className="mt-1 text-sm font-bold leading-tight">
          {spool.color || t("spools.colorUnknown")}
        </p>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-[var(--color-text-secondary)] font-medium">
            {t("spools.grossWeight")}
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
          aria-valuetext={t("spools.remainingProgress", {
            pct,
            current: spool.weightGrams,
            original: spool.originalWeightGrams,
          })}
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

      <SpoolRemainingBlock spool={spool} requiredGrams={requiredGrams} />

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
          className="min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-lg bg-red-600/10 text-[var(--color-danger)] hover:bg-red-600/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          title={t("spools.removeSpool")}
          aria-label={t("spools.removeSpool")}
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">
            {t("spools.removeSpool")}
          </span>
        </button>
      </div>
    </article>
  );
});
