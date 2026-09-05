/**
 * dataSync coverage for products (Issue #68).
 * Verifies collect/apply round-trip for the open3dcalc_products key
 * in both merge and replace modes.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { collectSyncData, applySyncData, type SyncData } from './dataSync'

function baseData(): SyncData {
  return {
    settings: {},
    history: [],
    customers: [],
    quotes: [],
    catalog: { printers: [], materials: [], marketplaces: [] },
    filaments: [],
    products: [],
    theme: '',
    dashboard: {},
    sections: {},
  }
}

describe('dataSync products coverage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('collectSyncData() includes products from open3dcalc_products', () => {
    localStorage.setItem(
      'open3dcalc_products',
      JSON.stringify({
        state: {
          products: [
            { id: 'prod_1_a', name: 'Suporte', sold: false },
          ],
        },
        version: 1,
      }),
    )
    const data = collectSyncData()
    expect(data.products).toHaveLength(1)
    expect(data.products?.[0]).toMatchObject({ name: 'Suporte' })
  })

  it('applySyncData() merges products by id without duplicating local ones', () => {
    localStorage.setItem(
      'open3dcalc_products',
      JSON.stringify({ state: { products: [{ id: 'prod_1_a', name: 'Local' }] }, version: 1 }),
    )
    const incoming = baseData()
    incoming.products = [
      { id: 'prod_1_a', name: 'Local' },
      { id: 'prod_2_b', name: 'Remote' },
    ]
    const { imported } = applySyncData(incoming, 'merge')
    expect(imported).toContain('products')
    const collected = collectSyncData()
    expect(collected.products).toHaveLength(2)
  })

  it('applySyncData() in replace mode overwrites local products', () => {
    localStorage.setItem(
      'open3dcalc_products',
      JSON.stringify({ state: { products: [{ id: 'prod_old', name: 'Old' }] }, version: 1 }),
    )
    const incoming = baseData()
    incoming.products = [{ id: 'prod_new', name: 'New' }]
    applySyncData(incoming, 'replace')
    const collected = collectSyncData()
    expect(collected.products).toHaveLength(1)
    expect(collected.products?.[0]).toMatchObject({ id: 'prod_new' })
  })
})
