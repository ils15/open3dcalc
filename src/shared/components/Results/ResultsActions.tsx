import { useId } from "react";
import { useTranslation } from "react-i18next";

import { PiiWriteRefusalNotice } from "@/shared/components/Privacy/PiiWriteRefusalNotice";
import { PII_STORE_KEY } from "@/shared/lib/crypto/piiStoreHydration";
import { ExportActionsCard } from "./ExportActionsCard";
import { HistoryCard } from "./HistoryCard";
import { InventoryDeductionCard } from "./InventoryDeductionCard";
import { ProductActionsCard } from "./ProductActionsCard";
import { SaveSettingsAction } from "./SaveSettingsAction";

export interface ResultsActionsProps {
  readonly displaySellPrice: number;
  readonly onExportBlocked?: (message: string) => void;
  /** The stock controls are FDM-only; resin keeps its existing two groups. */
  readonly showInventory?: boolean;
  /** Optional surface-specific label for the history action. */
  readonly historyActionLabel?: string;
}

/** Groups result actions by intent and isolates the inventory mutation. */
export function ResultsActions({
  displaySellPrice,
  onExportBlocked,
  showInventory = true,
  historyActionLabel,
}: ResultsActionsProps): React.ReactElement {
  const { t } = useTranslation();
  const id = useId();
  const saveHeadingId = `${id}-save`;
  const exportHeadingId = `${id}-export`;
  const inventoryHeadingId = `${id}-inventory`;
  const historyLabel = historyActionLabel ?? t("results.addHistorySeparate");

  return (
    <div className="min-w-0 space-y-6" data-testid="results-actions">
      <section
        aria-labelledby={saveHeadingId}
        data-testid="action-group-save"
        className="min-w-0 space-y-3"
      >
        {/*
         * H-4: the calculator is the main place a history entry is created, so
         * its refusal (a locked/incapable vault) must be visible here, next to
         * the "add to history" control. Scoped to the history store so the PII
         * tabs' own notices (customers/quotes) are never duplicated here.
         */}
        <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.history} />
        <div>
          <h2
            id={saveHeadingId}
            className="text-sm font-bold text-[var(--text-primary)]"
          >
            {t("results.saveAndRegister")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("results.saveAndRegisterDescription")}
          </p>
        </div>
        {/*
         * One column, not `sm:grid-cols-2`. Three controls in two columns
         * orphaned "Salvar Configurações" on its own half-width row with an
         * empty 162px cell beside it, and forced "Adicionar ao histórico sem
         * deduzir estoque" to wrap to two lines just to fit. Stacked, every
         * control is full width, the label stops wrapping, and the two-row
         * grid hole disappears.
         */}
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <ProductActionsCard
            displaySellPrice={displaySellPrice}
            historyActionLabel={historyLabel}
          />
          <SaveSettingsAction />
        </div>
        <HistoryCard />
      </section>

      <section
        aria-labelledby={exportHeadingId}
        data-testid="action-group-export"
        className="min-w-0 space-y-3 border-t border-[var(--border-subtle)] pt-5"
      >
        <div>
          <h2
            id={exportHeadingId}
            className="text-sm font-bold text-[var(--text-primary)]"
          >
            {t("results.exportAndShare")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("results.exportAndShareDescription")}
          </p>
        </div>
        <ExportActionsCard
          onExportBlocked={onExportBlocked}
          showSaveSettings={false}
        />
      </section>

      {showInventory && (
        <section
          aria-labelledby={inventoryHeadingId}
          data-testid="action-group-inventory"
          className="min-w-0 space-y-3 border-t-4 border-[var(--border-default)] pt-5"
        >
          <div>
            <h2
              id={inventoryHeadingId}
              className="text-sm font-bold text-[var(--text-primary)]"
            >
              {t("results.inventory")}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t("results.inventoryDescription")}
            </p>
          </div>
          <InventoryDeductionCard />
        </section>
      )}
    </div>
  );
}
