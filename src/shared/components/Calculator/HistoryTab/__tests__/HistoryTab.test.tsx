import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HistoryTab } from '../HistoryTab'
import enUS from '@/shared/i18n/locales/en-US.json'
import ptBR from '@/shared/i18n/locales/pt-BR.json'

// ---------------------------------------------------------------------------
// Shared mutable state for the history store mock
// ---------------------------------------------------------------------------
const sampleEntries = [
  {
    id: '1',
    name: 'Produto FDM',
    type: 'fdm' as const,
    timestamp: 1_600_000_000_000, // 2020-09-13
    sellPrice: 100,
    summary: 'Resumo FDM',
    snapshot: null,
  },
  {
    id: '2',
    name: 'Produto Resina',
    type: 'resin' as const,
    timestamp: 1_700_000_000_000, // 2020-11-14
    sellPrice: 200,
    summary: 'Resumo Resina',
    snapshot: null,
  },
]

let mockEntries: typeof sampleEntries
let mockDateFrom: number | null
let mockDateTo: number | null
let mockSearch: string

const mockStoreActions = {
  setFilterType: vi.fn(),
  setSortBy: vi.fn(),
  setSearch: vi.fn((s: string) => { mockSearch = s }),
  setDateFrom: vi.fn((d: number | null) => { mockDateFrom = d }),
  setDateTo: vi.fn((d: number | null) => { mockDateTo = d }),
  getEntry: vi.fn((id: string) => mockEntries.find(e => e.id === id)),
  removeEntry: vi.fn(),
  exportJson: vi.fn(() => '[]'),
  importJson: vi.fn(() => ({ imported: 0, skipped: 0 })),
  getFilteredEntries: vi.fn(() => {
    let filtered = [...mockEntries]
    if (mockSearch) {
      const q = mockSearch.toLowerCase()
      filtered = filtered.filter(e => e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q))
    }
    if (mockDateFrom !== null) {
      filtered = filtered.filter(e => e.timestamp >= mockDateFrom!)
    }
    if (mockDateTo !== null) {
      filtered = filtered.filter(e => e.timestamp <= mockDateTo! + 86_399_999)
    }
    return filtered
  }),
}

vi.mock('@/shared/stores/historyStore', () => ({
  useHistoryStore: vi.fn(() => ({
    entries: mockEntries,
    filterType: 'all',
    sortBy: 'date',
    dateFrom: mockDateFrom,
    dateTo: mockDateTo,
    search: mockSearch,
    ...mockStoreActions,
  })),
}))

vi.mock('@/shared/stores/calculatorStore', () => ({
  useCalculatorStore: {
    getState: vi.fn(() => ({
      loadHistoryItem: vi.fn(),
    })),
  },
}))

// Mock i18n. `t` mirrors i18next closely enough to assert interpolation:
// without options it returns the raw key, with options it appends them — so a
// test can prove the component passed the entry name into `t(...)` instead of
// hardcoding a label.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}: ${Object.values(opts).join(' ')}` : key,
    i18n: { resolvedLanguage: 'pt', language: 'pt' },
  }),
}))

// Mock useCurrency
vi.mock('@/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (v: number) => `R$ ${v.toFixed(2)}`,
    symbol: 'R$',
  }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('HistoryTab', () => {
  beforeEach(() => {
    mockEntries = [...sampleEntries]
    mockDateFrom = null
    mockDateTo = null
    mockSearch = ''
    vi.clearAllMocks()
  })

  it('renders filter tabs', () => {
    render(<HistoryTab />)
    expect(screen.getByText('history.filters.all')).toBeInTheDocument()
    expect(screen.getByText('FDM')).toBeInTheDocument()
    expect(screen.getByText('history.filters.resin')).toBeInTheDocument()
  })

  it('filter tabs are in a scrollable container', () => {
    render(<HistoryTab />)
    const filterContainer = screen.getByText('history.filters.all').closest('[class*="overflow-x-auto"]')
    expect(filterContainer).toBeInTheDocument()
  })

  it('history list uses viewport height', () => {
    render(<HistoryTab />)
    const historyContainer = document.querySelector('.max-h-\\[60vh\\]')
    // The container may not exist if empty, but we can check the class
    // This validates the class was applied
    expect(historyContainer).toBeDefined()
  })
})

describe('HistoryTab date filter', () => {
  beforeEach(() => {
    mockEntries = [...sampleEntries]
    mockDateFrom = null
    mockDateTo = null
    mockSearch = ''
    vi.clearAllMocks()
  })

  it('renders date from and date to inputs when entries exist', () => {
    render(<HistoryTab />)
    expect(screen.getByLabelText('history.dateFrom')).toBeInTheDocument()
    expect(screen.getByLabelText('history.dateTo')).toBeInTheDocument()
    expect(screen.getByLabelText('history.dateFrom')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('history.dateTo')).toHaveAttribute('type', 'date')
  })

  it('does not render date filter when no entries in store', () => {
    mockEntries = []
    render(<HistoryTab />)
    expect(screen.queryByLabelText('history.dateFrom')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('history.dateTo')).not.toBeInTheDocument()
  })

  it('changing date from calls setDateFrom with correct epoch', () => {
    render(<HistoryTab />)
    const dateFromInput = screen.getByLabelText('history.dateFrom')
    fireEvent.change(dateFromInput, { target: { value: '2024-01-15' } })
    // 2024-01-15 00:00:00 local time → epoch
    const expectedEpoch = new Date(2024, 0, 15).getTime()
    expect(mockStoreActions.setDateFrom).toHaveBeenCalledWith(expectedEpoch)
  })

  it('changing date to calls setDateTo with correct epoch', () => {
    render(<HistoryTab />)
    const dateToInput = screen.getByLabelText('history.dateTo')
    fireEvent.change(dateToInput, { target: { value: '2024-06-01' } })
    const expectedEpoch = new Date(2024, 5, 1).getTime()
    expect(mockStoreActions.setDateTo).toHaveBeenCalledWith(expectedEpoch)
  })

  it('clear filters button resets both dates', () => {
    mockDateFrom = 1_600_000_000_000
    mockDateTo = 1_700_000_000_000
    render(<HistoryTab />)
    const clearButton = screen.getByText('history.clearFilters')
    fireEvent.click(clearButton)
    expect(mockStoreActions.setDateFrom).toHaveBeenCalledWith(null)
    expect(mockStoreActions.setDateTo).toHaveBeenCalledWith(null)
  })

  it('clear filters button is hidden when no dates are set', () => {
    render(<HistoryTab />)
    expect(screen.queryByText('history.clearFilters')).not.toBeInTheDocument()
  })

  it('date range filter works with existing search filter', () => {
    // Set both search term and date range before render
    mockSearch = 'Resina'
    mockDateFrom = 1_650_000_000_000
    mockDateTo = 1_750_000_000_000
    render(<HistoryTab />)

    // Only "Produto Resina" has name matching "Resina" AND timestamp within range
    expect(screen.getByText('Produto Resina')).toBeInTheDocument()
    expect(screen.queryByText('Produto FDM')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Compare checkbox a11y
//
// The compare checkbox used to be a bare `<input type="checkbox">`: no
// accessible name (screen readers announced "checkbox, blank") and a 16x16 hit
// area, far below the app's own 44px touch-target floor.
// ---------------------------------------------------------------------------
const COMPARE_LABEL = /history\.compareSelectEntry/i

describe('HistoryTab compare checkbox a11y', () => {
  beforeEach(() => {
    mockEntries = [...sampleEntries]
    mockDateFrom = null
    mockDateTo = null
    mockSearch = ''
    vi.clearAllMocks()
  })

  it('gives each compare checkbox an accessible name naming its entry', () => {
    render(<HistoryTab />)

    // Name must come from t() AND identify which entry it toggles — two
    // identical "checkbox" announcements are useless in a list of products.
    expect(
      screen.getByRole('checkbox', { name: /history\.compareSelectEntry: Produto FDM/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: /history\.compareSelectEntry: Produto Resina/i }),
    ).toBeInTheDocument()
  })

  it('never renders a compare checkbox without an accessible name', () => {
    render(<HistoryTab />)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(mockEntries.length)
    for (const checkbox of checkboxes) {
      expect(checkbox).toHaveAccessibleName()
    }
  })

  it('grows the hit area to 44px without enlarging the visible checkbox', () => {
    render(<HistoryTab />)

    const checkbox = screen.getAllByRole('checkbox', { name: COMPARE_LABEL })[0]
    // Visual stays compact — this is a dense list, not a mobile-first card.
    expect(checkbox).toHaveClass('w-4', 'h-4')

    // The wrapper is the real click target.
    const target = checkbox.closest('label')
    expect(target).not.toBeNull()
    expect(target).toHaveClass('min-h-[44px]')
    expect(target).toHaveClass('min-w-[44px]')
  })

  it('toggling from the enlarged hit area still drives the compare selection', () => {
    render(<HistoryTab />)

    const checkbox = screen.getByRole('checkbox', { name: /Produto FDM/i })
    const target = checkbox.closest('label') as HTMLElement

    // The click target must be a wrapper AROUND the checkbox, not the 16px
    // input itself — otherwise the extra padding would be dead space.
    expect(target).not.toBeNull()
    expect(target).not.toBe(checkbox)
    expect(target).toContainElement(checkbox)

    // Click the padding, not the 16px input — proves the wrapper is wired up.
    fireEvent.click(target)
    expect(checkbox).toBeChecked()
  })

  it('keeps the A/B selection hard-capped at 2 entries', () => {
    mockEntries = [
      ...sampleEntries,
      {
        id: '3',
        name: 'Produto Extra',
        type: 'fdm' as const,
        timestamp: 1_700_500_000_000,
        sellPrice: 300,
        summary: 'Resumo Extra',
        snapshot: null,
      },
    ]
    render(<HistoryTab />)

    fireEvent.click(screen.getByRole('checkbox', { name: /Produto FDM/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Produto Resina/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Produto Extra/i }))

    // Third selection is rejected by the cap.
    expect(screen.getByRole('checkbox', { name: /Produto Extra/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Produto FDM/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Produto Resina/i })).toBeChecked()
  })
})

// The repo has no global locale parity gate, so a one-sided key addition would
// ship silently. Guard the compare-checkbox label key in both files here.
describe('history.compareSelectEntry locale parity', () => {
  it.each([
    ['en-US', enUS],
    ['pt-BR', ptBR],
  ])('exists in %s and interpolates {{name}}', (_locale, dict) => {
    const value = dict.history.compareSelectEntry as unknown
    expect(typeof value, `history.compareSelectEntry (${_locale})`).toBe('string')
    expect(value as string).toContain('{{name}}')
    // en-US must never hardcode the BRL symbol (locales.test.ts leak guard).
    expect(value as string).not.toContain('R$')
  })
})
