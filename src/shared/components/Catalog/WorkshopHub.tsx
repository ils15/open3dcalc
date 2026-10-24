import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, Printer, Store } from "lucide-react";

import { CatalogTab, type CatalogSection } from "./CatalogTab";
import { SpoolShelf } from "@/shared/components/SpoolShelf/SpoolShelf";
import { Spool } from "lucide-react";
import type { Tab } from "@/shared/components/AppShell/tabs";

type WorkshopSection = CatalogSection | "stock";

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
];

function getSectionFromRoute(tab: Tab): WorkshopSection {
  return ROUTE_SECTION[tab] ?? "printers";
}

export function WorkshopHub({
  activeTab,
  onTabChange,
}: WorkshopHubProps): React.ReactElement {
  const { t } = useTranslation();
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
    <section className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 pb-16 text-[var(--color-text-primary)]">
      <div
        className="surface grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--color-border)] p-1.5 sm:grid-cols-4"
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
        {section === "stock" ? (
          <SpoolShelf />
        ) : (
          <CatalogTab
            activeSection={section}
            showHeader={false}
            showSectionTabs={false}
          />
        )}
      </div>
    </section>
  );
}
