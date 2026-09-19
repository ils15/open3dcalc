import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { BarChart2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { compareMaterialsForPart } from "@/shared/lib/compareMaterials";

type SortDir = "asc" | "desc";

/**
 * Comparador de custo de material (Wave C / B3): table colapsável dentro do
 * ResultsPanel que mostra, para a peça atual, quanto cada material do catálogo
 * FDM custaria. A lógica vive em `compareMaterialsForPart` (lib pura); este
 * componente é stateless — apenas lê stores e renderiza.
 *
 * A peça é descrita pelo seu VOLUME (cm³): no FDM vem de peso/densidade do
 * material ativo; na resina, `volumeUsedMl` (1 ml ≡ 1 cm³). Resina não é
 * comparável com FDM (processos diferentes) — daí o filtro `type === "fdm"` e a
 * nota explicativa.
 */
export function MaterialComparison() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const {
    activeTab,
    fdmMaterial,
    resinMaterial,
    quantity,
    fdmPrintParams,
    resinPrintParams,
  } = useCalculatorStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      fdmMaterial: s.fdmMaterial,
      resinMaterial: s.resinMaterial,
      quantity: s.quantity,
      fdmPrintParams: s.fdmPrintParams,
      resinPrintParams: s.resinPrintParams,
    })),
  );
  const materials = useCatalogStore((s) => s.materials);

  const fdmMaterials = useMemo(
    () => materials.filter((m) => m.type === "fdm"),
    [materials],
  );

  const { rows, hasInput, failureRatePercent } = useMemo(() => {
    const isResin = activeTab === "resin";
    const params = isResin ? resinPrintParams : fdmPrintParams;
    const volumeCm3 = isResin
      ? resinMaterial.volumeUsedMl
      : fdmMaterial.weightUsed > 0 && fdmMaterial.density > 0
        ? fdmMaterial.weightUsed / fdmMaterial.density
        : 0;
    const rate =
      params.failureMode === "percent"
        ? Number.isFinite(params.failureValue) && params.failureValue > 0
          ? params.failureValue
          : 0
        : 0;
    return {
      rows: compareMaterialsForPart(
        { volumeCm3, quantity, failureRatePercent: rate },
        fdmMaterials,
      ),
      hasInput: volumeCm3 > 0,
      failureRatePercent: rate,
    };
  }, [
    activeTab,
    fdmMaterial,
    resinMaterial,
    quantity,
    fdmPrintParams,
    resinPrintParams,
    fdmMaterials,
  ]);

  // A lib devolve válidos ordenados por custo asc + inválidos no final; no
  // modo desc inverte-se só o bloco válido para não promover linhas inválidas.
  const visibleRows = useMemo(() => {
    if (sortDir === "asc") return rows;
    return [
      ...rows.filter((r) => r.isValid).reverse(),
      ...rows.filter((r) => !r.isValid),
    ];
  }, [rows, sortDir]);

  // Só destaca o material atual no modo FDM: na aba resina a tabela exibe o
  // catálogo FDM (processos diferentes), e fdmMaterial.type não tem relação
  // com a resina selecionada — destacaria uma linha a esmo.
  const currentType =
    activeTab === "fdm" ? fdmMaterial.type?.trim().toLowerCase() : undefined;

  // Rótulos vivos (i18n) para o indicador de direção do sort e para linhas
  // inválidas — antes hardcoded ("—" / sem texto).
  const sortDirectionLabel = t(
    sortDir === "asc"
      ? "comparison.sortAscending"
      : "comparison.sortDescending",
  );
  const invalidMaterialLabel = t("comparison.invalidMaterial");

  return (
    <section
      data-testid="material-comparison"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
    >
      <button
        type="button"
        data-testid="material-comparison-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="material-comparison-body"
        aria-label={t("comparison.toggle")}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <BarChart2 className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-1">
          {t("comparison.title")}
        </span>
        {open ? (
          <ChevronUp
            className="w-4 h-4 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="w-4 h-4 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          id="material-comparison-body"
          className="px-3 pb-3 space-y-2 border-t border-[var(--color-border)]"
        >
          <p className="text-xs text-[var(--color-text-muted)] pt-2">
            {t("comparison.subtitle")}
          </p>

          {activeTab === "resin" && (
            <p className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <Info
                className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-info)]"
                aria-hidden="true"
              />
              <span>{t("comparison.resinNotComparable")}</span>
            </p>
          )}

          {!hasInput ? (
            <p
              data-testid="material-comparison-empty"
              className="text-xs text-[var(--color-text-muted)] italic py-2"
            >
              {t("comparison.empty")}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <caption className="sr-only">{t("comparison.title")}</caption>
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)]">
                      <th scope="col" className="py-1.5 pr-2 font-medium">
                        {t("comparison.rank")}
                      </th>
                      <th scope="col" className="py-1.5 pr-2 font-medium">
                        {t("comparison.material")}
                      </th>
                      <th
                        scope="col"
                        className="py-1.5 pr-2 font-medium hidden xs:table-cell"
                      >
                        {t("comparison.density")}
                      </th>
                      <th
                        scope="col"
                        className="py-1.5 pr-2 font-medium hidden sm:table-cell"
                      >
                        {t("comparison.weight")}
                      </th>
                      <th
                        scope="col"
                        className="py-1.5 font-medium"
                        aria-sort={
                          sortDir === "asc" ? "ascending" : "descending"
                        }
                      >
                        <button
                          type="button"
                          data-testid="material-comparison-sort"
                          onClick={() =>
                            setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                          }
                          aria-label={`${t("comparison.sortHint")} — ${sortDirectionLabel}`}
                          title={t("comparison.sortHint")}
                          className="inline-flex items-center gap-1 font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          {t("comparison.cost")}
                          {sortDir === "asc" ? (
                            <ChevronUp className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <ChevronDown
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isCurrent =
                        row.isValid &&
                        row.name.trim().toLowerCase() === currentType;
                      return (
                        <tr
                          key={row.id}
                          data-testid="material-comparison-row"
                          data-current={isCurrent}
                          className={
                            isCurrent
                              ? "bg-[var(--color-primary-muted)] font-semibold"
                              : ""
                          }
                        >
                          <td className="py-1.5 pr-2 text-[var(--color-text-muted)] tabular-nums">
                            {row.rank}
                          </td>
                          <td className="py-1.5 pr-2 text-[var(--color-text-primary)]">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1.5">
                                {row.name}
                                {isCurrent && (
                                  <span
                                    data-testid="material-comparison-current-badge"
                                    className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-[var(--color-primary)] text-[var(--color-accent-text)]"
                                    aria-label={t("comparison.currentMaterial")}
                                  >
                                    {t("comparison.currentBadge")}
                                  </span>
                                )}
                              </span>
                            ) : (
                              invalidMaterialLabel
                            )}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums hidden xs:table-cell">
                            {row.isValid
                              ? row.density.toFixed(2)
                              : invalidMaterialLabel}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums hidden sm:table-cell">
                            {row.isValid
                              ? `${row.weightGrams.toFixed(1)} g`
                              : invalidMaterialLabel}
                          </td>
                          <td className="py-1.5 tabular-nums text-[var(--color-text-primary)]">
                            {row.isValid
                              ? format(row.materialCost)
                              : invalidMaterialLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {failureRatePercent > 0 && (
                <p
                  data-testid="material-comparison-failure-note"
                  className="text-[10px] text-[var(--color-text-muted)]"
                >
                  {t("comparison.failureRateNote", {
                    rate: failureRatePercent,
                  })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
