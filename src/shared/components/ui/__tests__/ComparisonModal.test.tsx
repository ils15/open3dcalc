import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ComparisonModal } from '../ComparisonModal'
import type { HistoryEntry } from '@/shared/types'

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Mock useCurrency
vi.mock('@/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'BRL',
    symbol: 'R$',
    format: (val: number) => `R$ ${val.toFixed(2)}`,
  }),
}))

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: '1',
    timestamp: Date.now(),
    type: 'fdm',
    name: 'Test Product A',
    summary: 'FDM test',
    totalCost: 10,
    sellPrice: 50,
    profit: 40,
    result: {
      materialCost: 2,
      energyCost: 1,
      machineCost: 1.5,
      hardwareCost: 0.5,
      consumablesCost: 0.3,
      laborCost: 2,
      softwareCost: 0.1,
      failureCost: 0.2,
      extrasCost: 0.4,
      postProcessingCost: 1,
      subtotal: 8,
      totalCost: 10,
      sellPrice: 50,
      profit: 40,
      marketplaceFee: 3,
      taxAmount: 2,
      costPerGram: 0.5,
      costPerUnit: 10,
      unitWeight: 20,
      estimatedPrintTime: 120,
      targetMarginPercent: 300,
      breakEvenPrice: 10,
      actualMargin: 400,
      carbonFootprintGrams: 0,
    },
    snapshot: null,
    ...overrides,
  }
}

describe('ComparisonModal', () => {
  const entryA = makeEntry({ name: 'Product Alpha' })
  const entryB = makeEntry({
    name: 'Product Beta',
    result: {
      materialCost: 3,
      energyCost: 1.5,
      machineCost: 2,
      hardwareCost: 0.6,
      consumablesCost: 0.4,
      laborCost: 2.5,
      softwareCost: 0.15,
      failureCost: 0.3,
      extrasCost: 0.5,
      postProcessingCost: 1.2,
      subtotal: 10,
      totalCost: 12,
      sellPrice: 60,
      profit: 48,
      marketplaceFee: 4,
      taxAmount: 2.5,
      costPerGram: 0.6,
      costPerUnit: 12,
      unitWeight: 20,
      estimatedPrintTime: 150,
      targetMarginPercent: 300,
      breakEvenPrice: 12,
      actualMargin: 400,
      carbonFootprintGrams: 0,
    },
  })

  it('renders the dialog with correct aria attributes', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'history.compareTitle')
  })

  it('renders both entry names', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Product Alpha')).toBeInTheDocument()
    expect(screen.getByText('Product Beta')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={onClose} />,
    )
    fireEvent.click(screen.getByLabelText('common.close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn()
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={onClose} />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  // --- Responsive grid tests ---

  it('entry names row uses responsive grid with 1col default and 3col at 400px', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    // The entry names row is the grid containing the entry names
    // It should use grid-cols-1 by default and grid-cols-[1fr_1fr_1fr] at min-[400px]
    const entryNamesRow = screen
      .getByText('Product Alpha')
      .closest('.grid')
    expect(entryNamesRow).toBeInTheDocument()
    expect(entryNamesRow?.className).toContain('grid-cols-1')
    expect(entryNamesRow?.className).toContain('min-[400px]:grid-cols-[1fr_1fr_1fr]')
  })

  it('comparison rows use responsive grid with 1col default and 3col at 400px', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    // Find a comparison row (e.g. the one containing 'calc.totalCost')
    const totalCostRow = screen
      .getByText('calc.totalCost')
      .closest('.grid')
    expect(totalCostRow).toBeInTheDocument()
    expect(totalCostRow?.className).toContain('grid-cols-1')
    expect(totalCostRow?.className).toContain('min-[400px]:grid-cols-[1fr_1fr_1fr]')
  })

  it('comparison rows have responsive gap and padding', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    const totalCostRow = screen
      .getByText('calc.totalCost')
      .closest('.grid')
    expect(totalCostRow?.className).toContain('gap-2')
    expect(totalCostRow?.className).toContain('min-[400px]:gap-3')
  })

  it('field labels have responsive font weight (font-medium default, font-normal at 400px)', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    const fieldLabel = screen
      .getByText('calc.totalCost')
      .closest('div')
    expect(fieldLabel?.className).toContain('font-medium')
    expect(fieldLabel?.className).toContain('min-[400px]:font-normal')
  })

  it('entry values show entry name on mobile (hidden above 400px)', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    // Entry name labels in the value cells should have min-[400px]:hidden
    const mobileLabels = screen.getAllByText(/^Product (Alpha|Beta):$/)
    for (const label of mobileLabels) {
      expect(label.className).toContain('min-[400px]:hidden')
    }
  })

  it('entry name labels in value cells have min-[400px]:hidden', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    // Find all entry name labels inside value cells (there are multiple per row)
    const alphaLabels = screen.getAllByText(/^Product Alpha:$/)
    expect(alphaLabels.length).toBeGreaterThan(0)
    for (const label of alphaLabels) {
      expect(label.className).toContain('min-[400px]:hidden')
    }
  })

  it('value cells have responsive justify (justify-between default, justify-center at 400px)', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    // Value cells are the ones containing the money format
    const valueCell = screen
      .getByText('calc.totalCost')
      .closest('.grid')
      ?.querySelectorAll('div')[1] // second child is first value cell
    expect(valueCell?.className).toContain('justify-between')
    expect(valueCell?.className).toContain('min-[400px]:justify-center')
  })

  it('entry names row hides field label on mobile and shows at 400px', () => {
    render(
      <ComparisonModal entryA={entryA} entryB={entryB} onClose={vi.fn()} />,
    )
    const fieldLabelHeader = screen.getByText('history.compareField')
    // The header "Field" label should be hidden on mobile, visible at 400px
    expect(fieldLabelHeader.className).toContain('hidden')
    expect(fieldLabelHeader.className).toContain('min-[400px]:block')
  })
})
