import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  Calculator,
  Printer,
  Spool,
  Store,
  Wrench,
} from "lucide-react";

import { CatalogTab, type CatalogSection } from "./CatalogTab";
import { SpoolShelf, SpoolManagerView } from "@/shared/components/SpoolShelf";
import { LOW_STOCK_GRAMS } from "@/shared/components/SpoolShelf/SpoolCard";
import { WorkshopBusinessProfileView } from "./WorkshopBusinessProfileView";
import { MakerToolboxView } from "./MakerToolboxView";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { isLowStockSpool } from "@/shared/stores/spoolStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useWorkspaceContainerClass } from "@/platform/web/components/studio/workspaceWidth";
import type { Tab } from "@/shared/components/AppShell/tabs";

type WorkshopSection = CatalogSection | "stock" | "business" | "toolbox";

interface WorkshopHubProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const ROUTE_SECTION: Partial<Record<Tab, WorkshopSection>> = {
  inventory: "stock",
  marketplace: "marketplaces",
};

const SECTION_ROUTE: Record<WorkshopSection, Tab> = {
  printers: "catalog",
  materials: "catalog",
  stock: "inventory",
  marketplaces: "marketplace",
  business: "catalog",
  toolbox: "catalog",
};

const SECTIONS: {
  id: WorkshopSection;
  label: string;
  icon: typeof Printer;
}[] = [
  { id: "printers", label: "workshop.printers", icon: Printer },
  { id: "materials", label: "workshop.materials", icon: Boxes },
  { id: "stock", label: "workshop.stock", icon: Spool },
  { id: "marketplaces", label: "workshop.salesChannels", icon: Store },
  { id: "business", label: "workshop.businessProfile", icon: Building2 },
  { id: "toolbox", label: "workshop.toolbox", icon: Wrench },
];

function getSectionFromRoute(tab: Tab): WorkshopSection {
  return ROUTE_SECTION[tab] ?? "printers";
}

export function WorkshopHub({
  activeTab,
  onTabChange,
}: WorkshopHubProps): React.ReactElement {
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const containerClass = useWorkspaceContainerClass();
  const stockView = useLayoutStore((s) => s.stockView ?? "manager");
  const setStockView = useLayoutStore((s) => s.setStockView);
  const activeTechnology = useCalculatorStore((s) => s.activeTab ?? "fdm");
  const selectedPrinter = useCalculatorStore((s) => s.selectedPrinter);
  const fdmMaterial = useCalculatorStore((s) => s.fdmMaterial);
  const resinMaterial = useCalculatorStore((s) => s.resinMaterial);
  const selectedMarketplace = useCalculatorStore((s) => s.selectedMarketplace);
  const spools = useFilamentInventory((s) => s.spools ?? []);
  const lowSpoolCount = useMemo(
    () =>
      spools.filter((spool) => isLowStockSpool(spool, LOW_STOCK_GRAMS)).length,
    [spools],
  );
  const activeMaterialSummary =
    activeTechnology === "fdm"
      ? fdmMaterial
        ? `${fdmMaterial.type} · ${currencySymbol} ${fdmMaterial.costPerKg}/kg`
        : "PLA"
      : resinMaterial
        ? `${resinMaterial.type} · ${currencySymbol} ${resinMaterial.costPerLiter}/L`
        : "Standard";

  const [selectedSection, setSelectedSection] = useState<WorkshopSection>(() =>
    getSectionFromRoute(activeTab),
  );
  // Legacy routes open their corresponding section. The catalog route retains
  // the selected printer/material section while treating stale legacy-only
  // selections as the default when the user re-enters Minha Oficina.
  const section =
    ROUTE_SECTION[activeTab] ??
    (selectedSection === "stock" || selectedSection === "marketplaces"
      ? "printers"
      : selectedSection);

  const selectSection = (next: WorkshopSection) => {
    setSelectedSection(next);
    onTabChange(SECTION_ROUTE[next]);
  };

  return (
    <section
      className={`${containerClass} flex flex-col gap-4 pb-16 text-[var(--color-text-primary)]`}
    >
      {/* Active Workshop Setup & Quick-Jump Deck */}
      <div
        data-testid="workshop-active-setup-deck"
        className="surface flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3.5 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t("workshop.activeSetupTitle")}
            </span>
            <span className="rounded-md border border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)] px-2 py-0.5 text-[11px] font-semibold uppercase text-[var(--color-accent)]">
              {activeTechnology === "fdm" ? "FDM" : "Resina"}
            </span>
          </div>
          <button
            type="button"
            data-testid="workshop-open-calculator-btn"
            onClick={() => onTabChange("calculator")}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--color-accent-fill)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-fill-fg)] transition-colors hover:bg-[var(--color-accent-fill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t("workshop.openInCalculator")}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            data-testid="workshop-slot-printer"
            onClick={() => selectSection("printers")}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              section === "printers"
                ? "border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Printer
              className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t("workshop.activePrinterSlot")}
              </div>
              <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {selectedPrinter?.name ?? "—"}
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="workshop-slot-material"
            onClick={() => selectSection("materials")}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              section === "materials"
                ? "border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Boxes
              className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t("workshop.activeMaterialSlot")}
              </div>
              <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {activeMaterialSummary}
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="workshop-slot-stock"
            onClick={() => selectSection("stock")}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              section === "stock"
                ? "border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            {lowSpoolCount > 0 ? (
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-[var(--color-warning)]"
                aria-hidden="true"
              />
            ) : (
              <Spool
                className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t("workshop.activeStockSlot")}
              </div>
              <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {lowSpoolCount > 0
                  ? t("workshop.stockLowAlert", { count: lowSpoolCount })
                  : t("workshop.stockNormal", { count: spools.length })}
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="workshop-slot-channel"
            onClick={() => selectSection("marketplaces")}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              section === "marketplaces"
                ? "border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <Store
              className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t("workshop.activeChannelSlot")}
              </div>
              <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {selectedMarketplace
                  ? `${selectedMarketplace.name} (${selectedMarketplace.feePercent}%)`
                  : "—"}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div
        className="surface grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--color-border)] p-1.5 sm:grid-cols-3 lg:grid-cols-6"
        role="tablist"
        aria-label={t("workshop.title")}
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const selected = section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`workshop-tab-${id}`}
              aria-controls="workshop-panel"
              aria-selected={selected}
              onClick={() => selectSection(id)}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:text-sm ${
                selected
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(label)}</span>
            </button>
          );
        })}
      </div>

      <div
        id="workshop-panel"
        role="tabpanel"
        aria-labelledby={`workshop-tab-${section}`}
        className="min-w-0"
      >
        {section === "business" ? (
          <WorkshopBusinessProfileView />
        ) : section === "toolbox" ? (
          <MakerToolboxView />
        ) : section === "stock" ? (
          <div className="flex flex-col gap-4">
            {/* Stock presentation toggle: the full management view or the
                compact shelf. The choice persists in the declared
                open3dcalc_layout_v1 preference (layoutStore.stockView). */}
            <div
              role="group"
              aria-label={t("workshop.stockViewLabel")}
              className="surface flex w-fit items-center gap-1 rounded-xl border border-[var(--color-border)] p-1"
            >
              {(
                [
                  ["manager", "workshop.stockViewManager"],
                  ["shelf", "workshop.stockViewShelf"],
                ] as const
              ).map(([view, labelKey]) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={stockView === view}
                  onClick={() => setStockView(view)}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                    stockView === view
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            {stockView === "manager" ? (
              <SpoolManagerView onTabChange={onTabChange} />
            ) : (
              <SpoolShelf onUseInCalculator={() => onTabChange("calculator")} />
            )}
          </div>
        ) : (
          <CatalogTab
            activeSection={section}
            showHeader={false}
            showSectionTabs={false}
            onOpenCalculator={() => onTabChange("calculator")}
          />
        )}
      </div>
    </section>
  );
}
