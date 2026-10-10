import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import { compareMarketplaceProfits } from "@/shared/lib/compareMarketplaces";
import type { Marketplace } from "@/shared/types";

type MarketplaceOption = Marketplace & { custom?: boolean };

export interface MarketplaceComparisonProps {
  readonly totalCost: number;
  readonly marginPercent: number;
  readonly taxPercent: number;
  readonly marketplaces: readonly MarketplaceOption[];
  readonly selectedMarketplaceId: string;
  readonly onUseMarketplace: (marketplace: MarketplaceOption) => void;
}

/** Compact, shared comparison UI for every calculator level and surface. */
export function MarketplaceComparison({
  totalCost,
  marginPercent,
  taxPercent,
  marketplaces,
  selectedMarketplaceId,
  onUseMarketplace,
}: MarketplaceComparisonProps): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [usedMarketplaceName, setUsedMarketplaceName] = useState("");

  const rows = useMemo(
    () =>
      compareMarketplaceProfits({
        totalCost,
        marginPercent,
        taxPercent,
        marketplaces: [...marketplaces],
      }),
    [marketplaces, marginPercent, taxPercent, totalCost],
  );
  const bestRowId = rows.find((row) => row.isValid)?.id;

  const handleUse = (marketplace: MarketplaceOption): void => {
    onUseMarketplace(marketplace);
    setUsedMarketplaceName(marketplace.name);
  };

  return (
    <section className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 sm:p-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="marketplace-comparison-panel"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg text-left text-sm font-semibold text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ArrowLeftRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
          />
          <span>{t("calc.marketplaceComparison.open")}</span>
        </span>
        <span className="text-xs font-normal text-[var(--color-text-secondary)]">
          {t("calc.marketplaceComparison.profileCount", {
            count: marketplaces.length,
          })}
        </span>
      </button>

      {open && (
        <div
          id="marketplace-comparison-panel"
          className="mt-3 space-y-3 border-t border-[var(--color-border)] pt-3"
        >
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {t("calc.marketplaceComparison.intro")}
          </p>

          {usedMarketplaceName && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-[var(--color-success)]"
            >
              <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("calc.marketplaceComparison.selected", {
                name: usedMarketplaceName,
              })}
            </p>
          )}

          <div className="min-w-0 rounded-lg border border-[var(--color-border)] p-2 sm:overflow-x-auto sm:p-0">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">
                {t("calc.marketplaceComparison.tableLabel")}
              </caption>
              <thead className="hidden bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-secondary)] sm:table-header-group">
                <tr>
                  <th
                    scope="col"
                    className="px-2 py-2 font-semibold sm:w-[32%]"
                  >
                    {t("calc.marketplaceComparison.marketplace")}
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 font-semibold sm:w-[20%]"
                  >
                    {t("calc.marketplaceComparison.sellPrice")}
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 font-semibold sm:w-[26%]"
                  >
                    {t("calc.marketplaceComparison.fees")}
                  </th>
                  <th
                    scope="col"
                    className="px-2 py-2 font-semibold sm:w-[22%]"
                  >
                    {t("calc.marketplaceComparison.netProfit")}
                  </th>
                </tr>
              </thead>
              <tbody className="block space-y-2 sm:table-row-group sm:space-y-0">
                {rows.map((row) => {
                  const marketplace = marketplaces.find(
                    (candidate) => candidate.id === row.id,
                  );
                  const isBest = row.isValid && row.id === bestRowId;
                  const isSelected = row.id === selectedMarketplaceId;

                  return (
                    <tr
                      key={row.id}
                      className={`block rounded-lg border border-[var(--color-border)] sm:table-row sm:rounded-none sm:border-0 sm:border-t ${
                        isBest ? "bg-[var(--color-success)]/5" : ""
                      }`}
                    >
                      <th
                        scope="row"
                        className="block px-2 py-3 text-left font-medium text-[var(--color-text-primary)] sm:table-cell"
                      >
                        <div className="flex min-w-0 items-start gap-1.5">
                          {isBest && (
                            <Trophy
                              aria-hidden="true"
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="block break-words">
                              {marketplace?.name ?? row.name}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              {marketplace?.custom && (
                                <span className="rounded-full border border-[var(--color-accent)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
                                  {t("calc.marketplaceComparison.custom")}
                                </span>
                              )}
                              {isBest && (
                                <span className="text-[10px] font-semibold text-[var(--color-success)]">
                                  {t("calc.marketplaceComparison.best")}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!marketplace || !row.isValid || isSelected}
                          onClick={() => marketplace && handleUse(marketplace)}
                          aria-label={t(
                            isSelected
                              ? "calc.marketplaceComparison.inUseLabel"
                              : "calc.marketplaceComparison.useLabel",
                            { name: marketplace?.name ?? row.name },
                          )}
                          className="mt-2 min-h-9 w-full rounded-lg border border-[var(--color-border)] px-2 text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-default disabled:opacity-55 sm:w-auto"
                        >
                          {isSelected
                            ? t("calc.marketplaceComparison.inUse")
                            : t("calc.marketplaceComparison.use")}
                        </button>
                      </th>
                      <td className="block px-2 py-2 text-[var(--color-text-primary)] sm:table-cell sm:whitespace-nowrap sm:px-2 sm:py-3">
                        <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] sm:hidden">
                          {t("calc.marketplaceComparison.sellPrice")}
                        </span>
                        <span>{row.isValid ? format(row.sellPrice) : "—"}</span>
                      </td>
                      <td className="block px-2 py-2 text-[var(--color-text-secondary)] sm:table-cell sm:px-2 sm:py-3">
                        <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] sm:hidden">
                          {t("calc.marketplaceComparison.fees")}
                        </span>
                        {row.isValid ? (
                          <>
                            <span className="block whitespace-nowrap">
                              {format(row.feeTotal)}
                            </span>
                            <span className="text-[11px] sm:text-xs">
                              {row.feePercent}% + {format(row.feeFixed)}
                            </span>
                          </>
                        ) : (
                          t("calc.marketplaceComparison.unavailable")
                        )}
                      </td>
                      <td
                        className={`block px-2 py-3 font-semibold sm:table-cell sm:whitespace-nowrap ${
                          row.isValid
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] sm:hidden">
                          {t("calc.marketplaceComparison.netProfit")}
                        </span>
                        {row.isValid ? format(row.netProfit) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="block px-3 py-6 text-center text-sm text-[var(--color-text-secondary)] sm:table-cell"
                    >
                      {t("calc.marketplaceComparison.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <details className="rounded-lg border border-[var(--color-border)] px-3 py-2">
            <summary className="min-h-8 cursor-pointer py-1 text-sm font-medium text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
              {t("calc.marketplaceComparison.assumptionsTitle")}
            </summary>
            <p className="pt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {t("calc.marketplaceComparison.assumptions")}
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
