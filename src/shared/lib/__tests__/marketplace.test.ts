import { describe, it, expect } from 'vitest'
import { marketplaces, getMarketplace, calculateMarketplaceFee } from '@/shared/lib/marketplace'

describe('marketplaces', () => {
  it('exports an array of marketplace definitions', () => {
    expect(Array.isArray(marketplaces)).toBe(true)
    expect(marketplaces.length).toBeGreaterThan(0)
  })

  it('every marketplace has the required fields', () => {
    for (const m of marketplaces) {
      expect(m).toHaveProperty('id')
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('feePercent')
      expect(m).toHaveProperty('feeFixed')
      expect(m).toHaveProperty('hasFreeShipping')
      expect(typeof m.id).toBe('string')
      expect(typeof m.name).toBe('string')
      expect(typeof m.feePercent).toBe('number')
      expect(typeof m.feeFixed).toBe('number')
      expect(typeof m.hasFreeShipping).toBe('boolean')
    }
  })

  it('has unique ids', () => {
    const ids = marketplaces.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('matches snapshot', () => {
    expect(marketplaces).toMatchSnapshot()
  })

  it('every marketplace has a stylized logo thumbnail', () => {
    for (const m of marketplaces) {
      expect(m.logo, `marketplace ${m.id} must define a logo`).toBeTruthy()
      expect(typeof m.logo).toBe('string')
      // Logos are original artwork, never registered trademark images.
      expect(m.logo).toMatch(/\.svg$/)
    }
  })
})

describe('getMarketplace', () => {
  it('returns the matching marketplace by id', () => {
    const result = getMarketplace('amazon')
    expect(result.id).toBe('amazon')
    expect(result.name).toBe('Amazon')
  })

  it('returns the first marketplace (direct) for unknown ids', () => {
    const result = getMarketplace('nonexistent')
    expect(result.id).toBe('direct')
    expect(result.name).toBe('Venda Direta')
  })
})

describe('calculateMarketplaceFee', () => {
  it('calculates fee for a marketplace with percent and fixed', () => {
    const market = marketplaces.find(m => m.id === 'mercadolivre')!
    const result = calculateMarketplaceFee(100, market)
    expect(result.feePercent).toBe(16)
    // 100 * 0.16 = 16 + 6.50 = 22.50
    expect(result.fee).toBeCloseTo(22.5, 2)
  })

  it('returns zero fee for direct sales', () => {
    const market = marketplaces.find(m => m.id === 'direct')!
    const result = calculateMarketplaceFee(200, market)
    expect(result.fee).toBe(0)
    expect(result.feePercent).toBe(0)
  })

  it('handles zero price', () => {
    const market = marketplaces.find(m => m.id === 'shopee_ate79')!
    const result = calculateMarketplaceFee(0, market)
    // 0 * 0.20 + 4 = 4
    expect(result.fee).toBeCloseTo(4, 2)
  })
})
