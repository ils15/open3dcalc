/**
 * @vitest-environment node
 *
 * Database schema tests using in-memory SQLite.
 * These tests verify table creation, basic CRUD, and FK constraints.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, sql } from "drizzle-orm";
import * as schema from "../schema/index.js";
import { runMigrations } from "../database.js";

// ── Helpers ────────────────────────────────────────────────────────────────

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  // Apply the FULL migration sequence (0000→…→0003) via the app's own runner,
  // so the schema under test always matches the shipped migrations — including
  // later ALTER TABLE additions like 0003's tare_grams. A fresh CI checkout
  // must not depend on locally cached compiled schema artifacts.
  runMigrations(sqlite);
  db = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite?.close();
});

// ── Helper: generate IDs matching the existing app pattern ─────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const NOW = Date.now();

// ── Tests ──────────────────────────────────────────────────────────────────

describe("customers table", () => {
  it("inserts and reads a customer", () => {
    const id = generateId("cust");
    db.insert(schema.customers)
      .values({
        id,
        name: "John Doe",
        company: "Acme Inc",
        email: "john@acme.com",
        phone: "+1-555-0100",
        address: "123 Main St",
        notes: "VIP customer",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    const row = db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.name).toBe("John Doe");
    expect(row!.email).toBe("john@acme.com");
    expect(row!.createdAt).toBe(NOW);
  });

  it("allows nullable fields to be null", () => {
    const id = generateId("cust");
    db.insert(schema.customers)
      .values({
        id,
        name: "Minimal Customer",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    const row = db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.company).toBeNull();
    expect(row!.email).toBeNull();
    expect(row!.phone).toBeNull();
    expect(row!.address).toBeNull();
    expect(row!.notes).toBeNull();
  });
});

describe("quotes table", () => {
  it("inserts and reads a quote", () => {
    const id = generateId("quote");
    db.insert(schema.quotes)
      .values({
        id,
        number: 42,
        title: "Prototype batch",
        customerId: null,
        customerSnapshot: JSON.stringify({
          name: "Walk-in",
          company: null,
          email: null,
          phone: null,
        }),
        globalDiscountPercent: 5,
        subtotal: 100,
        discountAmount: 5,
        total: 95,
        status: "draft",
        validUntil: "2026-12-31",
        paymentTerms: "Net 30",
        deliveryEstimate: "2 weeks",
        footerNote: "Thank you!",
        createdAt: NOW,
        updatedAt: NOW,
        exportedAt: null,
      })
      .run();

    const row = db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.number).toBe(42);
    expect(row!.title).toBe("Prototype batch");
    expect(row!.status).toBe("draft");
    expect(row!.total).toBe(95);
  });

  it("links a quote to a customer", () => {
    const customerId = generateId("cust");
    db.insert(schema.customers)
      .values({
        id: customerId,
        name: "Linked Customer",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    const quoteId = generateId("quote");
    db.insert(schema.quotes)
      .values({
        id: quoteId,
        number: 100,
        title: "Linked quote",
        customerId,
        validUntil: "2026-12-31",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    const row = db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.id, quoteId))
      .get();
    expect(row).toBeDefined();
    expect(row!.customerId).toBe(customerId);
  });

  it("sets customerId to NULL when referenced customer is deleted", () => {
    // FK is ON DELETE SET NULL
    const customerId = generateId("cust");
    db.insert(schema.customers)
      .values({
        id: customerId,
        name: "Temp Customer",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    const quoteId = generateId("quote");
    db.insert(schema.quotes)
      .values({
        id: quoteId,
        number: 200,
        title: "Will be orphaned",
        customerId,
        validUntil: "2026-12-31",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    // Delete the customer
    db.delete(schema.customers)
      .where(eq(schema.customers.id, customerId))
      .run();

    const row = db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.id, quoteId))
      .get();
    expect(row).toBeDefined();
    expect(row!.customerId).toBeNull();
  });
});

describe("quote_items table", () => {
  it("inserts and reads quote items", () => {
    const quoteId = generateId("quote");
    db.insert(schema.quotes)
      .values({
        id: quoteId,
        number: 300,
        title: "Items test",
        validUntil: "2026-12-31",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    db.insert(schema.quoteItems)
      .values({
        quoteId,
        historyEntryId: generateId("hist"),
        name: "Widget A",
        quantity: 3,
        unitPrice: 25.5,
        totalPrice: 72.68,
        discountPercent: 5,
      })
      .run();

    db.insert(schema.quoteItems)
      .values({
        quoteId,
        historyEntryId: generateId("hist"),
        name: "Widget B",
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
        discountPercent: 0,
      })
      .run();

    const rows = db
      .select()
      .from(schema.quoteItems)
      .where(eq(schema.quoteItems.quoteId, quoteId))
      .all();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe("Widget A");
    expect(rows[1]!.name).toBe("Widget B");
  });

  it("cascades deletes when quote is removed", () => {
    const quoteId = generateId("quote");
    db.insert(schema.quotes)
      .values({
        id: quoteId,
        number: 400,
        title: "Cascade test",
        validUntil: "2026-12-31",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    db.insert(schema.quoteItems)
      .values({
        quoteId,
        historyEntryId: generateId("hist"),
        name: "Cascade item",
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
        discountPercent: 0,
      })
      .run();

    // Delete the quote
    db.delete(schema.quotes).where(eq(schema.quotes.id, quoteId)).run();

    const rows = db
      .select()
      .from(schema.quoteItems)
      .where(eq(schema.quoteItems.quoteId, quoteId))
      .all();
    expect(rows).toHaveLength(0);
  });
});

describe("history_entries table", () => {
  it("inserts and reads a history entry", () => {
    const id = generateId("hist");
    const resultJson = JSON.stringify({
      totalCost: 12.5,
      sellPrice: 25,
      profit: 12.5,
    });
    const snapshotJson = JSON.stringify({ type: "fdm", summary: "Test print" });

    db.insert(schema.historyEntries)
      .values({
        id,
        timestamp: NOW,
        type: "fdm",
        name: "Gear v2",
        summary: "PLA, 2h print",
        totalCost: 12.5,
        sellPrice: 25,
        profit: 12.5,
        resultJson,
        snapshotJson,
      })
      .run();

    const row = db
      .select()
      .from(schema.historyEntries)
      .where(eq(schema.historyEntries.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.type).toBe("fdm");
    expect(row!.totalCost).toBe(12.5);
    expect(row!.profit).toBe(12.5);
    expect(row!.snapshotJson).toBe(snapshotJson);
  });

  it("stores resin type entries", () => {
    const id = generateId("hist");
    db.insert(schema.historyEntries)
      .values({
        id,
        timestamp: NOW + 1000,
        type: "resin",
        name: "Miniature",
        summary: "Resin, 4h print",
        totalCost: 30,
        sellPrice: 60,
        profit: 30,
        resultJson: JSON.stringify({
          totalCost: 30,
          sellPrice: 60,
          profit: 30,
        }),
        snapshotJson: null,
      })
      .run();

    const row = db
      .select()
      .from(schema.historyEntries)
      .where(eq(schema.historyEntries.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.type).toBe("resin");
  });
});

describe("filament_spools table", () => {
  it("inserts and reads a filament spool", () => {
    const id = generateId("spool");
    db.insert(schema.filamentSpools)
      .values({
        id,
        brand: "eSUN",
        material: "PLA+",
        color: "Fire Engine Red",
        colorHex: "#CC0000",
        weightGrams: 850,
        originalWeightGrams: 1000,
        costPerKg: 120,
        diameterMm: 1.75,
        dateAdded: NOW,
        notes: "Great for prototypes",
        status: "in_stock",
        purchaseStore: "Amazon",
      })
      .run();

    const row = db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.material).toBe("PLA+");
    expect(row!.weightGrams).toBe(850);
    expect(row!.status).toBe("in_stock");
  });

  it("defaults values correctly", () => {
    const id = generateId("spool");
    db.insert(schema.filamentSpools)
      .values({
        id,
        dateAdded: NOW,
      })
      .run();

    const row = db
      .select()
      .from(schema.filamentSpools)
      .where(eq(schema.filamentSpools.id, id))
      .get();
    expect(row).toBeDefined();
    expect(row!.material).toBe("PLA");
    expect(row!.weightGrams).toBe(0);
    expect(row!.originalWeightGrams).toBe(1000);
    expect(row!.status).toBe("in_stock");
  });
});

describe("catalog_printers table", () => {
  it("inserts and reads a catalog printer", () => {
    db.insert(schema.catalogPrinters)
      .values({
        id: "bambu_a1_mini",
        name: "A1 Mini",
        brand: "Bambu Lab",
        power: 170,
        value: 2000,
        usefulLife: 3000,
        maintenancePerHour: 0.2,
        image: "/images/printers/a1-mini.png",
        maxFilaments: 4,
        custom: 0,
      })
      .run();

    const row = db
      .select()
      .from(schema.catalogPrinters)
      .where(eq(schema.catalogPrinters.id, "bambu_a1_mini"))
      .get();
    expect(row).toBeDefined();
    expect(row!.brand).toBe("Bambu Lab");
    expect(row!.power).toBe(170);
  });
});

describe("catalog_materials table", () => {
  it("inserts and reads a catalog material", () => {
    db.insert(schema.catalogMaterials)
      .values({
        id: "pla",
        name: "PLA",
        density: 1.24,
        avgPrice: 90,
        type: "fdm",
        custom: 0,
      })
      .run();

    const row = db
      .select()
      .from(schema.catalogMaterials)
      .where(eq(schema.catalogMaterials.id, "pla"))
      .get();
    expect(row).toBeDefined();
    expect(row!.density).toBe(1.24);
    expect(row!.type).toBe("fdm");
  });
});

describe("catalog_marketplaces table", () => {
  it("inserts and reads a catalog marketplace", () => {
    db.insert(schema.catalogMarketplaces)
      .values({
        id: "mercadolivre",
        name: "Mercado Livre",
        feePercent: 16,
        feeFixed: 6.5,
        hasFreeShipping: 1,
        shippingFeePercent: 0,
        custom: 0,
      })
      .run();

    const row = db
      .select()
      .from(schema.catalogMarketplaces)
      .where(eq(schema.catalogMarketplaces.id, "mercadolivre"))
      .get();
    expect(row).toBeDefined();
    expect(row!.feePercent).toBe(16);
    expect(row!.feeFixed).toBe(6.5);
    expect(row!.hasFreeShipping).toBe(1);
  });
});

describe("calculator_state table", () => {
  it("stores and retrieves calculator state", () => {
    const stateJson = JSON.stringify({ activeTab: "fdm", quantity: 5 });

    db.insert(schema.calculatorState)
      .values({
        id: 1,
        stateJson,
        updatedAt: NOW,
      })
      .run();

    const row = db
      .select()
      .from(schema.calculatorState)
      .where(eq(schema.calculatorState.id, 1))
      .get();
    expect(row).toBeDefined();
    expect(row!.stateJson).toBe(stateJson);
  });

  it("upserts via INSERT OR REPLACE", () => {
    const newState = JSON.stringify({ activeTab: "resin", quantity: 10 });
    // Upsert: delete + insert pattern
    db.delete(schema.calculatorState)
      .where(eq(schema.calculatorState.id, 1))
      .run();
    db.insert(schema.calculatorState)
      .values({
        id: 1,
        stateJson: newState,
        updatedAt: NOW + 1000,
      })
      .run();

    const row = db
      .select()
      .from(schema.calculatorState)
      .where(eq(schema.calculatorState.id, 1))
      .get();
    expect(row).toBeDefined();
    expect(row!.stateJson).toBe(newState);
  });

  it("enforces single-row constraint (id must be 1)", () => {
    expect(() => {
      db.insert(schema.calculatorState)
        .values({
          id: 2, // invalid
          stateJson: "{}",
          updatedAt: NOW,
        })
        .run();
    }).toThrow();
  });
});

describe("app_settings table", () => {
  it("stores and retrieves key-value settings", () => {
    db.insert(schema.appSettings)
      .values({
        key: "onboarding_complete",
        value: "true",
      })
      .run();

    db.insert(schema.appSettings)
      .values({
        key: "currency",
        value: JSON.stringify({ code: "BRL", symbol: "R$", locale: "pt-BR" }),
      })
      .run();

    const row1 = db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "onboarding_complete"))
      .get();
    expect(row1).toBeDefined();
    expect(row1!.value).toBe("true");

    const row2 = db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "currency"))
      .get();
    expect(row2).toBeDefined();
    expect(JSON.parse(row2!.value)).toEqual({
      code: "BRL",
      symbol: "R$",
      locale: "pt-BR",
    });
  });
});

describe("foreign key constraints", () => {
  it("rejects quote_items with invalid quote_id", () => {
    expect(() => {
      db.insert(schema.quoteItems)
        .values({
          quoteId: "nonexistent_quote_id",
          historyEntryId: generateId("hist"),
          name: "Orphan item",
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
          discountPercent: 0,
        })
        .run();
    }).toThrow();
  });
});

describe("inferred types", () => {
  it("$inferSelect types match expected shapes", () => {
    // Type-level tests: compile-time verification that inferred types are usable
    const customer: schema.Customer = {
      id: "cust_1",
      name: "Test",
      company: null,
      email: null,
      phone: null,
      address: null,
      notes: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(customer.id).toBe("cust_1");

    const quote: schema.Quote = {
      id: "quote_1",
      number: 1,
      title: "Test",
      customerId: null,
      customerSnapshot: null,
      globalDiscountPercent: 0,
      subtotal: 0,
      discountAmount: 0,
      total: 0,
      status: "draft",
      validUntil: "2026-12-31",
      paymentTerms: "",
      deliveryEstimate: "",
      footerNote: null,
      createdAt: NOW,
      updatedAt: NOW,
      exportedAt: null,
    };
    expect(quote.status).toBe("draft");

    const historyEntry: schema.HistoryEntry = {
      id: "hist_1",
      timestamp: NOW,
      type: "fdm",
      name: "Test",
      summary: "",
      totalCost: 0,
      sellPrice: 0,
      profit: 0,
      resultJson: "{}",
      snapshotJson: null,
    };
    expect(historyEntry.type).toBe("fdm");
  });
});
