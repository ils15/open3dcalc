import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { catalogPrinters, catalogMaterials, catalogMarketplaces } from './schema/index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Inline fallback data (mirrors src/lib/printers.ts / materials.ts / marketplace.ts) ──

interface SeedPrinter {
  id: string
  name: string
  brand: string
  power: number
  value: number
  usefulLife: number
  maintenancePerHour: number
  image?: string
  maxFilaments?: number
}

interface SeedMaterial {
  id: string
  name: string
  density: number
  avgPrice: number
  type: 'fdm' | 'resin'
}

interface SeedMarketplace {
  id: string
  name: string
  feePercent: number
  feeFixed: number
  hasFreeShipping: boolean
  shippingFeePercent?: number
}

// Top-5 common printers used as fallback when printers-database.json is unavailable
const FALLBACK_PRINTERS: SeedPrinter[] = [
  { id: 'bambu_a1_mini', name: 'A1 Mini', brand: 'Bambu Lab', power: 170, value: 2000, usefulLife: 3000, maintenancePerHour: 0.20, maxFilaments: 4 },
  { id: 'bambu_p1s', name: 'P1S', brand: 'Bambu Lab', power: 350, value: 5500, usefulLife: 4000, maintenancePerHour: 0.40, maxFilaments: 4 },
  { id: 'bambu_x1c', name: 'X1 Carbon', brand: 'Bambu Lab', power: 350, value: 10000, usefulLife: 5000, maintenancePerHour: 0.60, maxFilaments: 4 },
  { id: 'creality_ender_3_v3_se', name: 'Ender 3 V3 SE', brand: 'Creality', power: 180, value: 1400, usefulLife: 2500, maintenancePerHour: 0.14 },
  { id: 'prusa_mk4s', name: 'MK4S', brand: 'Prusa', power: 180, value: 8000, usefulLife: 4500, maintenancePerHour: 0.30 },
]

const FALLBACK_MATERIALS: SeedMaterial[] = [
  { id: 'pla', name: 'PLA', density: 1.24, avgPrice: 90, type: 'fdm' },
  { id: 'pla_silk', name: 'PLA Silk', density: 1.24, avgPrice: 120, type: 'fdm' },
  { id: 'pla_plus', name: 'PLA+', density: 1.26, avgPrice: 100, type: 'fdm' },
  { id: 'petg', name: 'PETG', density: 1.27, avgPrice: 110, type: 'fdm' },
  { id: 'abs', name: 'ABS', density: 1.04, avgPrice: 100, type: 'fdm' },
  { id: 'asa', name: 'ASA', density: 1.05, avgPrice: 140, type: 'fdm' },
  { id: 'tpu_85a', name: 'TPU 85A', density: 1.20, avgPrice: 130, type: 'fdm' },
  { id: 'tpu_95a', name: 'TPU 95A', density: 1.22, avgPrice: 120, type: 'fdm' },
  { id: 'nylon_pa6', name: 'Nylon PA6', density: 1.14, avgPrice: 140, type: 'fdm' },
  { id: 'nylon_pa12', name: 'Nylon PA12', density: 1.01, avgPrice: 160, type: 'fdm' },
  { id: 'pc', name: 'Policarbonato (PC)', density: 1.20, avgPrice: 180, type: 'fdm' },
  { id: 'pc_abs', name: 'PC/ABS', density: 1.15, avgPrice: 160, type: 'fdm' },
  { id: 'pla_cf', name: 'PLA + Fibra de Carbono', density: 1.30, avgPrice: 160, type: 'fdm' },
  { id: 'petg_cf', name: 'PETG + Fibra de Carbono', density: 1.28, avgPrice: 180, type: 'fdm' },
  { id: 'nylon_cf', name: 'Nylon + Fibra de Carbono', density: 1.10, avgPrice: 250, type: 'fdm' },
  { id: 'pla_wood', name: 'PLA + Madeira', density: 1.20, avgPrice: 130, type: 'fdm' },
  { id: 'pla_metal', name: 'PLA + Metal', density: 1.80, avgPrice: 200, type: 'fdm' },
  { id: 'hips', name: 'HIPS', density: 1.03, avgPrice: 130, type: 'fdm' },
  { id: 'pva', name: 'PVA', density: 1.23, avgPrice: 200, type: 'fdm' },
  { id: 'pp', name: 'Polipropileno (PP)', density: 0.90, avgPrice: 150, type: 'fdm' },
  { id: 'peek', name: 'PEEK', density: 1.32, avgPrice: 1000, type: 'fdm' },
  { id: 'peek_cf', name: 'PEEK + CF', density: 1.40, avgPrice: 1200, type: 'fdm' },
  { id: 'ultem', name: 'PEI / ULTEM', density: 1.27, avgPrice: 1500, type: 'fdm' },
  { id: 'standard', name: 'Resina Standard', density: 1.10, avgPrice: 180, type: 'resin' },
  { id: 'abs_like', name: 'Resina ABS-Like', density: 1.15, avgPrice: 200, type: 'resin' },
  { id: 'water_washable', name: 'Resina Water Washable', density: 1.10, avgPrice: 220, type: 'resin' },
  { id: 'tough', name: 'Resina Tough', density: 1.12, avgPrice: 250, type: 'resin' },
  { id: 'flexible', name: 'Resina Flexible', density: 1.08, avgPrice: 280, type: 'resin' },
  { id: 'clear', name: 'Resina Transparente', density: 1.10, avgPrice: 200, type: 'resin' },
  { id: 'dental', name: 'Resina Odontológica', density: 1.15, avgPrice: 500, type: 'resin' },
  { id: 'castable', name: 'Resina Fundível', density: 1.05, avgPrice: 350, type: 'resin' },
]

const FALLBACK_MARKETPLACES: SeedMarketplace[] = [
  { id: 'direct', name: 'Venda Direta', feePercent: 0, feeFixed: 0, hasFreeShipping: false },
  { id: 'shopee_ate79', name: 'Shopee (até R$79)', feePercent: 20, feeFixed: 4, hasFreeShipping: true, shippingFeePercent: 0 },
  { id: 'shopee_80mais', name: 'Shopee (R$80+)', feePercent: 14, feeFixed: 16, hasFreeShipping: true, shippingFeePercent: 0 },
  { id: 'mercadolivre', name: 'Mercado Livre', feePercent: 16, feeFixed: 6.50, hasFreeShipping: true, shippingFeePercent: 0 },
  { id: 'amazon', name: 'Amazon', feePercent: 15, feeFixed: 0, hasFreeShipping: false },
  { id: 'etsy', name: 'Etsy', feePercent: 6.5, feeFixed: 3, hasFreeShipping: false },
]

// ── Loaders ────────────────────────────────────────────────────────────────

function loadPrintersJson(): SeedPrinter[] {
  try {
    const jsonPath = path.join(__dirname, '..', 'src', 'data', 'printers-database.json')
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>[]
    return data.map((p) => ({
      id: String(p['id'] ?? ''),
      name: String(p['name'] ?? ''),
      brand: String(p['brand'] ?? ''),
      power: Number(p['power'] ?? 0),
      value: Number(p['value'] ?? 0),
      usefulLife: Number(p['usefulLife'] ?? 0),
      maintenancePerHour: Number(p['maintenancePerHour'] ?? 0),
      image: typeof p['image'] === 'string' ? p['image'] : undefined,
      maxFilaments: typeof p['maxFilaments'] === 'number' ? p['maxFilaments'] : undefined,
    })).filter((p) => p.id && p.name)
  } catch {
    return FALLBACK_PRINTERS
  }
}

// ── Seed function ──────────────────────────────────────────────────────────

/**
 * Inserts built-in catalog data into the database if the catalog tables are empty.
 * Idempotent: subsequent calls are no-ops.
 *
 * Adapted for PostgreSQL: uses async Drizzle PostgresJsDatabase instead of
 * sync BetterSQLite3Database. Boolean values are stored as native booleans
 * rather than SQLite integers.
 */
export async function seed(db: PostgresJsDatabase<Record<string, unknown>>): Promise<{ printers: number; materials: number; marketplaces: number }> {
  const result = { printers: 0, materials: 0, marketplaces: 0 }

  // Seed printers
  const existingPrinters = await db.select({ id: catalogPrinters.id }).from(catalogPrinters)
  if (existingPrinters.length === 0) {
    const printers = loadPrintersJson()
    for (const p of printers) {
      await db.insert(catalogPrinters).values({
        id: p.id,
        name: p.name,
        brand: p.brand,
        power: p.power,
        value: p.value,
        usefulLife: p.usefulLife,
        maintenancePerHour: p.maintenancePerHour,
        image: p.image ?? null,
        maxFilaments: p.maxFilaments ?? null,
        custom: false,
      })
    }
    result.printers = printers.length
  }

  // Seed materials
  const existingMaterials = await db.select({ id: catalogMaterials.id }).from(catalogMaterials)
  if (existingMaterials.length === 0) {
    for (const m of FALLBACK_MATERIALS) {
      await db.insert(catalogMaterials).values({
        id: m.id,
        name: m.name,
        density: m.density,
        avgPrice: m.avgPrice,
        type: m.type,
        custom: false,
      })
    }
    result.materials = FALLBACK_MATERIALS.length
  }

  // Seed marketplaces
  const existingMarketplaces = await db.select({ id: catalogMarketplaces.id }).from(catalogMarketplaces)
  if (existingMarketplaces.length === 0) {
    for (const mp of FALLBACK_MARKETPLACES) {
      await db.insert(catalogMarketplaces).values({
        id: mp.id,
        name: mp.name,
        feePercent: mp.feePercent,
        feeFixed: mp.feeFixed,
        hasFreeShipping: mp.hasFreeShipping,
        shippingFeePercent: mp.shippingFeePercent ?? null,
        custom: false,
      })
    }
    result.marketplaces = FALLBACK_MARKETPLACES.length
  }

  return result
}