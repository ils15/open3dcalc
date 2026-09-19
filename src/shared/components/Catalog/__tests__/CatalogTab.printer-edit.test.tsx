import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CatalogTab } from '../CatalogTab'

const mockers = vi.hoisted(() => {
  const mockUpdatePrinter = vi.fn()
  const mockRemovePrinter = vi.fn()
  const printers = [
    {
      id: 'ender3',
      name: 'Ender 3',
      brand: 'Creality',
      power: 235,
      value: 1800,
      usefulLife: 3000,
      maintenancePerHour: 0.25,
      custom: false,
    },
    {
      id: 'custom-1',
      name: 'Minha Custom',
      brand: 'DIY',
      power: 400,
      value: 5000,
      usefulLife: 5000,
      maintenancePerHour: 0.50,
      custom: true,
    },
  ]
  return { mockUpdatePrinter, mockRemovePrinter, printers }
})

vi.mock('@/shared/stores/catalogStore', () => {
  const state = {
    printers: mockers.printers,
    materials: [],
    marketplaces: [],
    load: vi.fn(),
    addPrinter: vi.fn(),
    updatePrinter: mockers.mockUpdatePrinter,
    removePrinter: mockers.mockRemovePrinter,
    addPrinterTag: vi.fn(),
    removePrinterTag: vi.fn(),
    selectedPrinterTag: null,
    setPrinterTagFilter: vi.fn(),
    addMaterial: vi.fn(),
    addMarketplace: vi.fn(),
    removeMaterial: vi.fn(),
    removeMarketplace: vi.fn(),
  }
  return {
    useCatalogStore: Object.assign(
      vi.fn((selector?: (s: typeof state) => unknown) => {
        return selector ? selector(state) : state
      }),
      { subscribe: vi.fn() }
    ),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('CatalogTab — Printer Editing', () => {
  it('renders printer cards', () => {
    render(<CatalogTab />)
    expect(screen.getByText('Ender 3')).toBeDefined()
    expect(screen.getByText('Minha Custom')).toBeDefined()
  })

  it('shows default badge for non-custom printers', () => {
    render(<CatalogTab />)
    // Mock t() returns the key itself, so we look for 'catalog.defaultPrinter'
    const badges = screen.getAllByText('catalog.defaultPrinter')
    expect(badges.length).toBe(1)
  })

  it('shows Custom badge for custom printers', () => {
    render(<CatalogTab />)
    const badges = screen.getAllByText('Custom')
    expect(badges.length).toBe(1)
  })
})
