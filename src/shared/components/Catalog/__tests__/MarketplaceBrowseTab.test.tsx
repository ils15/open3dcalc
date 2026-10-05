import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Material, PrinterProfile } from "@/shared/types";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import { MORE_TABS, TABS } from "@/shared/components/AppShell/tabs";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import printerPhotoManifest from "@/shared/assets/printers/manifest.json";
import { MarketplaceBrowseTab } from "../MarketplaceBrowseTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const messages: Record<string, string> = {
        "marketplaceBrowse.title": "Marketplace",
        "marketplaceBrowse.subtitle": "Browse catalog definitions",
        "marketplaceBrowse.browseOnly": "Browse only",
        "marketplaceBrowse.materials": "Materials",
        "marketplaceBrowse.printers": "Printer profiles",
        "marketplaceBrowse.searchMaterials": "Search materials",
        "marketplaceBrowse.searchPrinters": "Search printer profiles",
        "marketplaceBrowse.filterBrand": "Brand",
        "marketplaceBrowse.allBrands": "All brands",
        "marketplaceBrowse.filterTechnology": "Technology",
        "marketplaceBrowse.allTechnologies": "All technologies",
        "marketplaceBrowse.fdm": "FDM",
        "marketplaceBrowse.resin": "Resin",
        "marketplaceBrowse.unspecified": "Not specified",
        "marketplaceBrowse.unknownProfiles": `${options?.count ?? 0} profiles have no specified technology.`,
        "marketplaceBrowse.revealUnknown": `Show ${options?.count ?? 0} not specified profiles`,
        "marketplaceBrowse.type": "Type",
        "marketplaceBrowse.density": "Density",
        "marketplaceBrowse.averagePrice": "Average price",
        "marketplaceBrowse.prusaMk4PhotoAlt":
          "Original Prusa MK4 3D printer with an orange print on the bed",
        "marketplaceBrowse.openPrusaMk4PhotoSource":
          "Open the Prusa MK4 photo source page",
        "marketplaceBrowse.photoBy": "Photo by",
        "marketplaceBrowse.photoModified":
          "Cropped to remove visible wordmark; other visible marks blurred.",
        "marketplaceBrowse.photoNotEndorsed":
          "Independent photo; not an endorsement by Prusa Research.",
        "marketplaceBrowse.fdmPlaceholderAlt":
          "Illustrated FDM printer placeholder, not a product photo",
        "marketplaceBrowse.resinPlaceholderAlt":
          "Illustrated resin printer placeholder, not a product photo",
        "marketplaceBrowse.unknownPlaceholderAlt":
          "Generic printer illustration; technology not specified",
        "history.noResults": "No results",
      };
      return messages[key] ?? key;
    },
    i18n: { language: "en-US" },
  }),
}));

const printer = (
  id: string,
  name: string,
  brand: string,
  technology?: PrinterProfile["technology"],
): PrinterProfile => ({
  id,
  name,
  brand,
  power: 200,
  value: 1000,
  usefulLife: 3000,
  maintenancePerHour: 0.25,
  ...(technology ? { technology } : {}),
});

const material = (
  id: string,
  name: string,
  type: Material["type"],
): Material => ({
  id,
  name,
  type,
  density: 1.24,
  avgPrice: 90,
});

describe("MarketplaceBrowseTab", () => {
  beforeEach(() => {
    useCatalogStore.setState({
      printers: [
        printer("fdm-a", "Aster FDM", "Aster", "fdm"),
        printer("resin-a", "Aster Resin", "Aster", "resin"),
        printer("fdm-b", "Boreal FDM", "Boreal", "fdm"),
        // Name/brand intentionally suggest resin; absent declared technology stays unknown.
        printer("unknown", "Mars Resin Printer", "Elegoo"),
      ],
      materials: [
        material("pla", "PLA Basic", "fdm"),
        material("resin", "Standard Resin", "resin"),
      ],
      marketplaces: [],
    });
    useSpoolStore.setState({
      spools: [
        {
          id: "physical-spool",
          brand: "Secret Stock Brand",
          material: "PLA",
          color: "Private Color",
          colorHex: "#123456",
          weightGrams: 750,
          originalWeightGrams: 1000,
          costPerKg: 25,
          diameterMm: 1.75,
          dateAdded: 1,
          notes: "PHYSICAL_INVENTORY_ONLY",
          status: "in_stock",
          purchaseStore: "Private Shop",
        },
      ],
    });
  });

  it("is a distinct shared navigation route in both shells", () => {
    expect(TABS.find(({ id }) => id === "marketplace")?.labelKey).toBe(
      "nav.marketplace",
    );
    expect(MORE_TABS.some(({ id }) => id === "marketplace")).toBe(true);
    expect(TABS.some(({ id }) => id === "catalog")).toBe(true);
  });

  it("shows every catalog profile and material by default without physical spool data", () => {
    render(<MarketplaceBrowseTab />);

    expect(screen.getByRole("heading", { name: "Marketplace" })).toBeVisible();
    for (const name of [
      "Aster FDM",
      "Aster Resin",
      "Boreal FDM",
      "Mars Resin Printer",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeVisible();
    }
    expect(screen.getByText("PLA Basic")).toBeVisible();
    expect(screen.getByText("Standard Resin")).toBeVisible();
    expect(
      screen.queryByText(
        /PHYSICAL_INVENTORY_ONLY|Secret Stock Brand|Private Shop/,
      ),
    ).not.toBeInTheDocument();
  });

  it("maps the photo only to the exact MK4 profile and exposes its complete attribution", () => {
    useCatalogStore.setState({
      printers: [
        printer("prusa_mk4", "MK4", "Prusa", "fdm"),
        printer("prusa_mk4s", "MK4S", "Prusa", "fdm"),
        printer("custom-mk4", "Custom MK4", "Prusa", "fdm"),
      ],
    });
    render(<MarketplaceBrowseTab />);

    const mk4Card = screen.getByRole("article", { name: "MK4 Prusa" });
    const photo = within(mk4Card).getByRole("img", {
      name: "Original Prusa MK4 3D printer with an orange print on the bed",
    });
    expect(photo.getAttribute("src")).toMatch(/prusa-mk4-cropped\.jpg/);
    expect(photo.getAttribute("src")).not.toMatch(/^https?:/);

    expect(
      within(mk4Card).getByRole("link", {
        name: "Open the Prusa MK4 photo source page",
      }),
    ).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Prusa_MK4.jpg",
    );
    expect(
      within(mk4Card).getByRole("link", { name: "Majkluss" }),
    ).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Prusa_MK4.jpg",
    );
    expect(
      within(mk4Card).getByRole("link", { name: "CC BY-SA 4.0" }),
    ).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    );
    expect(mk4Card).toHaveTextContent(
      "Cropped to remove visible wordmark; other visible marks blurred.",
    );
    expect(mk4Card).toHaveTextContent(
      "Independent photo; not an endorsement by Prusa Research.",
    );
    expect(
      within(
        screen.getByRole("article", { name: "Custom MK4 Prusa" }),
      ).getByRole("img", {
        name: "Illustrated FDM printer placeholder, not a product photo",
      }),
    ).toBeVisible();
  });

  it("records source, author, license, access date, crop, and share-alike terms in the asset manifest", () => {
    expect(printerPhotoManifest.assets).toHaveLength(1);
    expect(printerPhotoManifest.assets[0]).toMatchObject({
      profileId: "prusa_mk4",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Prusa_MK4.jpg",
      sourceAsset:
        "https://upload.wikimedia.org/wikipedia/commons/f/f2/Prusa_MK4.jpg",
      author: "Majkluss",
      license: {
        shortName: "CC BY-SA 4.0",
        version: "4.0",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
      dateAccessed: expect.stringMatching(/^2026-10-\d{2}$/),
      transformation: {
        outputDimensions: "1280x730",
      },
    });
    expect(printerPhotoManifest.assets[0].transformation.description).toContain(
      "distributed under CC BY-SA 4.0",
    );
    expect(
      printerPhotoManifest.assets[0].transformation
        .blurredMarkRegionsOutputPixels,
    ).toHaveLength(4);
  });

  it("keeps technology-specific placeholders for other profiles and a generic placeholder when unspecified", () => {
    useCatalogStore.setState({
      printers: [
        printer("prusa_mk4s", "MK4S", "Prusa", "fdm"),
        printer("resin-profile", "Resin Profile", "Other", "resin"),
        printer("unknown-profile", "Unknown Profile", "Other"),
      ],
    });
    render(<MarketplaceBrowseTab />);

    const fdmFallback = within(
      screen.getByRole("article", { name: "MK4S Prusa" }),
    ).getByRole("img", {
      name: "Illustrated FDM printer placeholder, not a product photo",
    });
    expect(fdmFallback.getAttribute("src")).toContain(
      "images/printers/fallback-fdm.svg",
    );

    const resinFallback = within(
      screen.getByRole("article", { name: "Resin Profile Other" }),
    ).getByRole("img", {
      name: "Illustrated resin printer placeholder, not a product photo",
    });
    expect(resinFallback.getAttribute("src")).toContain(
      "images/printers/fallback-resin.svg",
    );

    expect(
      within(
        screen.getByRole("article", { name: "Unknown Profile Other" }),
      ).getByRole("img", {
        name: "Generic printer illustration; technology not specified",
      }),
    ).toBeVisible();
    expect(
      screen
        .getByRole("article", { name: "MK4S Prusa" })
        .querySelector('img[src*="prusa-mk4-cropped"]'),
    ).toBeNull();
  });

  it("uses semantic accent foreground and visible focus tokens for active filters", () => {
    render(<MarketplaceBrowseTab />);

    const activeFilter = screen.getByRole("button", {
      name: "All technologies",
    });
    expect(activeFilter).toHaveClass("text-[var(--accent-fill-fg)]");
    expect(activeFilter).toHaveClass("focus-visible:ring-2");
  });

  it("keeps seed profiles with no declared technology unspecified", () => {
    useCatalogStore.setState({
      printers: [printer("creality_cr6_se", "CR-6 SE", "Creality")],
    });
    render(<MarketplaceBrowseTab />);

    const profile = screen.getByRole("article", { name: "CR-6 SE Creality" });
    expect(profile).toHaveTextContent("Not specified");
    fireEvent.click(screen.getByRole("button", { name: "FDM" }));
    expect(
      screen.queryByRole("article", { name: "CR-6 SE Creality" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not specified" }));
    expect(
      screen.getByRole("article", { name: "CR-6 SE Creality" }),
    ).toBeVisible();
  });

  it.each([
    ["creality_cr6_se", "CR-6 SE", "Creality"],
    ["anycubic_chiron", "Chiron", "Anycubic"],
    ["voron_switchwire", "Switchwire", "Voron"],
  ])("preserves an explicitly saved technology for %s", (id, name, brand) => {
    useCatalogStore.setState({
      printers: [printer(id, name, brand, "fdm")],
    });
    render(<MarketplaceBrowseTab />);

    expect(
      screen.getByRole("article", { name: `${name} ${brand}` }),
    ).toHaveTextContent("FDM");
  });

  it("displays the verified K1C seed as FDM", () => {
    useCatalogStore.setState({
      printers: [printer("creality_k1c", "K1C", "Creality", "fdm")],
    });
    render(<MarketplaceBrowseTab />);

    expect(
      screen.getByRole("article", { name: "K1C Creality" }),
    ).toHaveTextContent("FDM");
  });

  it.each([
    {
      filter: "FDM",
      visible: ["Aster FDM", "Boreal FDM"],
      hidden: ["Aster Resin", "Mars Resin Printer"],
    },
    {
      filter: "Resin",
      visible: ["Aster Resin"],
      hidden: ["Aster FDM", "Boreal FDM", "Mars Resin Printer"],
    },
    {
      filter: "Not specified",
      visible: ["Mars Resin Printer"],
      hidden: ["Aster FDM", "Aster Resin", "Boreal FDM"],
    },
  ])(
    "filters the $filter bucket without inferring missing values",
    ({ filter, visible, hidden }) => {
      render(<MarketplaceBrowseTab />);
      fireEvent.click(screen.getByRole("button", { name: filter }));

      for (const name of visible) {
        expect(screen.getByRole("heading", { name })).toBeVisible();
      }
      for (const name of hidden) {
        expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
      }
    },
  );

  it("filters by brand alone and combines brand with technology", () => {
    render(<MarketplaceBrowseTab />);
    const brand = screen.getByRole("combobox", { name: "Brand" });
    fireEvent.change(brand, { target: { value: "Boreal" } });
    expect(screen.getByRole("heading", { name: "Boreal FDM" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Aster FDM" }),
    ).not.toBeInTheDocument();

    fireEvent.change(brand, { target: { value: "Aster" } });
    fireEvent.click(screen.getByRole("button", { name: "Resin" }));
    expect(screen.getByRole("heading", { name: "Aster Resin" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Aster FDM" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      brand: "",
      technology: "All technologies",
      visible: ["Aster FDM", "Aster Resin", "Boreal FDM", "Mars Resin Printer"],
      unknownCount: false,
    },
    {
      brand: "",
      technology: "FDM",
      visible: ["Aster FDM", "Boreal FDM"],
      unknownCount: true,
    },
    {
      brand: "",
      technology: "Resin",
      visible: ["Aster Resin"],
      unknownCount: true,
    },
    {
      brand: "",
      technology: "Not specified",
      visible: ["Mars Resin Printer"],
      unknownCount: false,
    },
    {
      brand: "Aster",
      technology: "All technologies",
      visible: ["Aster FDM", "Aster Resin"],
      unknownCount: false,
    },
    {
      brand: "Aster",
      technology: "FDM",
      visible: ["Aster FDM"],
      unknownCount: false,
    },
    {
      brand: "Aster",
      technology: "Resin",
      visible: ["Aster Resin"],
      unknownCount: false,
    },
    {
      brand: "Aster",
      technology: "Not specified",
      visible: [],
      unknownCount: false,
    },
    {
      brand: "Boreal",
      technology: "All technologies",
      visible: ["Boreal FDM"],
      unknownCount: false,
    },
    {
      brand: "Boreal",
      technology: "FDM",
      visible: ["Boreal FDM"],
      unknownCount: false,
    },
    { brand: "Boreal", technology: "Resin", visible: [], unknownCount: false },
    {
      brand: "Boreal",
      technology: "Not specified",
      visible: [],
      unknownCount: false,
    },
  ])(
    "applies brand '$brand' and technology '$technology' together",
    ({ brand, technology, visible, unknownCount }) => {
      render(<MarketplaceBrowseTab />);
      fireEvent.change(screen.getByRole("combobox", { name: "Brand" }), {
        target: { value: brand },
      });
      fireEvent.click(screen.getByRole("button", { name: technology }));

      for (const name of visible) {
        expect(screen.getByRole("heading", { name })).toBeVisible();
      }
      for (const name of [
        "Aster FDM",
        "Aster Resin",
        "Boreal FDM",
        "Mars Resin Printer",
      ]) {
        if (!visible.includes(name)) {
          expect(
            screen.queryByRole("heading", { name }),
          ).not.toBeInTheDocument();
        }
      }
      const unknownNotice = screen.queryByText(
        /profiles have no specified technology/,
      );
      if (unknownCount) {
        expect(unknownNotice).not.toBeNull();
      } else {
        expect(unknownNotice).toBeNull();
      }
    },
  );

  it("searches material definitions only by their name and declared type", () => {
    render(<MarketplaceBrowseTab />);
    const search = screen.getByRole("searchbox", { name: "Search materials" });
    fireEvent.change(search, { target: { value: "resin" } });

    expect(
      screen.getByRole("heading", { name: "Standard Resin" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "PLA Basic" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["BRL", "R$ 90,00"],
    ["USD", "$90.00"],
  ] as const)(
    "formats average material prices in the configured %s currency and locale",
    (currency, expectedPrice) => {
      useCalculatorStore.setState({ currency });
      render(<MarketplaceBrowseTab />);

      expect(
        screen.getAllByText(
          (_, element) => element?.textContent === expectedPrice,
        ),
      ).toHaveLength(2);
    },
  );

  it.each(["FDM", "Resin"])(
    "announces unknown profile count and exposes a keyboard-operable reveal action under %s",
    async (filter) => {
      render(<MarketplaceBrowseTab />);
      const user = userEvent.setup();
      fireEvent.click(screen.getByRole("button", { name: filter }));

      expect(screen.getByRole("status")).toHaveTextContent(
        "1 profiles have no specified technology.",
      );
      const reveal = screen.getByRole("button", {
        name: "Show 1 not specified profiles",
      });
      reveal.focus();
      expect(reveal).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(
        screen.getByRole("heading", { name: "Mars Resin Printer" }),
      ).toBeVisible();
    },
  );

  it("reflects catalog additions in the browse view without a second catalog array", () => {
    render(<MarketplaceBrowseTab />);
    act(() => {
      useCatalogStore
        .getState()
        .addPrinter(printer("new", "New Catalog Printer", "Aster", "fdm"));
      useCatalogStore
        .getState()
        .addMaterial(material("new-material", "New Catalog Material", "fdm"));
    });

    expect(
      screen.getByRole("heading", { name: "New Catalog Printer" }),
    ).toBeVisible();
    expect(screen.getByText("New Catalog Material")).toBeVisible();
    expect(useCatalogStore.getState().printers.at(-1)?.name).toBe(
      "New Catalog Printer",
    );
    expect(useCatalogStore.getState().materials.at(-1)?.name).toBe(
      "New Catalog Material",
    );
  });

  it("renames only the fee-template presentation, preserving the catalog fees key and route id", () => {
    expect(ptBR.catalog.marketplaces).toBe("Taxas e Canais");
    expect(enUS.catalog.marketplaces).toBe("Fees & Channels");
    expect(ptBR.marketplaceBrowse.unspecified).toBe("Não especificada");
    expect(enUS.marketplaceBrowse.unspecified).toBe("Not specified");
    expect(ptBR.nav.marketplace).toBe("Marketplace");
    expect(enUS.nav.marketplace).toBe("Marketplace");
    expect(enUS.marketplaceBrowse.photoModified).toBe(
      "Cropped to remove visible wordmark; other visible marks blurred.",
    );
    expect(ptBR.marketplaceBrowse.photoModified).toBe(
      "Recortada para remover a marca visível; outras marcas foram desfocadas.",
    );
    expect(TABS.find(({ id }) => id === "marketplace")?.id).toBe("marketplace");
    expect(TABS.find(({ id }) => id === "catalog")?.id).toBe("catalog");
  });
});
