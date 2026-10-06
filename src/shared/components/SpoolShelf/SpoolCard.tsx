import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, AlertTriangle, Play } from "lucide-react";
import type { FilamentSpool, SpoolStatus } from "@/shared/stores/spoolStore";
import { isLowStockSpool, remainingPct } from "@/shared/stores/spoolStore";
import { SpoolRemainingBlock } from "@/shared/components/Catalog/SpoolRemainingBlock";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { SpoolThumb, FALLBACK_HEX } from "./SpoolThumb";

/** Limiar (g) abaixo do qual um carretel em estoque é sinalizado como baixo. */
export const LOW_STOCK_GRAMS = 100;

/**
 * Status badge: the background/border washes stay the raw Tailwind palette
 * (theme-independent, so one value serves both themes), but the INK is now a
 * per-theme pair instead of a `dark:` variant.
 *
 * Why: `dark:` used to be bound to `@media (prefers-color-scheme: dark)` while
 * the app's theme is a CLASS on <html> (see `@custom-variant dark` in
 * styles/tokens.css). The two are independent switches, so the "light" ink was
 * being chosen by the OS rather than by the theme the user actually picked.
 *
 * Why not just keep `dark:`: once bound to the class, the light leg is what
 * renders in light mode — and it fails WCAG AA. Measured against the wash
 * composited over this card's own themed surface (`--surface-raised`, white in
 * light) using the shipped Tailwind v4 palette: `text-emerald-400` is 1.53:1,
 * `text-amber-400` 1.39:1 and `text-amber-500` 1.83:1 — all light-on-light.
 * The 800 steps clear it at 5.99:1 / 5.70:1 / 6.08:1, and the dark legs are
 * unchanged at 8.80:1 / 9.08:1 / 8.19:1.
 *
 * Unlike StudioQuotesView, this card's surface IS themed (it paints on
 * `--color-bg-elevated`), so following the theme is correct here — which is
 * exactly why the two need opposite treatments.
 *
 * A `dark:` variant is still the right tool when the two themes genuinely want
 * the same hue at different weights. Here they do not: a light-400 green on a
 * 20% wash is a light-on-light pairing no matter which theme asked for it.
 */
const STATUS_CLASS: Record<SpoolStatus, string> = {
  in_stock:
    "bg-emerald-600/20 text-emerald-800 border-emerald-600/30 dark:text-emerald-300",
  on_the_way:
    "bg-amber-600/20 text-amber-800 border-amber-600/30 dark:text-amber-300",
  empty: "bg-gray-600/20 text-[var(--color-text-secondary)] border-gray-600/30",
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
  const raw =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : match[1];
  const channels = [0, 2, 4].map(
    (offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance =
    0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
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
  const { format } = useCurrency();
  const calcStore = useCalculatorStore();
  const setActiveTab = useNavigationPrefsStore((s) => s.setActiveTab);
  const pct = remainingPct(spool);
  const status: SpoolStatus = spool.status || "in_stock";
  const isLow = isLowStockSpool(spool, LOW_STOCK_GRAMS);
  const hex = spool.colorHex?.trim() || FALLBACK_HEX;
  const barColor = pct < 20 ? "#f97316" : hex;
  const textOnColor = readableTextColor(hex);

  const handleUseInCalculation = () => {
    calcStore.setSelectedSpoolId(spool.id);
    if (spool.costPerKg > 0) {
      if (
        spool.material.toLowerCase().includes("resina") ||
        spool.material.toLowerCase().includes("resin")
      ) {
        calcStore.setActiveTab("resin");
        calcStore.setResinMaterial({
          ...calcStore.resinMaterial,
          type: spool.material,
          costPerLiter: spool.costPerKg,
        });
      } else {
        calcStore.setActiveTab("fdm");
        const mat = spool.material.toLowerCase();
        const matType = mat.includes("petg")
          ? "petg"
          : mat.includes("abs")
            ? "abs"
            : mat.includes("tpu")
              ? "tpu_95a"
              : mat.includes("silk")
                ? "pla_silk"
                : "pla";
        calcStore.setFdmMaterial({
          ...calcStore.fdmMaterial,
          type: matType,
          costPerKg: spool.costPerKg,
        });
      }
    }
    setActiveTab("calculator");
  };

  return (
    <article
      className="surface rounded-xl p-4 flex flex-col gap-3 hover:shadow-xl transition-shadow focus-within:ring-2 focus-within:ring-[var(--color-accent)]"
      aria-labelledby={`spool-${spool.id}-title`}
    >
      {isLow && (
        <span className="self-start flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[6px] bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-semibold">
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

      {/* Price & Tare Info */}
      <div className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] block">
            Preço / kg
          </span>
          <span className="font-bold font-mono text-[var(--color-text-primary)]">
            {format(spool.costPerKg)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[var(--color-text-muted)] block">
            Custo por grama
          </span>
          <span className="font-mono text-emerald-400 font-semibold">
            {format(spool.costPerKg / 1000)}/g
          </span>
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
          onClick={handleUseInCalculation}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 min-h-[36px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Usar no Cálculo
        </button>
        <button
          type="button"
          onClick={() => onEdit(spool)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] transition-colors"
          aria-label={t("spools.editSpool")}
          title={t("spools.editSpool")}
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(spool)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          title={t("spools.removeSpool")}
          aria-label={t("spools.removeSpool")}
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{t("spools.removeSpool")}</span>
        </button>
      </div>
    </article>
  );
});
