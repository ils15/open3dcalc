/**
 * @vitest-environment node
 *
 * Products table tests (Issue #68 — Fase 3 cadastro de produtos).
 * Covers: migration up (0002), drizzle insert/read, NOT NULL constraint,
 * markSold toggle via placeholder-bound update (SQL-safe), migration down,
 * and pre-migration backup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../schema/index.js'
import { migrateDown, backupDatabase } from '../migrate.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let sqlite: Database.Database
let db: ReturnType<typeof drizzle>

function runUpMigrations(sqliteDb: Database.Database): void {
  const dir = path.join(__dirname, '..', 'migrations')
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqliteDb.exec(fs.readFileSync(path.join(dir, file), 'utf-8'))
  }
}

function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const NOW = Date.now()

beforeAll(() => {
  sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  runUpMigrations(sqlite)
  db = drizzle(sqlite, { schema })
})

afterAll(() => {
  sqlite?.close()
})

describe('migration 0002_products (up)', () => {
  it('creates the products table with expected columns', () => {
    const cols = sqlite
      .prepare(`PRAGMA table_info('products')`)
      .all() as Array<{ name: string; notnull: number }>
    const names = cols.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'weight_grams',
        'filament_type',
        'cost_price',
        'sale_price',
        'sold',
        'created_at',
        'updated_at',
      ]),
    )
    expect(cols.find((c) => c.name === 'name')!.notnull).toBe(1)
  })

  it('creates helper indexes on name and sold', () => {
    const idx = sqlite
      .prepare(`PRAGMA index_list('products')`)
      .all() as Array<{ name: string }>
    const names = idx.map((i) => i.name)
    expect(names).toContain('idx_products_name')
    expect(names).toContain('idx_products_sold')
  })
})

describe('products table (drizzle CRUD)', () => {
  it('inserts and reads a product with defaults', () => {
    const id = generateId()
    db.insert(schema.products).values({
      id,
      name: 'Suporte Headset',
      weightGrams: 85,
      filamentType: 'PLA',
      costPrice: 12.5,
      salePrice: 39.9,
      sold: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }).run()

    const row = db.select().from(schema.products).where(eq(schema.products.id, id)).get()
    expect(row).toBeDefined()
    expect(row!.name).toBe('Suporte Headset')
    expect(row!.sold).toBe(0)
  })

  it('rejects NULL name (NOT NULL constraint)', () => {
    expect(() =>
      db.insert(schema.products).values({
        // @ts-expect-error intentional NULL to test DB constraint
        name: null,
        createdAt: NOW,
        updatedAt: NOW,
      }).run(),
    ).toThrow()
  })

  it('marks a product as sold via placeholder-bound update (SQL-safe)', () => {
    const id = generateId()
    db.insert(schema.products).values({ id, name: 'Vaso Espiral', createdAt: NOW, updatedAt: NOW }).run()

    // Drizzle binds values as placeholders — no string interpolation.
    db.update(schema.products).set({ sold: 1 }).where(eq(schema.products.id, id)).run()

    const row = db.select().from(schema.products).where(eq(schema.products.id, id)).get()
    expect(row!.sold).toBe(1)

    // Raw query with explicit placeholder also works and is injection-safe,
    // even with a hostile id value.
    const hostile = `x' OR '1'='1`
    const found = sqlite.prepare(`SELECT * FROM products WHERE id = ?`).get(hostile)
    expect(found).toBeUndefined()

    const count = (
      sqlite.prepare(`SELECT COUNT(*) AS n FROM products`).get() as { n: number }
    ).n
    expect(count).toBeGreaterThan(0)
  })

  it('toggles sold back to available (0)', () => {
    const id = generateId()
    db.insert(schema.products).values({ id, name: 'Toggle', sold: 1, createdAt: NOW, updatedAt: NOW }).run()
    db.update(schema.products).set({ sold: 0 }).where(eq(schema.products.id, id)).run()
    const row = db.select().from(schema.products).where(eq(schema.products.id, id)).get()
    expect(row!.sold).toBe(0)
  })
})

describe('migration down + backup', () => {
  it('backupDatabase() creates a timestamped copy before mutating', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-bak-'))
    const dbPath = path.join(dir, 'test.db')
    const tmp = new Database(dbPath)
    tmp.exec('CREATE TABLE t (id TEXT)')
    tmp.close()

    const backupPath = backupDatabase(dbPath)
    expect(fs.existsSync(backupPath)).toBe(true)
    expect(backupPath).toContain('test.db.bak_')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('migrateDown() drops the products table (rollback)', () => {
    expect(
      sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='products'`).get(),
    ).toBeDefined()
    migrateDown(sqlite)
    expect(
      sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='products'`).get(),
    ).toBeUndefined()
    // Re-apply 0002 up so later suites (if any) still see the table.
    // (Only 0002: migrateDown drops just `products`, and re-running ALL
    // migrations would recreate 0000/0001 tables that still exist.)
    sqlite.exec(fs.readFileSync(path.join(__dirname, '..', 'migrations', '0002_products.sql'), 'utf-8'))
    void sql`SELECT 1`
  })
})
