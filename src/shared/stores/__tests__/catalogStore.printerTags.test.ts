import { describe, it, expect, beforeEach } from "vitest";
import { useCatalogStore } from "../catalogStore";
import { fdmMaterials, resinMaterials } from "@/shared/lib/materials";
import { printers as printerSeeds } from "@/shared/lib/printers";
import { marketplaces as marketplaceSeeds } from "@/shared/lib/marketplace";

const STORAGE_KEY = "open3dcalc_catalog_v1";

const customPrinter = (id: string, tags: string[] = []) => ({
  id,
  name: `Printer ${id}`,
  brand: "DIY",
  power: 120,
  value: 1500,
  usefulLife: 3000,
  maintenancePerHour: 0.25,
  custom: true,
  tags,
});

describe("catalogStore — printer tags", () => {
  beforeEach(() => {
    localStorage.clear();
    useCatalogStore.setState({
      printers: [customPrinter("p1", ["resin"]), customPrinter("p2", [])],
      materials: [],
      marketplaces: [],
      selectedPrinterTag: null,
    });
  });

  // ── Filter state ───────────────────────────────────────────────
  it("starts with no tag filter selected", () => {
    expect(useCatalogStore.getState().selectedPrinterTag).toBeNull();
  });

  it("setPrinterTagFilter selects and clears the active tag", () => {
    useCatalogStore.getState().setPrinterTagFilter("resin");
    expect(useCatalogStore.getState().selectedPrinterTag).toBe("resin");

    useCatalogStore.getState().setPrinterTagFilter(null);
    expect(useCatalogStore.getState().selectedPrinterTag).toBeNull();
  });

  // ── addPrinterTag ──────────────────────────────────────────────
  it("adds a tag to a printer", () => {
    useCatalogStore.getState().addPrinterTag("p2", "voron");
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p2")?.tags,
    ).toEqual(["voron"]);
  });

  it("normalizes tags to trimmed, single-spaced lowercase", () => {
    useCatalogStore.getState().addPrinterTag("p2", "  Fast   Print ");
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p2")?.tags,
    ).toEqual(["fast print"]);
  });

  it("does not duplicate an existing tag (case-insensitive)", () => {
    useCatalogStore.getState().addPrinterTag("p1", "RESIN");
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags,
    ).toEqual(["resin"]);
  });

  it("ignores empty or whitespace-only tags", () => {
    useCatalogStore.getState().addPrinterTag("p1", "   ");
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags,
    ).toEqual(["resin"]);
  });

  it("ignores tags for an unknown printer", () => {
    useCatalogStore.getState().addPrinterTag("does-not-exist", "voron");
    expect(
      useCatalogStore
        .getState()
        .printers.every((p) => !(p.tags ?? []).includes("voron")),
    ).toBe(true);
  });

  // ── removePrinterTag ───────────────────────────────────────────
  it("removes a tag from a printer", () => {
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags,
    ).toEqual([]);
  });

  it("clears the active filter when the selected tag is removed", () => {
    useCatalogStore.getState().setPrinterTagFilter("resin");
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    expect(useCatalogStore.getState().selectedPrinterTag).toBeNull();
  });

  it("keeps other filters intact when a different tag is removed", () => {
    useCatalogStore.getState().setPrinterTagFilter("other");
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    expect(useCatalogStore.getState().selectedPrinterTag).toBe("other");
  });

  it("is a no-op when the tag is absent", () => {
    const before = useCatalogStore.getState().printers;
    useCatalogStore.getState().removePrinterTag("p2", "resin");
    expect(useCatalogStore.getState().printers).toEqual(before);
  });

  // ── Persistence ────────────────────────────────────────────────
  it("persists added tags to localStorage", () => {
    useCatalogStore.getState().addPrinterTag("p2", "voron");
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(
      parsed.printers.find((p: { id: string }) => p.id === "p2").tags,
    ).toEqual(["voron"]);
  });

  it("persists tag removal to localStorage", () => {
    useCatalogStore.getState().removePrinterTag("p1", "resin");
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(
      parsed.printers.find((p: { id: string }) => p.id === "p1").tags,
    ).toEqual([]);
  });

  it("adds a tag to a printer that has no tags field yet", () => {
    useCatalogStore.setState({
      printers: [
        {
          id: "legacy",
          name: "Legacy",
          brand: "X",
          power: 90,
          value: 800,
          usefulLife: 2000,
          maintenancePerHour: 0.2,
          custom: true,
        },
      ],
      materials: [],
      marketplaces: [],
      selectedPrinterTag: null,
    });
    useCatalogStore.getState().addPrinterTag("legacy", "fast");
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "legacy")?.tags,
    ).toEqual(["fast"]);
  });

  // ── Backward compatibility (pre-Phase-4A bundles) ──────────────
  it("coerces legacy bundles without a tags field to tags: []", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        printers: [
          {
            id: "legacy",
            name: "Legacy",
            brand: "X",
            power: 90,
            value: 800,
            usefulLife: 2000,
            maintenancePerHour: 0.2,
            custom: true,
          },
        ],
        materials: [],
        marketplaces: [],
      }),
    );
    useCatalogStore.getState().load();
    const legacy = useCatalogStore
      .getState()
      .printers.find((p) => p.id === "legacy");
    expect(legacy?.tags).toEqual([]);
  });

  it("keeps existing tags when reloading a Phase-4A bundle", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        printers: [customPrinter("p1", ["resin", "fast"])],
        materials: [],
        marketplaces: [],
      }),
    );
    useCatalogStore.getState().load();
    expect(
      useCatalogStore.getState().printers.find((p) => p.id === "p1")?.tags,
    ).toEqual(["resin", "fast"]);
  });

  it("falls back to catalog defaults when storage holds an empty bundle", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    useCatalogStore.getState().load();
    const printers = useCatalogStore.getState().printers;
    expect(printers.length).toBeGreaterThan(0);
    expect(printers.every((p) => Array.isArray(p.tags))).toBe(true);
  });

  it.each([
    ["missing", null],
    ["invalid JSON", "{not-json"],
  ])("loads default arrays when catalog storage is %s", (_case, value) => {
    if (value !== null) localStorage.setItem(STORAGE_KEY, value);

    useCatalogStore.getState().load();

    expect(useCatalogStore.getState().materials).toEqual([
      ...fdmMaterials,
      ...resinMaterials,
    ]);
    expect(useCatalogStore.getState().printers).toEqual(
      printerSeeds.map((printer) => ({ ...printer, tags: [] })),
    );
    expect(useCatalogStore.getState().marketplaces).toEqual(marketplaceSeeds);
  });

  it("preserves explicit empty catalog arrays", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ printers: [], materials: [], marketplaces: [] }),
    );

    useCatalogStore.getState().load();

    expect(useCatalogStore.getState().printers).toEqual([]);
    expect(useCatalogStore.getState().materials).toEqual([]);
    expect(useCatalogStore.getState().marketplaces).toEqual([]);
  });

  it("uses saved arrays as replacements and preserves their IDs and shape", () => {
    const savedPrinter = customPrinter("saved-printer", ["resin"]);
    const savedMaterial = {
      id: "saved-material",
      name: "Saved PETG",
      density: 1.31,
      avgPrice: 137,
      type: "fdm" as const,
      custom: true,
    };
    const savedMarketplace = {
      id: "saved-marketplace",
      name: "Saved Market",
      feePercent: 4,
      feeFixed: 2,
      hasFreeShipping: false,
      custom: true,
    };
    const savedArrays = {
      printers: [savedPrinter],
      materials: [savedMaterial],
      marketplaces: [savedMarketplace],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedArrays));

    useCatalogStore.getState().load();

    expect(useCatalogStore.getState().printers).toEqual(savedArrays.printers);
    expect(useCatalogStore.getState().materials).toEqual(savedArrays.materials);
    expect(useCatalogStore.getState().marketplaces).toEqual(
      savedArrays.marketplaces,
    );
  });

  it("keeps existing seed material IDs and the established object shape", () => {
    useCatalogStore.getState().load();

    const materials = useCatalogStore.getState().materials;
    expect(materials.map(({ id }) => id)).toEqual([
      "pla",
      "pla_silk",
      "pla_plus",
      "petg",
      "abs",
      "asa",
      "tpu_85a",
      "tpu_95a",
      "nylon_pa6",
      "nylon_pa12",
      "pc",
      "pc_abs",
      "pla_cf",
      "petg_cf",
      "nylon_cf",
      "pla_wood",
      "pla_metal",
      "hips",
      "pva",
      "pp",
      "peek",
      "peek_cf",
      "ultem",
      "standard",
      "abs_like",
      "water_washable",
      "tough",
      "flexible",
      "clear",
      "dental",
      "castable",
    ]);
    expect(materials[0]).toEqual({
      id: "pla",
      name: "PLA",
      density: 1.24,
      avgPrice: 90,
      type: "fdm",
    });
    expect(
      materials.every(
        (material) =>
          Object.keys(material).sort().join(",") ===
          "avgPrice,density,id,name,type",
      ),
    ).toBe(true);
  });

  it("keeps existing printer and marketplace seed IDs and object shapes", () => {
    useCatalogStore.getState().load();

    const { printers, marketplaces } = useCatalogStore.getState();
    expect(printers.map(({ id }) => id)).toEqual([
      "bambu_a1_mini",
      "bambu_a1",
      "bambu_p1s",
      "bambu_x1c",
      "bambu_x1e",
      "creality_ender_3_s1",
      "creality_ender_3_s1_plus",
      "creality_ender_3_s1_pro",
      "creality_ender_3_v3_se",
      "creality_ender_3_v3",
      "creality_ender_3_v3_ke",
      "creality_k1",
      "creality_k1c",
      "creality_k1_se",
      "creality_k1_max",
      "creality_k2",
      "creality_k2_plus",
      "creality_k2_pro",
      "creality_cr10_v3",
      "creality_cr10_smart",
      "creality_cr6_se",
      "creality_halot_sky",
      "anycubic_kobra_2",
      "anycubic_kobra_2_pro",
      "anycubic_kobra_2_max",
      "anycubic_kobra_3",
      "anycubic_kobra_3_v2",
      "anycubic_kobra_3_max",
      "anycubic_kobra_s1",
      "anycubic_kobra_s1_combo",
      "anycubic_kobra_s1_max_combo",
      "anycubic_mega_x",
      "anycubic_vyper",
      "anycubic_chiron",
      "anycubic_photon_m3",
      "anycubic_photon_m3s",
      "anycubic_photon_ultra",
      "prusa_mk3s",
      "prusa_mk4",
      "prusa_mk4s",
      "prusa_xl_2",
      "prusa_xl_5",
      "prusa_mini",
      "prusa_sl1s",
      "elegoo_neptune_3",
      "elegoo_neptune_3_pro",
      "elegoo_neptune_3_plus",
      "elegoo_neptune_4",
      "elegoo_neptune_4_pro",
      "elegoo_neptune_4_max",
      "elegoo_saturn_2",
      "elegoo_saturn_3",
      "elegoo_saturn_4",
      "elegoo_mars_4",
      "elegoo_mars_5",
      "elegoo_orangestorm_g2",
      "flashforge_guider_3",
      "flashforge_guider_3s",
      "flashforge_adventurer_4",
      "flashforge_adventurer_5m",
      "flashforge_finder_3",
      "flashforge_creator_4s",
      "ultimaker_s3",
      "ultimaker_s5",
      "ultimaker_fact_4",
      "ultimaker_method_x",
      "ultimaker_method_xl",
      "artillery_sidewinder_x1",
      "artillery_sidewinder_x2",
      "artillery_sidewinder_x4",
      "artillery_hornet",
      "artillery_genius",
      "artillery_sw_x4_plus",
      "qidi_x_plus",
      "qidi_x_max",
      "qidi_x_smart",
      "qidi_i_fast",
      "qidi_i3",
      "sovol_sv06",
      "sovol_sv06_plus",
      "sovol_sv07",
      "sovol_sv07_plus",
      "sovol_sv01",
      "ankermake_m5",
      "ankermake_m5c",
      "ankermake_v6",
      "raise3d_e2",
      "raise3d_pro3",
      "raise3d_pro3_plus",
      "raise3d_rf1000",
      "snapmaker_j1",
      "snapmaker_artisan",
      "snapmaker_a350t",
      "voron_v0",
      "voron_trident",
      "voron_24",
      "voron_switchwire",
      "peopoly_lantech",
      "peopoly_forge",
      "phrozen_sonic_mega_8k",
      "phrozen_sonic_4k",
      "phrozen_sonic_mini_8k",
      "custom",
    ]);
    expect(printers[0]).toEqual({
      id: "bambu_a1_mini",
      name: "A1 Mini",
      brand: "Bambu Lab",
      power: 170,
      value: 2000,
      usefulLife: 3000,
      maintenancePerHour: 0.2,
      image: "/images/printers/brands/bambu-lab/bambu-lab-a1-mini-card-300.png",
      maxFilaments: 4,
      technology: "fdm",
      buildVolumeMm: { x: 180, y: 180, z: 180 },
      websiteUrl: "https://bambulab.com",
      tags: [],
    });
    const requiredPrinterKeys = [
      "brand",
      "id",
      "maintenancePerHour",
      "name",
      "power",
      "tags",
      "usefulLife",
      "value",
    ];
    const allowedPrinterKeys = new Set([
      ...requiredPrinterKeys,
      "buildVolumeMm",
      "image",
      "maxFilaments",
      "maxSpeedMmS",
      "nozzleDiameterMm",
      "technology",
      "websiteUrl",
    ]);
    expect(
      printers.every((printer) => {
        const keys = Object.keys(printer);
        return (
          requiredPrinterKeys.every((key) => keys.includes(key)) &&
          keys.every((key) => allowedPrinterKeys.has(key))
        );
      }),
    ).toBe(true);

    expect(marketplaces.map(({ id }) => id)).toEqual([
      "direct",
      "shopee_ate79",
      "shopee_80mais",
      "mercadolivre",
      "amazon",
      "etsy",
      "shein",
      "tiktok_shop",
      "magalu",
      "balcao",
    ]);
    expect(marketplaces).toEqual([
      {
        id: "direct",
        name: "Venda Direta",
        feePercent: 0,
        feeFixed: 0,
        hasFreeShipping: false,
        logo: "/images/marketplaces/direct.svg",
      },
      {
        id: "shopee_ate79",
        name: "Shopee (até R$79)",
        feePercent: 20,
        feeFixed: 4,
        hasFreeShipping: true,
        shippingFeePercent: 0,
        logo: "/images/marketplaces/shopee_ate79.svg",
      },
      {
        id: "shopee_80mais",
        name: "Shopee (R$80+)",
        feePercent: 14,
        feeFixed: 16,
        hasFreeShipping: true,
        shippingFeePercent: 0,
        logo: "/images/marketplaces/shopee_80mais.svg",
      },
      {
        id: "mercadolivre",
        name: "Mercado Livre",
        feePercent: 16,
        feeFixed: 6.5,
        hasFreeShipping: true,
        shippingFeePercent: 0,
        logo: "/images/marketplaces/mercadolivre.svg",
      },
      {
        id: "amazon",
        name: "Amazon",
        feePercent: 15,
        feeFixed: 0,
        hasFreeShipping: false,
        logo: "/images/marketplaces/amazon.svg",
      },
      {
        id: "etsy",
        name: "Etsy",
        feePercent: 6.5,
        feeFixed: 3,
        hasFreeShipping: false,
        logo: "/images/marketplaces/etsy.svg",
      },
      {
        id: "shein",
        name: "Shein",
        feePercent: 16,
        feeFixed: 0,
        hasFreeShipping: true,
        logo: "/images/marketplaces/shein.svg",
      },
      {
        id: "tiktok_shop",
        name: "TikTok Shop",
        feePercent: 6,
        feeFixed: 4,
        hasFreeShipping: false,
        logo: "/images/marketplaces/tiktokshop.svg",
      },
      {
        id: "magalu",
        name: "Magalu",
        feePercent: 16,
        feeFixed: 0,
        hasFreeShipping: false,
        logo: "/images/marketplaces/magalu.svg",
      },
      {
        id: "balcao",
        name: "Balcão / retirada",
        feePercent: 0,
        feeFixed: 0,
        hasFreeShipping: false,
        logo: "/images/marketplaces/balcao.svg",
      },
    ]);
  });
});
