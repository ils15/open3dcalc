import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import {
  useFilamentInventory,
  type FilamentSpool,
} from "@/shared/stores/filamentInventory";
import {
  coversPrint,
  remainingMeters,
  remainingNetGrams,
} from "@/shared/lib/filamentRemaining";
import { lookupBrandTare } from "@/shared/lib/brandTare";
import { Tooltip } from "@/shared/components/ui/Tooltip";

interface SpoolRemainingBlockProps {
  spool: FilamentSpool;
  /**
   * Gramas que a peça ativa exige (unitWeight × quantity do calculatorStore).
   * 0 = sem peça ativa → o badge de cobertura não é renderizado.
   */
  requiredGrams: number;
}

/** Metros formatados: inteiros a partir de 100 m, uma casa decimal abaixo. */
function formatMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0";
  return meters >= 100
    ? String(Math.round(meters))
    : String(Math.round(meters * 10) / 10);
}

/**
 * Bloco "Líquido restante" do card de carretel (Wave C / C1).
 *
 * O card de inventário é card-based, não table — esta "coluna Restante" é um
 * bloco de informação abaixo da progress bar de peso bruto existente. Toda a
 * matemática vive nas libs Wave A (`filamentRemaining` / `brandTare`); este
 * componente é stateless além do draft local do input de tara.
 *
 * - Líquido: `remainingNetGrams` (bruto menos tara efetiva) + `remainingMeters`.
 * - Tara: placeholder auto-preenchido por `lookupBrandTare`; commit no blur
 *   preserva o override manual (undefined = voltar ao lookup de marca).
 * - Cobertura: `coversPrint` contra a peça ativa; badge token-backed
 *   (`badge-emerald`/`badge-red`), nunca cores cruas — WCAG AA.
 */
export function SpoolRemainingBlock({
  spool,
  requiredGrams,
}: SpoolRemainingBlockProps) {
  const { t } = useTranslation();
  const updateSpool = useFilamentInventory((s) => s.updateSpool);
  const autoTare = lookupBrandTare(spool.brand);

  const [tareDraft, setTareDraft] = useState<string>(
    typeof spool.tareGrams === "number" ? String(spool.tareGrams) : "",
  );

  const netGrams = remainingNetGrams(spool, spool.tareGrams);
  const meters = remainingMeters(spool, spool.tareGrams);
  const coverage = coversPrint(spool, requiredGrams, spool.tareGrams);
  const showCoverage = requiredGrams > 0;

  /** Commit no blur: vazio limpa o override; inválido é ignorado (sem NaN). */
  const commitTare = () => {
    const trimmed = tareDraft.trim();
    if (trimmed === "") {
      if (spool.tareGrams !== undefined) {
        updateSpool(spool.id, { tareGrams: undefined });
      }
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const tareGrams = Math.round(parsed);
    if (tareGrams !== spool.tareGrams) {
      updateSpool(spool.id, { tareGrams });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {t("inventory.netRemaining")}
          </span>
          <Tooltip content={t("inventory.netRemainingHint")}>
            <Info
              className="w-3.5 h-3.5 text-[var(--color-text-muted)] cursor-help shrink-0"
              aria-hidden="true"
            />
          </Tooltip>
        </div>
        <span
          data-testid={`net-remaining-${spool.id}`}
          className="text-xs whitespace-nowrap"
        >
          <span className="font-bold text-[var(--color-text-primary)]">
            {Math.round(netGrams)}g
          </span>
          <span className="text-[var(--color-text-muted)]">
            {" · "}
            {formatMeters(meters)} m
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`tare-input-${spool.id}`}
          className="text-[11px] text-[var(--color-text-muted)] shrink-0"
        >
          {t("inventory.tare")}
        </label>
        <input
          id={`tare-input-${spool.id}`}
          data-testid={`tare-input-${spool.id}`}
          inputMode="decimal"
          value={tareDraft}
          onChange={(e) => setTareDraft(e.target.value)}
          onBlur={commitTare}
          placeholder={
            autoTare > 0
              ? t("inventory.tareAuto", { tare: autoTare })
              : t("inventory.tare")
          }
          title={t("inventory.tareSourceNote")}
          className="w-24 h-8 px-2 text-right text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {showCoverage && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2">
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {t("inventory.coverageNeeded", {
              grams: Math.round(requiredGrams),
            })}
          </span>
          <span
            data-testid={`coverage-badge-${spool.id}`}
            className={`text-[11px] px-2.5 py-0.5 rounded-[6px] font-semibold ${
              coverage.ok ? "badge-emerald" : "badge-red"
            }`}
            title={t("inventory.coverageMargin", {
              margin: Math.round(coverage.marginGrams),
            })}
          >
            {coverage.ok
              ? t("inventory.coverageOk")
              : t("inventory.coverageFail")}
          </span>
        </div>
      )}
    </div>
  );
}
