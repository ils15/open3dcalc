import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { Dashboard } from '../Dashboard'
import type { CalculationResult } from '@/shared/types'
import type { HistoryEntry } from '@/shared/types'

// ---------------------------------------------------------------------------
// Sample entries — match HistoryEntry shape
// ---------------------------------------------------------------------------
const sampleEntries = [
  {
    id: '1',
    name: 'Produto A',
    type: 'fdm' as const,
    timestamp: 1_600_000_000_000, // 2020-09-13
    sellPrice: 100,
    profit: 30,
    totalCost: 70,
    summary: 'Resumo A',
    snapshot: null,
    result: {} as CalculationResult,
  },
  {
    id: '2',
    name: 'Produto B',
    type: 'resin' as const,
    timestamp: 1_700_000_000_000, // 2020-11-14
    sellPrice: 200,
    profit: 50,
    totalCost: 150,
    summary: 'Resumo B',
    snapshot: null,
    result: {} as CalculationResult,
  },
  {
    id: '3',
    name: 'Produto C',
    type: 'fdm' as const,
    timestamp: 1_750_000_000_000, // approx 2020-06-16 — actually 2025-06-07
    sellPrice: 150,
    profit: 40,
    totalCost: 110,
    summary: 'Resumo C',
    snapshot: null,
    result: {} as CalculationResult,
  },
]

// Mock results to avoid the "no results" empty state
const mockResults = {
  totalCost: 100,
  sellPrice: 150,
  profit: 50,
  materialCost: 30,
  energyCost: 10,
  machineCost: 15,
  consumablesCost: 5,
  laborCost: 20,
  postProcessingCost: 10,
  taxAmount: 10,
  marketplaceFee: 5,
  subtotal: 80,
  failureCost: 0,
  fixedCosts: { enabled: false, monthlyCost: 0 },
}

let mockEntries: typeof sampleEntries

vi.mock('@/shared/stores/historyStore', () => ({
  useHistoryStore: vi.fn(<T,>(selector?: (state: { entries: HistoryEntry[] }) => T) => {
    const state = { entries: mockEntries }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/shared/stores/calculatorStore', () => ({
  useCalculatorStore: vi.fn(() => ({
    results: mockResults,
    fixedCosts: { enabled: false, monthlyCost: 0 },
  })),
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

// Mock RechartsLazy — render a simple div for ResponsiveContainer
vi.mock('../RechartsLazy', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Dashboard date filter', () => {
  beforeEach(() => {
    mockEntries = [...sampleEntries]
    vi.clearAllMocks()
  })

  it('renders date from and date to inputs', () => {
    render(<Dashboard />)
    expect(screen.getByText('dashboard.dateFrom')).toBeInTheDocument()
    expect(screen.getByText('dashboard.dateTo')).toBeInTheDocument()
    // Inputs should be type="date"
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBe(2)
  })

  it('clear filters button is hidden when no dates are set', () => {
    render(<Dashboard />)
    expect(screen.queryByText('dashboard.clearFilters')).not.toBeInTheDocument()
  })

  it('clear filters button appears when a date is set and resets on click', () => {
    render(<Dashboard />)
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    expect(dateInputs.length).toBe(2)

    // Set a date "from" value
    fireEvent.change(dateInputs[0], { target: { value: '2020-09-01' } })

    // Clear button should now appear
    const clearButton = screen.getByText('dashboard.clearFilters')
    expect(clearButton).toBeInTheDocument()

    // Click clear — button should disappear
    fireEvent.click(clearButton)
    expect(screen.queryByText('dashboard.clearFilters')).not.toBeInTheDocument()
  })

  it('date filter affects trend data (filters entries outside range)', () => {
    render(<Dashboard />)
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')

    // Set dateFrom after all entries (far future)
    fireEvent.change(dateInputs[0], { target: { value: '2099-01-01' } })

    // With no entries in range, trend section should show "no history"
    // The chart only renders when trendData.length > 1
    // With filtered data empty, we should see "noHistory" text
    // Note: "dashboard.noHistory" appears in both avgMargin card and trend chart
    const noHistoryElements = screen.getAllByText('dashboard.noHistory')
    expect(noHistoryElements.length).toBeGreaterThanOrEqual(1)
    expect(noHistoryElements[0]).toBeInTheDocument()
  })

  it('date filter affects avgMargin calculation', () => {
    render(<Dashboard />)
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')

    // Initially avgMargin uses all 3 entries:
    // margins: 30/100=30%, 50/200=25%, 40/150≈26.67%
    // avg = (30 + 25 + 26.67) / 3 ≈ 27.2%
    expect(screen.getByText(/\+27\.2/)).toBeInTheDocument()

    // Filter to only the first entry (timestamp 1_600_000_000_000 ≈ 2020-09-13)
    // Set dateFrom and dateTo to that same day
    fireEvent.change(dateInputs[0], { target: { value: '2020-09-13' } })
    fireEvent.change(dateInputs[1], { target: { value: '2020-09-13' } })

    // Now avgMargin should be only for entry 1: 30/100 = 30%
    expect(screen.getByText(/\+30\.0/)).toBeInTheDocument()
  })

  it('renders filtered entry count in avg margin card', () => {
    render(<Dashboard />)
    // Unfiltered: 3 entries
    expect(screen.getByText(/3 common\.entries/)).toBeInTheDocument()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    // Filter to only one entry
    fireEvent.change(dateInputs[0], { target: { value: '2020-09-13' } })
    fireEvent.change(dateInputs[1], { target: { value: '2020-09-13' } })

    // Now should show 1 entry
    expect(screen.getByText(/1 common\.entries/)).toBeInTheDocument()
  })

  it('clear filters resets date inputs and restores all entries', () => {
    render(<Dashboard />)
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')

    // Apply a filter
    fireEvent.change(dateInputs[0], { target: { value: '2020-09-13' } })
    fireEvent.change(dateInputs[1], { target: { value: '2020-09-13' } })

    // Avg should show 30% for single entry
    expect(screen.getByText(/\+30\.0/)).toBeInTheDocument()

    // Clear filters
    const clearButton = screen.getByText('dashboard.clearFilters')
    fireEvent.click(clearButton)

    // After clearing, avgMargin should be back to ~27.2% (all 3 entries)
    expect(screen.getByText(/\+27\.2/)).toBeInTheDocument()
  })
})
