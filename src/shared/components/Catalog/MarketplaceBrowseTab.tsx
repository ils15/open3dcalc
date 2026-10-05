import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer as PrinterIcon } from "lucide-react";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import type { CatalogPrinter } from "@/shared/stores/catalogStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { Material } from "@/shared/types";
import prusaMk4Photo from "@/shared/assets/printers/prusa-mk4-cropped.jpg";

type TechnologyFilter = "all" | "fdm" | "resin" | "unknown";

const technologyLabelKey: Record<Exclude<TechnologyFilter, "all">, string> = {
  fdm: "marketplaceBrowse.fdm",
  resin: "marketplaceBrowse.resin",
  unknown: "marketplaceBrowse.unspecified",
};

const PRUSA_MK4_SOURCE_PAGE =
  "https://commons.wikimedia.org/wiki/File:Prusa_MK4.jpg";
const CC_BY_SA_4_LICENSE = "https://creativecommons.org/licenses/by-sa/4.0/";
const fallbackImageByTechnology = {
  fdm: `${import.meta.env.BASE_URL}images/printers/fallback-fdm.svg`,
  resin: `${import.meta.env.BASE_URL}images/printers/fallback-resin.svg`,
} as const;

export function MarketplaceBrowseTab(): React.ReactElement {
  const { t } = useTranslation();
  const printers = useCatalogStore((state) => state.printers);
  const materials = useCatalogStore((state) => state.materials);
  const [printerSearch, setPrinterSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [technology, setTechnology] = useState<TechnologyFilter>("all");

  const brands = useMemo(
    () =>
      [...new Set(printers.map((printer) => printer.brand))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [printers],
  );
  const matchingPrinters = useMemo(() => {
    const query = printerSearch.trim().toLocaleLowerCase();
    return printers.filter((printer) => {
      const matchesQuery =
        !query ||
        `${printer.name} ${printer.brand}`.toLocaleLowerCase().includes(query);
      return matchesQuery && (brand === null || printer.brand === brand);
    });
  }, [brand, printerSearch, printers]);
  const unknownCount = matchingPrinters.filter(
    (printer) => !printer.technology,
  ).length;
  const filteredPrinters = matchingPrinters.filter((printer) => {
    if (technology === "all") return true;
    if (technology === "unknown") return !printer.technology;
    return printer.technology === technology;
  });
  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase();
    return materials.filter(
      (material) =>
        !query ||
        `${material.name} ${material.type}`.toLocaleLowerCase().includes(query),
    );
  }, [materialSearch, materials]);

  const technologyFilters: TechnologyFilter[] = [
    "all",
    "fdm",
    "resin",
    "unknown",
  ];
  const buttonBaseClass =
    "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";
  const activeButtonClass = `${buttonBaseClass} border-transparent bg-[var(--accent-fill)] text-[var(--accent-fill-fg)]`;
  const inactiveButtonClass = `${buttonBaseClass} border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`;

  return (
    <div className="min-w-0 space-y-5">
      <header className="surface flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {t("marketplaceBrowse.title")}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("marketplaceBrowse.subtitle")}
          </p>
        </div>
        <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          {t("marketplaceBrowse.browseOnly")}
        </span>
      </header>

      <section
        aria-labelledby="marketplace-printers-heading"
        className="min-w-0 space-y-3"
      >
        <div className="surface min-w-0 space-y-3 rounded-xl border border-[var(--color-border)] p-4">
          <h3
            id="marketplace-printers-heading"
            className="text-base font-semibold text-[var(--color-text-primary)]"
          >
            {t("marketplaceBrowse.printers")}
          </h3>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="marketplace-printer-search"
                className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
              >
                {t("marketplaceBrowse.searchPrinters")}
              </label>
              <input
                id="marketplace-printer-search"
                type="search"
                value={printerSearch}
                onChange={(event) => setPrinterSearch(event.target.value)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="marketplace-brand-filter"
                className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
              >
                {t("marketplaceBrowse.filterBrand")}
              </label>
              <select
                id="marketplace-brand-filter"
                value={brand ?? ""}
                onChange={(event) => setBrand(event.target.value || null)}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <option value="">{t("marketplaceBrowse.allBrands")}</option>
                {brands.map((brandName) => (
                  <option key={brandName} value={brandName}>
                    {brandName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            role="group"
            aria-label={t("marketplaceBrowse.filterTechnology")}
            className="flex min-w-0 flex-wrap gap-2"
          >
            {technologyFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={technology === filter}
                onClick={() => setTechnology(filter)}
                className={
                  technology === filter
                    ? activeButtonClass
                    : inactiveButtonClass
                }
              >
                {filter === "all"
                  ? t("marketplaceBrowse.allTechnologies")
                  : t(technologyLabelKey[filter])}
              </button>
            ))}
          </div>
        </div>

        {(technology === "fdm" || technology === "resin") &&
          unknownCount > 0 && (
            <p
              role="status"
              className="surface flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] p-3 text-sm text-[var(--color-text-secondary)]"
            >
              <span>
                {t("marketplaceBrowse.unknownProfiles", {
                  count: unknownCount,
                })}
              </span>
              <button
                type="button"
                onClick={() => setTechnology("unknown")}
                className="min-h-11 rounded-md px-2 font-semibold text-[var(--color-accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {t("marketplaceBrowse.revealUnknown", { count: unknownCount })}
              </button>
            </p>
          )}

        <div
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-live="polite"
        >
          {filteredPrinters.map((printer) => (
            <PrinterBrowseCard key={printer.id} printer={printer} />
          ))}
          {filteredPrinters.length === 0 && (
            <p
              role="status"
              className="surface col-span-full rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]"
            >
              {t("history.noResults")}
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="marketplace-materials-heading"
        className="min-w-0 space-y-3"
      >
        <div className="surface min-w-0 space-y-3 rounded-xl border border-[var(--color-border)] p-4">
          <h3
            id="marketplace-materials-heading"
            className="text-base font-semibold text-[var(--color-text-primary)]"
          >
            {t("marketplaceBrowse.materials")}
          </h3>
          <label
            htmlFor="marketplace-material-search"
            className="block text-xs font-medium text-[var(--color-text-secondary)]"
          >
            {t("marketplaceBrowse.searchMaterials")}
          </label>
          <input
            id="marketplace-material-search"
            type="search"
            value={materialSearch}
            onChange={(event) => setMaterialSearch(event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <MaterialBrowseCard key={material.id} material={material} />
          ))}
          {filteredMaterials.length === 0 && (
            <p
              role="status"
              className="surface col-span-full rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]"
            >
              {t("history.noResults")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function PrinterBrowseCard({
  printer,
}: {
  printer: CatalogPrinter;
}): React.ReactElement {
  const { t } = useTranslation();
  const technology = printer.technology
    ? t(technologyLabelKey[printer.technology])
    : t("marketplaceBrowse.unspecified");
  return (
    <article
      aria-label={`${printer.name} ${printer.brand}`}
      className="surface min-w-0 rounded-xl border border-[var(--color-border)] p-4 shadow-sm"
    >
      <PrinterBrowseVisual printer={printer} />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold text-[var(--color-text-primary)]">
            {printer.name}
          </h4>
          <p className="mt-1 break-words text-xs text-[var(--color-text-secondary)]">
            {printer.brand}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
          {technology}
        </span>
      </div>
    </article>
  );
}

function PrinterBrowseVisual({
  printer,
}: {
  printer: CatalogPrinter;
}): React.ReactElement {
  const { t } = useTranslation();
  if (printer.id === "prusa_mk4") {
    return (
      <figure className="mb-3 min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <a
          href={PRUSA_MK4_SOURCE_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("marketplaceBrowse.openPrusaMk4PhotoSource")}
          className="block aspect-[16/9] w-full rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
        >
          <img
            src={prusaMk4Photo}
            alt={t("marketplaceBrowse.prusaMk4PhotoAlt")}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </a>
        <figcaption className="space-y-1 border-t border-[var(--color-border)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          <p>
            {t("marketplaceBrowse.photoBy")}{" "}
            <a
              href={PRUSA_MK4_SOURCE_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--color-accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Majkluss
            </a>
            {" · "}
            <a
              href={CC_BY_SA_4_LICENSE}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--color-accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              CC BY-SA 4.0
            </a>
          </p>
          <p>{t("marketplaceBrowse.photoModified")}</p>
          <p>{t("marketplaceBrowse.photoNotEndorsed")}</p>
        </figcaption>
      </figure>
    );
  }

  if (printer.technology) {
    const fallbackImage = fallbackImageByTechnology[printer.technology];
    const fallbackAlt = t(
      `marketplaceBrowse.${printer.technology}PlaceholderAlt`,
    );
    return (
      <figure className="mb-3 min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="flex aspect-[16/9] w-full items-center justify-center">
          <img
            src={fallbackImage}
            alt={fallbackAlt}
            loading="lazy"
            decoding="async"
            className="h-20 w-20 object-contain p-2"
          />
        </div>
      </figure>
    );
  }

  return (
    <div
      role="img"
      aria-label={t("marketplaceBrowse.unknownPlaceholderAlt")}
      className="surface mb-3 flex aspect-[16/9] min-w-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
    >
      <PrinterIcon aria-hidden="true" className="h-10 w-10" />
    </div>
  );
}

function MaterialBrowseCard({
  material,
}: {
  material: Material;
}): React.ReactElement {
  const { t } = useTranslation();
  const { format } = useCurrency();
  return (
    <article
      aria-label={material.name}
      className="surface min-w-0 rounded-xl border border-[var(--color-border)] p-4 shadow-sm"
    >
      <h4 className="break-words text-sm font-semibold text-[var(--color-text-primary)]">
        {material.name}
      </h4>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <dt className="text-[var(--color-text-muted)]">
            {t("marketplaceBrowse.type")}
          </dt>
          <dd className="break-words font-medium text-[var(--color-text-primary)]">
            {t(technologyLabelKey[material.type])}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-text-muted)]">
            {t("marketplaceBrowse.density")}
          </dt>
          <dd className="break-words font-medium text-[var(--color-text-primary)]">
            {material.density} g/cm³
          </dd>
        </div>
        <div className="min-w-0 col-span-2">
          <dt className="text-[var(--color-text-muted)]">
            {t("marketplaceBrowse.averagePrice")}
          </dt>
          <dd className="break-words font-medium text-[var(--color-text-primary)]">
            {format(material.avgPrice)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
