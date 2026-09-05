import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// ─── Mock all heavy dependencies ───
vi.mock('@/shared/components/Header/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}))
vi.mock('@/shared/components/Catalog/CatalogTab', () => ({
  CatalogTab: () => <div>CatalogTab</div>,
}))
vi.mock('@/shared/components/Calculator/HistoryTab/HistoryTab', () => ({
  HistoryTab: () => <div>HistoryTab</div>,
}))
vi.mock('@/shared/components/Dashboard/Dashboard', () => ({
  Dashboard: () => <div>Dashboard</div>,
}))
vi.mock('@/shared/components/Changelog/ChangelogPage', () => ({
  ChangelogPage: () => <div>ChangelogPage</div>,
}))
vi.mock('@/shared/components/Calculator/InfillCalculator', () => ({
  InfillCalculator: () => <div>InfillCalculator</div>,
}))
vi.mock('@/shared/components/Catalog/FilamentInventory', () => ({
  FilamentInventory: () => <div>FilamentInventory</div>,
}))
vi.mock('@/shared/components/Calculator/Calculator', () => ({
  Calculator: () => <div data-testid="calculator-mock">Calculator</div>,
}))
vi.mock('@/shared/stores/storeBridge', () => ({
  restoreAutoSnapshot: vi.fn(),
}))
vi.mock('@/shared/stores/historyStore', () => ({
  useHistoryStore: Object.assign(
    vi.fn(() => ({
      entries: [],
      addEntry: vi.fn(),
    })),
    {
      getState: vi.fn(() => ({
        entries: [],
        addEntry: vi.fn(),
      })),
    }
  ),
}))
vi.mock('@/shared/stores/calculatorStore', () => ({
  useCalculatorStore: vi.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      activeTab: 'fdm',
      currency: 'auto',
      fdmMaterial: {},
      fdmPrintParams: {},
      fdmMachine: {},
      fdmHardware: {},
      fdmFinishing: {},
      fdmLabor: {},
      fdmExtras: {},
      fdmSales: {},
      fdmOps: {},
      fdmSoft: {},
      resinMaterial: {},
      resinPrintParams: {},
      resinPostProcess: {},
      resinMachine: {},
      resinHardware: {},
      resinLabor: {},
      resinExtras: {},
      resinSales: {},
      resinOps: {},
      resinSoft: {},
      selectedPrinter: {},
      selectedMarketplace: {},
      fdmAmsEnabled: false,
      fdmAmsSlots: [],
      productName: '',
      quantity: 1,
      infillPercent: 20,
      targetMarginMode: 'manual',
      enabledSections: {},
    }
    return selector ? selector(state) : state
  }),
}))

// ─── Import after mocks ───
import App from '../App'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pt-BR', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('Phase 2 — Tablet Optimization', () => {
  describe('2.1 Tablet sidebar in App.tsx', () => {
    it('renders a tablet sidebar (icons-only) visible at md breakpoint', () => {
      const { container } = render(<App />)

      // Find the tablet sidebar: <aside> with class containing "hidden md:flex lg:hidden"
      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('hidden') &&
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      expect(tabletSidebar).not.toBeNull()
    })

    it('tablet sidebar has w-16 width class', () => {
      const { container } = render(<App />)

      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      expect(tabletSidebar!.className).toContain('w-16')
    })

    it('tablet sidebar has px-2 padding class', () => {
      const { container } = render(<App />)

      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      expect(tabletSidebar!.className).toContain('px-2')
    })

    it('tablet sidebar renders a button for each tab', () => {
      const { container } = render(<App />)

      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      const buttons = tabletSidebar!.querySelectorAll('button')
      // TABS array has 9 items (incl. products; changelog moved to sidebar bottom)
      expect(buttons.length).toBe(9)
    })

    it('tablet sidebar buttons have title attribute for accessibility', () => {
      const { container } = render(<App />)

      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      const buttons = tabletSidebar!.querySelectorAll('button')
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('title')
      })
    })

    it('tablet sidebar is hidden on mobile (has hidden class)', () => {
      const { container } = render(<App />)

      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      // Should have 'hidden' as the base state
      expect(tabletSidebar!.className).toMatch(/\bhidden\b/)
    })

    it('tablet sidebar is hidden on large screens (has lg:hidden class)', () => {
      const { container } = render(<App />)

      const allAsides = container.querySelectorAll('aside')
      const tabletSidebar = Array.from(allAsides).find((aside) =>
        aside.className.includes('md:flex') &&
        aside.className.includes('lg:hidden')
      )

      expect(tabletSidebar).toBeDefined()
      expect(tabletSidebar!.className).toContain('lg:hidden')
    })
  })

  describe('2.2 Responsive typography in index.css', () => {
    it('body font-size uses clamp() for fluid scaling', async () => {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const cssPath = path.resolve(__dirname, '../index.css')
      const css = await fs.readFile(cssPath, 'utf-8')

      // Find the body rule and check for clamp
      expect(css).toMatch(/body\s*\{[^}]*font-size:\s*clamp\(/)
    })

    it('body font-size clamp starts at 0.9375rem (15px)', async () => {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const cssPath = path.resolve(__dirname, '../index.css')
      const css = await fs.readFile(cssPath, 'utf-8')

      expect(css).toContain('clamp(0.9375rem')
    })

    it('body font-size clamp ends at 1.0625rem (17px)', async () => {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const cssPath = path.resolve(__dirname, '../index.css')
      const css = await fs.readFile(cssPath, 'utf-8')

      expect(css).toContain('1.0625rem)')
    })
  })
})
