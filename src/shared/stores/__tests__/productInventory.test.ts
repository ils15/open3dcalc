import { describe, it, expect, beforeEach } from 'vitest'
import {
  useProductInventory,
  isBelowCost,
  exportProductsCSV,
} from '../productInventory'
import type { ProductFormData } from '@/shared/types'

const BASE_FORM: ProductFormData = {
  name: 'Suporte Headset',
  weightGrams: 85,
  filamentType: 'PLA',
  costPrice: 12.5,
  salePrice: 39.9,
}

describe('useProductInventory (integration)', () => {
  beforeEach(() => {
    localStorage.clear()
    useProductInventory.setState({ products: [] })
  })

  it('addProduct() → product appears with prod_ id and timestamps', () => {
    const id = useProductInventory.getState().addProduct(BASE_FORM)
    const { products } = useProductInventory.getState()
    expect(products).toHaveLength(1)
    expect(id).toMatch(/^prod_\d+_[a-z0-9]+$/)
    expect(products[0].name).toBe('Suporte Headset')
    expect(products[0].weightGrams).toBe(85)
    expect(products[0].filamentType).toBe('PLA')
    expect(products[0].costPrice).toBe(12.5)
    expect(products[0].salePrice).toBe(39.9)
    expect(products[0].sold).toBe(false)
    expect(products[0].createdAt).toBeGreaterThan(0)
  })

  it('addProduct() rejects name with less than 2 characters', () => {
    expect(() => useProductInventory.getState().addProduct({ ...BASE_FORM, name: 'A' })).toThrow(
      'Name must be at least 2 characters',
    )
    expect(useProductInventory.getState().products).toHaveLength(0)
  })

  it('updateProduct() → patches fields and bumps updatedAt', () => {
    const id = useProductInventory.getState().addProduct(BASE_FORM)
    const before = useProductInventory.getState().getProduct(id)!.updatedAt
    useProductInventory.getState().updateProduct(id, { salePrice: 49.9, weightGrams: 90 })
    const p = useProductInventory.getState().getProduct(id)!
    expect(p.salePrice).toBe(49.9)
    expect(p.weightGrams).toBe(90)
    expect(p.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('removeProduct() → product disappears', () => {
    const id = useProductInventory.getState().addProduct(BASE_FORM)
    useProductInventory.getState().removeProduct(id)
    expect(useProductInventory.getState().products).toHaveLength(0)
    expect(useProductInventory.getState().getProduct(id)).toBeUndefined()
  })

  it('markSold() toggles sold flag without touching prices', () => {
    const id = useProductInventory.getState().addProduct(BASE_FORM)
    useProductInventory.getState().markSold(id, true)
    const sold = useProductInventory.getState().getProduct(id)!
    expect(sold.sold).toBe(true)
    expect(sold.salePrice).toBe(39.9)
    useProductInventory.getState().markSold(id, false)
    expect(useProductInventory.getState().getProduct(id)!.sold).toBe(false)
  })

  it('persists to localStorage under open3dcalc_products', () => {
    useProductInventory.getState().addProduct(BASE_FORM)
    const raw = localStorage.getItem('open3dcalc_products')
    expect(raw).not.toBeNull()
    expect(raw!).toContain('Suporte Headset')
  })

  it('isBelowCost() → true only when salePrice < costPrice (warn, never block)', () => {
    const id = useProductInventory.getState().addProduct({ ...BASE_FORM, salePrice: 5 })
    const p = useProductInventory.getState().getProduct(id)!
    expect(isBelowCost(p)).toBe(true)
    // Product was still saved — warn does not block.
    expect(useProductInventory.getState().products).toHaveLength(1)
    expect(isBelowCost({ ...p, salePrice: 12.5 })).toBe(false)
    expect(isBelowCost({ ...p, salePrice: 99 })).toBe(false)
  })

  it('exportProductsCSV() → header + one row per product', () => {
    useProductInventory.getState().addProduct(BASE_FORM)
    useProductInventory.getState().addProduct({ ...BASE_FORM, name: 'Vaso "Espiral", grande' })
    const csv = exportProductsCSV()
    const lines = csv.split('\n')
    expect(lines[0]).toBe('id,name,weightGrams,filamentType,costPrice,salePrice,sold,createdAt,updatedAt')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('Suporte Headset')
    // CSV-escapes quotes and commas.
    expect(lines[2]).toContain('"Vaso ""Espiral"", grande"')
  })

  it('searchProducts() filters by name or filament (case-insensitive)', () => {
    useProductInventory.getState().addProduct(BASE_FORM)
    useProductInventory.getState().addProduct({ ...BASE_FORM, name: 'Vaso Espiral', filamentType: 'PETG' })
    expect(useProductInventory.getState().searchProducts('headset')).toHaveLength(1)
    expect(useProductInventory.getState().searchProducts('petg')).toHaveLength(1)
    expect(useProductInventory.getState().searchProducts('')).toHaveLength(2)
  })
})
