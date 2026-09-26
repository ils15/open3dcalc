import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  collectSyncData,
  validateBundle,
  exportBundle,
  importBundle,
  applySyncData,
  deriveKey,
  encryptData,
  decryptData,
  hashData,
  importData,
  type SyncData,
  type EncryptedBundle,
} from "@/shared/lib/dataSync";
import { createExportEnvelope } from "@/shared/lib/exportEnvelope";
import { APP_VERSION } from "@/shared/version";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function emptySyncData(): SyncData {
  return {
    settings: {},
    history: [],
    customers: [],
    quotes: [],
    catalog: { printers: [], materials: [], marketplaces: [] },
    filaments: [],
    products: [],
    colorPalette: [],
    modelComparison: [],
    theme: "",
    dashboard: {},
    sections: {},
  };
}

/** Seed every known localStorage key the app persists. */
function seedFullStorage(): void {
  localStorage.setItem(
    "open3dcalc_settings_v2",
    JSON.stringify({ productName: "Vaso", quantity: 2 }),
  );
  localStorage.setItem(
    "open3dcalc_history_v2",
    JSON.stringify({
      state: { entries: [{ id: "h1", timestamp: 1000 }], search: "" },
      version: 2,
    }),
  );
  localStorage.setItem(
    "open3dcalc_customers_v1",
    JSON.stringify({
      state: { customers: [{ id: "c1", name: "Ana" }] },
      version: 1,
    }),
  );
  localStorage.setItem(
    "open3dcalc_quotes_v1",
    JSON.stringify({
      state: { quotes: [{ id: "q1", number: 1 }], nextNumber: 2 },
      version: 1,
    }),
  );
  localStorage.setItem(
    "open3dcalc_catalog_v1",
    JSON.stringify({
      printers: [
        { id: "p-builtin", name: "Ender", custom: false },
        { id: "p-custom", name: "Minha Impressora", custom: true },
      ],
      materials: [{ id: "m-custom", name: "PETG", custom: true }],
      marketplaces: [{ id: "mk-builtin", name: "Shopee", custom: false }],
    }),
  );
  localStorage.setItem(
    "open3dcalc_filaments",
    JSON.stringify([{ id: "f1", brand: "Sunlu" }]),
  );
  localStorage.setItem("open3dcalc_theme", "dark");
  localStorage.setItem(
    "open3dcalc_dashboard_v1",
    JSON.stringify({ chartType: "bar" }),
  );
  localStorage.setItem("open3dcalc_dashboard_goal", "R$ 1000");
  localStorage.setItem(
    "open3dcalc_sections",
    JSON.stringify({ costs: true, labor: false }),
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const MANIFEST_EXPORT_KEYS = [
  "open3dcalc_settings_v2",
  "open3dcalc_history_v2",
  "open3dcalc_customers_v1",
  "open3dcalc_quotes_v1",
  "open3dcalc_catalog_v1",
  "open3dcalc_filaments",
  "open3dcalc_products",
  "open3dcalc_theme",
  "open3dcalc_dashboard_v1",
  "open3dcalc_dashboard_goal",
  "open3dcalc_sections",
  "open3dcalc_color_palette_v1",
  "open3dcalc_model_comparison",
] as const;

function fullRoundTripFixture(): SyncData {
  return {
    settings: {
      activeTab: "resin",
      quantity: 7,
      selectedPrinterId: "printer-custom-🖨️",
      selectedMarketplaceId: "market-place-東京",
      futureSetting: { label: "futuro 🔭", enabled: true },
    },
    history: [
      {
        id: "hist-β-1",
        timestamp: 1_700_000_000_001,
        type: "resin",
        name: "Protótipo 🧪",
        summary: "Resina violeta",
        totalCost: 31.25,
        sellPrice: 62.5,
        profit: 31.25,
        result: { totalCost: 31.25, sellPrice: 62.5, profit: 31.25 },
        snapshot: { selectedPrinterId: "printer-custom-🖨️" },
      },
    ],
    customers: [{ id: "customer-東京", name: "Zoë 🦊" }],
    quotes: [{ id: "quote-007", number: 7, total: 62.5 }],
    quotesNextNumber: 8,
    catalog: {
      printers: [
        { id: "printer-custom-🖨️", name: "Minha impressora", custom: true },
      ],
      materials: [{ id: "material-紫", name: "Resina violeta", custom: true }],
      marketplaces: [
        { id: "market-place-東京", name: "東京市場", custom: true },
      ],
    },
    filaments: [{ id: "filament-λ", brand: "Filamento Ω" }],
    products: [
      {
        id: "product-β",
        name: "Peça final",
        quantity: 2,
        result: { totalCost: 31.25 },
      },
    ],
    theme: "dark",
    dashboard: { chartType: "profit", goal: "€ 2.000" },
    sections: { costs: true, labor: false },
    colorPalette: [{ id: "color-azul", name: "Azul oceano", hex: "#0af" }],
    modelComparison: [
      {
        id: "comparison-β",
        fileName: "peça-final.stl",
        dimensions: { x: 12.5, y: 18, z: 4 },
        volumeCm3: 2.4,
        weight: 31,
        printTimeHours: 1.75,
        triangleCount: 247,
      },
    ],
  } as SyncData;
}

function localStorageSnapshot(): [string, string][] {
  return Array.from({ length: localStorage.length }, (_, index) => {
    const key = localStorage.key(index)!;
    return [key, localStorage.getItem(key)!] as [string, string];
  }).sort(([a], [b]) => a.localeCompare(b));
}

/* ------------------------------------------------------------------ */
/*  collectSyncData                                                    */
/* ------------------------------------------------------------------ */

describe("collectSyncData", () => {
  beforeEach(() => localStorage.clear());

  it("returns the correct structure from localStorage", () => {
    seedFullStorage();

    const data = collectSyncData();

    expect(data.settings).toEqual({ productName: "Vaso", quantity: 2 });
    expect(data.history).toEqual([{ id: "h1", timestamp: 1000 }]);
    expect(data.customers).toEqual([{ id: "c1", name: "Ana" }]);
    expect(data.quotes).toEqual([{ id: "q1", number: 1 }]);
    expect(data.quotesNextNumber).toBe(2);
    // Only custom catalog items are exported
    expect(data.catalog.printers).toEqual([
      { id: "p-custom", name: "Minha Impressora", custom: true },
    ]);
    expect(data.catalog.materials).toEqual([
      { id: "m-custom", name: "PETG", custom: true },
    ]);
    expect(data.catalog.marketplaces).toEqual([]);
    expect(data.filaments).toEqual([{ id: "f1", brand: "Sunlu" }]);
    expect(data.theme).toBe("dark");
    expect(data.dashboard).toEqual({ chartType: "bar", goal: "R$ 1000" });
    expect(data.sections).toEqual({ costs: true, labor: false });
  });

  it("returns empty defaults when localStorage is empty", () => {
    const data = collectSyncData();
    expect(data).toEqual(emptySyncData());
  });

  it("tolerates corrupt JSON values without failing", () => {
    localStorage.setItem("open3dcalc_settings_v2", "{corrupt");
    localStorage.setItem("open3dcalc_history_v2", "not-json");
    const data = collectSyncData();
    expect(data.settings).toEqual({});
    expect(data.history).toEqual([]);
  });

  it("handles plain-array history format as fallback", () => {
    localStorage.setItem(
      "open3dcalc_history_v2",
      JSON.stringify([{ id: "h1", timestamp: 1 }]),
    );
    expect(collectSyncData().history).toEqual([{ id: "h1", timestamp: 1 }]);
  });
});

/* ------------------------------------------------------------------ */
/*  validateBundle                                                     */
/* ------------------------------------------------------------------ */

describe("validateBundle", () => {
  beforeEach(() => localStorage.clear());

  it("accepts a valid unencrypted bundle", async () => {
    const bundle = await exportBundle();
    expect(validateBundle(bundle)).toBe(true);
  });

  it("accepts a valid encrypted bundle", async () => {
    const bundle = await exportBundle("senha123");
    expect(validateBundle(bundle)).toBe(true);
  });

  it("rejects non-objects and empty values", () => {
    expect(validateBundle(null)).toBe(false);
    expect(validateBundle(undefined)).toBe(false);
    expect(validateBundle(42)).toBe(false);
    expect(validateBundle("texto")).toBe(false);
    expect(validateBundle({})).toBe(false);
  });

  it("rejects wrong version and wrong format", () => {
    const valid = {
      version: "1.0",
      format: "open3dcalc-export",
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      platform: "web",
      encrypted: false,
      data: emptySyncData(),
    };
    expect(validateBundle(valid)).toBe(true);
    expect(validateBundle({ ...valid, version: "2.0" })).toBe(false);
    expect(validateBundle({ ...valid, format: "outro-formato" })).toBe(false);
  });

  it("rejects encrypted bundles missing crypto fields", () => {
    const incomplete = {
      version: "1.0",
      format: "open3dcalc-export",
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      platform: "web",
      encrypted: true,
      data: "AAAA",
    };
    expect(validateBundle(incomplete)).toBe(false);
  });

  it("rejects unencrypted bundles without valid SyncData", () => {
    const invalidData = {
      version: "1.0",
      format: "open3dcalc-export",
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      platform: "web",
      encrypted: false,
      data: { history: [], customers: [] }, // missing settings, quotes, catalog, ...
    };
    expect(validateBundle(invalidData)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  exportBundle                                                       */
/* ------------------------------------------------------------------ */

describe("exportBundle", () => {
  beforeEach(() => localStorage.clear());

  it("produces an unencrypted bundle without a password", async () => {
    seedFullStorage();
    const bundle = await exportBundle();

    expect(bundle.encrypted).toBe(false);
    expect(bundle.version).toBe("1.0");
    expect(bundle.format).toBe("open3dcalc-export");
    expect(bundle.appVersion).toBe(APP_VERSION);
    expect(typeof bundle.exportedAt).toBe("string");
    expect(Number.isNaN(Date.parse(bundle.exportedAt))).toBe(false);
    expect(bundle.platform).toBe("web");
    expect(bundle.salt).toBeUndefined();
    expect(bundle.iv).toBeUndefined();
    expect(typeof bundle.data).toBe("object");
    expect(Array.isArray((bundle as { data: SyncData }).data.history)).toBe(
      true,
    );
  });

  it("produces an encrypted bundle with a password", async () => {
    seedFullStorage();
    const bundle = (await exportBundle("segredo")) as EncryptedBundle;

    expect(bundle.encrypted).toBe(true);
    expect(typeof bundle.data).toBe("string");
    expect(typeof bundle.salt).toBe("string");
    expect(typeof bundle.iv).toBe("string");
    expect(typeof bundle.checksum).toBe("string");
    // Salt must be 16 raw bytes and IV 12 raw bytes
    expect(base64ToBytes(bundle.salt).length).toBe(16);
    expect(base64ToBytes(bundle.iv).length).toBe(12);
  });

  it("produces a different salt/iv on each export (fresh randomness)", async () => {
    const a = (await exportBundle("senha")) as EncryptedBundle;
    const b = (await exportBundle("senha")) as EncryptedBundle;
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });
});

/* ------------------------------------------------------------------ */
/*  importBundle round-trip                                            */
/* ------------------------------------------------------------------ */

describe("importBundle round-trip", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips export → import preserving all data (encrypted)", async () => {
    seedFullStorage();
    const before = collectSyncData();
    const bundle = await exportBundle("senha-rt");
    localStorage.clear();

    const result = await importBundle(bundle, "senha-rt");

    expect(result.imported).toEqual(
      expect.arrayContaining([
        "settings",
        "history",
        "customers",
        "quotes",
        "catalog",
        "filaments",
        "theme",
        "dashboard",
        "sections",
      ]),
    );
    const after = collectSyncData();
    expect(after.settings).toEqual(before.settings);
    expect(after.history).toEqual(before.history);
    expect(after.customers).toEqual(before.customers);
    expect(after.quotes).toEqual(before.quotes);
    expect(after.catalog).toEqual(before.catalog);
    expect(after.filaments).toEqual(before.filaments);
    expect(after.theme).toEqual(before.theme);
    expect(after.dashboard).toEqual(before.dashboard);
    expect(after.sections).toEqual(before.sections);
  });

  it("round-trips unencrypted bundles as well", async () => {
    seedFullStorage();
    const before = collectSyncData();
    const bundle = await exportBundle();
    localStorage.clear();

    await importBundle(bundle);

    const after = collectSyncData();
    expect(after.settings).toEqual(before.settings);
    expect(after.history).toEqual(before.history);
    expect(after.customers).toEqual(before.customers);
    expect(after.quotes).toEqual(before.quotes);
  });
});

/* ------------------------------------------------------------------ */
/*  Crypto helpers                                                     */
/* ------------------------------------------------------------------ */

describe("crypto helpers", () => {
  it("encryptData/decryptData round-trip works", async () => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey("minha-senha", salt);
    const { iv, ciphertext } = await encryptData('{"ola":"mundo"}', key);

    const plain = await decryptData(ciphertext, key, iv);
    expect(plain).toBe('{"ola":"mundo"}');
  });

  it("decryptData fails with a different key (GCM auth)", async () => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyA = await deriveKey("senha-a", salt);
    const keyB = await deriveKey("senha-b", salt);
    const { iv, ciphertext } = await encryptData("segredo", keyA);

    await expect(decryptData(ciphertext, keyB, iv)).rejects.toThrow();
  });

  it("decryptData fails on tampered ciphertext", async () => {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey("senha", salt);
    const { iv, ciphertext } = await encryptData("segredo", key);
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      decryptData(tampered.buffer as ArrayBuffer, key, iv),
    ).rejects.toThrow();
  });

  it("hashData produces consistent SHA-256", async () => {
    const h1 = await hashData("abc");
    const h2 = await hashData("abc");
    const h3 = await hashData("abd");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(typeof h1).toBe("string");
  });
});

/* ------------------------------------------------------------------ */
/*  Merge strategy                                                     */
/* ------------------------------------------------------------------ */

describe("applySyncData merge strategy", () => {
  beforeEach(() => localStorage.clear());

  it("deduplicates collections by id keeping the newest item", () => {
    localStorage.setItem(
      "open3dcalc_history_v2",
      JSON.stringify({
        state: {
          entries: [
            { id: "h1", timestamp: 100 },
            { id: "h2", timestamp: 200 },
          ],
        },
        version: 2,
      }),
    );

    const imported = emptySyncData();
    imported.history = [
      { id: "h1", timestamp: 999 }, // newer than local h1 → wins
      { id: "h3", timestamp: 300 },
    ];

    const result = applySyncData(imported, "merge");

    const stored = JSON.parse(localStorage.getItem("open3dcalc_history_v2")!);
    expect(stored.state.entries).toEqual([
      { id: "h1", timestamp: 999 },
      { id: "h2", timestamp: 200 },
      { id: "h3", timestamp: 300 },
    ]);
    expect(result.conflicts).toContain("history");
  });

  it("keeps the local item when it is newer than the imported one", () => {
    localStorage.setItem(
      "open3dcalc_customers_v1",
      JSON.stringify({
        state: { customers: [{ id: "c1", name: "Nova", updatedAt: 500 }] },
        version: 1,
      }),
    );

    const imported = emptySyncData();
    imported.customers = [{ id: "c1", name: "Velha", updatedAt: 100 }];

    applySyncData(imported, "merge");

    const stored = JSON.parse(localStorage.getItem("open3dcalc_customers_v1")!);
    expect(stored.state.customers).toEqual([
      { id: "c1", name: "Nova", updatedAt: 500 },
    ]);
  });

  it("replaces settings with imported values in merge mode", () => {
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify({ productName: "Local" }),
    );

    const imported = emptySyncData();
    imported.settings = { productName: "Importado", quantity: 5 };

    applySyncData(imported, "merge");

    expect(JSON.parse(localStorage.getItem("open3dcalc_settings_v2")!)).toEqual(
      {
        productName: "Importado",
        quantity: 5,
      },
    );
  });

  it("does not wipe local settings with empty imported settings in merge mode", () => {
    localStorage.setItem(
      "open3dcalc_settings_v2",
      JSON.stringify({ productName: "Local" }),
    );

    applySyncData(emptySyncData(), "merge");

    expect(JSON.parse(localStorage.getItem("open3dcalc_settings_v2")!)).toEqual(
      {
        productName: "Local",
      },
    );
  });

  it("imports only custom catalog items, preserving built-ins", () => {
    localStorage.setItem(
      "open3dcalc_catalog_v1",
      JSON.stringify({
        printers: [
          { id: "builtin", name: "Ender", custom: false },
          { id: "mine", name: "Minha", custom: true },
        ],
        materials: [],
        marketplaces: [],
      }),
    );

    const imported = emptySyncData();
    imported.catalog.printers = [
      { id: "builtin", name: "Ender", custom: false }, // must be ignored
      { id: "new-custom", name: "Nova", custom: true },
    ];

    applySyncData(imported, "merge");

    const stored = JSON.parse(localStorage.getItem("open3dcalc_catalog_v1")!);
    expect(stored.printers).toEqual([
      { id: "builtin", name: "Ender", custom: false },
      { id: "mine", name: "Minha", custom: true },
      { id: "new-custom", name: "Nova", custom: true },
    ]);
  });

  it("quotes nextNumber uses Math.max(local, imported) + 1", () => {
    localStorage.setItem(
      "open3dcalc_quotes_v1",
      JSON.stringify({
        state: { quotes: [{ id: "q1", number: 1 }], nextNumber: 5 },
        version: 1,
      }),
    );

    const imported = emptySyncData();
    imported.quotes = [{ id: "q2", number: 2 }];
    imported.quotesNextNumber = 7;

    applySyncData(imported, "merge");

    const stored = JSON.parse(localStorage.getItem("open3dcalc_quotes_v1")!);
    expect(stored.state.nextNumber).toBe(8); // Math.max(5, 7) + 1
    expect(stored.state.quotes).toHaveLength(2);
  });

  it("replace mode fully replaces collections", () => {
    localStorage.setItem(
      "open3dcalc_history_v2",
      JSON.stringify({
        state: { entries: [{ id: "h1", timestamp: 100 }] },
        version: 2,
      }),
    );

    const imported = emptySyncData();
    imported.history = [{ id: "hX", timestamp: 1 }];

    const result = applySyncData(imported, "replace");

    const stored = JSON.parse(localStorage.getItem("open3dcalc_history_v2")!);
    expect(stored.state.entries).toEqual([{ id: "hX", timestamp: 1 }]);
    expect(result.conflicts).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  Import error handling                                              */
/* ------------------------------------------------------------------ */

describe("importBundle error handling", () => {
  beforeEach(() => localStorage.clear());

  it("throws a clear error for invalid bundle format", async () => {
    await expect(importBundle({} as never)).rejects.toThrow("inválido");
  });

  it("throws when a password is missing on an encrypted bundle", async () => {
    const bundle = await exportBundle("senha");
    await expect(importBundle(bundle)).rejects.toThrow("criptografado");
  });

  it("throws a clear PT-BR error on wrong password", async () => {
    seedFullStorage();
    const bundle = await exportBundle("senha-correta");
    await expect(importBundle(bundle, "senha-errada")).rejects.toThrow(
      "Senha incorreta",
    );
  });

  it("throws a clear error on corrupted checksum", async () => {
    seedFullStorage();
    const bundle = (await exportBundle("senha")) as EncryptedBundle;
    bundle.checksum = bytesToBase64(new Uint8Array(32)); // bogus checksum

    await expect(importBundle(bundle, "senha")).rejects.toThrow("checksum");
  });

  it("throws a clear error on corrupted ciphertext", async () => {
    seedFullStorage();
    const bundle = (await exportBundle("senha")) as EncryptedBundle;
    const bytes = base64ToBytes(bundle.data);
    bytes[0] ^= 0xff;
    bundle.data = bytesToBase64(bytes);

    await expect(importBundle(bundle, "senha")).rejects.toThrow("corrompido");
  });

  it("throws a clear error on unencrypted bundle with bad checksum", async () => {
    const bundle = await exportBundle();
    const corrupted = { ...bundle, checksum: "invalid-checksum-value" };
    await expect(importBundle(corrupted)).rejects.toThrow("checksum");
  });
});

/* ------------------------------------------------------------------ */
/*  User import compatibility + no-write gate                           */
/* ------------------------------------------------------------------ */

function seedFromSyncData(data: SyncData): void {
  localStorage.setItem("open3dcalc_settings_v2", JSON.stringify(data.settings));
  localStorage.setItem(
    "open3dcalc_history_v2",
    JSON.stringify({ state: { entries: data.history }, version: 2 }),
  );
  localStorage.setItem(
    "open3dcalc_customers_v1",
    JSON.stringify({ state: { customers: data.customers }, version: 1 }),
  );
  localStorage.setItem(
    "open3dcalc_quotes_v1",
    JSON.stringify({
      state: { quotes: data.quotes, nextNumber: data.quotesNextNumber },
      version: 1,
    }),
  );
  localStorage.setItem("open3dcalc_catalog_v1", JSON.stringify(data.catalog));
  localStorage.setItem("open3dcalc_filaments", JSON.stringify(data.filaments));
  localStorage.setItem(
    "open3dcalc_products",
    JSON.stringify({ state: { products: data.products ?? [] }, version: 1 }),
  );
  localStorage.setItem("open3dcalc_theme", data.theme);
  const { goal, ...dashboard } = data.dashboard;
  localStorage.setItem("open3dcalc_dashboard_v1", JSON.stringify(dashboard));
  if (typeof goal === "string")
    localStorage.setItem("open3dcalc_dashboard_goal", goal);
  localStorage.setItem("open3dcalc_sections", JSON.stringify(data.sections));
  localStorage.setItem(
    "open3dcalc_color_palette_v1",
    JSON.stringify(data.colorPalette ?? []),
  );
  localStorage.setItem(
    "open3dcalc_model_comparison",
    JSON.stringify({
      state: { entries: data.modelComparison ?? [] },
      version: 1,
    }),
  );
}

function importFile(text: string): File {
  return new File([text], "synthetic.open3dcalc", { type: "application/json" });
}

describe("dataSync user import compatibility and no-write gate", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips all supported user data in encrypted v1.1 envelopes", async () => {
    const fixture = fullRoundTripFixture();
    seedFromSyncData(fixture);
    const before = collectSyncData();
    const envelope = await createExportEnvelope(before, "synthetic-password");
    localStorage.clear();

    const result = await importData(importFile(envelope), {
      password: "synthetic-password",
      mode: "replace",
    });

    expect(result.errors).toBe(0);
    expect(collectSyncData()).toEqual(before);
    expect(collectSyncData().settings.futureSetting).toEqual({
      label: "futuro 🔭",
      enabled: true,
    });
  });

  it("round-trips legacy encrypted 1.0 bundles while retaining IDs and fields", async () => {
    const fixture = fullRoundTripFixture();
    seedFromSyncData(fixture);
    const before = collectSyncData();
    const legacyBundle = await exportBundle("legacy synthetic password");
    localStorage.clear();

    const result = await importData(importFile(JSON.stringify(legacyBundle)), {
      password: "legacy synthetic password",
      mode: "replace",
    });

    expect(result.errors).toBe(0);
    expect(collectSyncData()).toEqual(before);
  });

  it("exports the current supported empty defaults for optional manifest data", () => {
    expect(collectSyncData()).toEqual({
      ...emptySyncData(),
      colorPalette: [],
      modelComparison: [],
    });
  });

  it("rejects invalid files without any Storage mutation or raw-key changes", async () => {
    const validData = fullRoundTripFixture();
    const goodEnvelope = JSON.parse(
      await createExportEnvelope(validData, "synthetic-password"),
    ) as Record<string, unknown>;
    const tampered = structuredClone(goodEnvelope) as Record<string, unknown>;
    const tamperedPayload = tampered.payload as Record<string, unknown>;
    const tamperedCiphertext = tamperedPayload.ciphertext_base64 as string;
    tamperedPayload.ciphertext_base64 = `${tamperedCiphertext[0] === "A" ? "B" : "A"}${tamperedCiphertext.slice(1)}`;
    const badHeader = structuredClone(goodEnvelope) as Record<string, unknown>;
    const badKdf = badHeader.kdf as Record<string, unknown>;
    badKdf.iterations = (badKdf.iterations as number) + 1;
    const badLimits = structuredClone(goodEnvelope) as Record<string, unknown>;
    const changedLimits = badLimits.limits as Record<string, unknown>;
    changedLimits.records = (changedLimits.records as number) + 1;
    const badDigest = structuredClone(goodEnvelope) as Record<string, unknown>;
    const badIntegrity = badDigest.integrity as Record<string, unknown>;
    badIntegrity.plaintext_digest_hex = "0".repeat(64);
    const malformedAuthenticated = await createExportEnvelope(
      { ...validData, history: null } as unknown as SyncData,
      "synthetic-password",
    );
    const malformedSectionsAuthenticated = await createExportEnvelope(
      { ...validData, sections: { costs: "enabled" } } as unknown as SyncData,
      "synthetic-password",
    );
    const missingComparisonPayload: Record<string, unknown> = { ...validData };
    delete missingComparisonPayload.modelComparison;
    const missingComparisonAuthenticated = await createExportEnvelope(
      missingComparisonPayload as unknown as SyncData,
      "synthetic-password",
    );
    const legacyBundle = await exportBundle("legacy synthetic password");
    const malformedLegacy = {
      version: "1.0",
      format: "open3dcalc-export",
      exportedAt: new Date(0).toISOString(),
      appVersion: APP_VERSION,
      platform: "web",
      encrypted: false,
      data: { settings: {}, history: null },
    };
    const invalidLegacyChecksum = {
      version: "1.0",
      format: "open3dcalc-export",
      exportedAt: new Date(0).toISOString(),
      appVersion: APP_VERSION,
      platform: "web",
      encrypted: false,
      checksum: "invalid-checksum",
      data: validData,
    };
    const cases: Array<{
      name: string;
      text: string;
      password?: string;
    }> = [
      { name: "malformed JSON", text: "{not json" },
      { name: "invalid v1.0 shape", text: JSON.stringify(malformedLegacy) },
      {
        name: "unsupported v1.0 version",
        text: JSON.stringify({ ...malformedLegacy, version: "9.0" }),
      },
      { name: "missing v1.1 password", text: JSON.stringify(goodEnvelope) },
      {
        name: "wrong v1.1 password",
        text: JSON.stringify(goodEnvelope),
        password: "wrong-password",
      },
      {
        name: "tampered authentication tag",
        text: JSON.stringify(tampered),
        password: "synthetic-password",
      },
      {
        name: "invalid header",
        text: JSON.stringify(badHeader),
        password: "synthetic-password",
      },
      {
        name: "invalid declared limits",
        text: JSON.stringify(badLimits),
        password: "synthetic-password",
      },
      {
        name: "plaintext digest mismatch",
        text: JSON.stringify(badDigest),
        password: "synthetic-password",
      },
      {
        name: "authenticated but malformed v1.1 SyncData",
        text: malformedAuthenticated,
        password: "synthetic-password",
      },
      {
        name: "authenticated v1.1 sections with malformed values",
        text: malformedSectionsAuthenticated,
        password: "synthetic-password",
      },
      {
        name: "authenticated v1.1 missing a current supported key",
        text: missingComparisonAuthenticated,
        password: "synthetic-password",
      },
      {
        name: "missing legacy 1.0 password",
        text: JSON.stringify(legacyBundle),
      },
      {
        name: "wrong legacy 1.0 password",
        text: JSON.stringify(legacyBundle),
        password: "wrong-password",
      },
      {
        name: "legacy checksum mismatch",
        text: JSON.stringify(invalidLegacyChecksum),
      },
    ];

    localStorage.clear();
    for (const [index, key] of MANIFEST_EXPORT_KEYS.entries()) {
      if (index % 2 === 0)
        localStorage.setItem(key, `raw:${key}:keep-${index}`);
    }
    const before = localStorageSnapshot();
    expect(MANIFEST_EXPORT_KEYS).toEqual([
      "open3dcalc_settings_v2",
      "open3dcalc_history_v2",
      "open3dcalc_customers_v1",
      "open3dcalc_quotes_v1",
      "open3dcalc_catalog_v1",
      "open3dcalc_filaments",
      "open3dcalc_products",
      "open3dcalc_theme",
      "open3dcalc_dashboard_v1",
      "open3dcalc_dashboard_goal",
      "open3dcalc_sections",
      "open3dcalc_color_palette_v1",
      "open3dcalc_model_comparison",
    ]);
    expect(before.map(([key]) => key)).toEqual(
      MANIFEST_EXPORT_KEYS.filter((_, index) => index % 2 === 0).sort(),
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");

    for (const testCase of cases) {
      await expect(
        importData(importFile(testCase.text), {
          password: testCase.password,
          mode: "replace",
        }),
        testCase.name,
      ).rejects.toThrow();
      expect(localStorageSnapshot(), testCase.name).toEqual(before);
      expect(setItem, testCase.name).not.toHaveBeenCalled();
      expect(removeItem, testCase.name).not.toHaveBeenCalled();
      expect(clear, testCase.name).not.toHaveBeenCalled();
    }

    setItem.mockRestore();
    removeItem.mockRestore();
    clear.mockRestore();
  });
});
