import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from '../historyStore'
import type { HistoryEntry } from '@/shared/types'

/** Helper to build a minimal HistoryEntry-like payload for addEntry */
function entryData(overrides: Partial<HistoryEntry> = {}) {
  return {
    type: 'fdm' as const,
    name: 'Test Entry',
    summary: 'A test calculation',
    totalCost: 25.50,
    sellPrice: 50.00,
    profit: 24.50,
    result: {
      materialCost: 5, energyCost: 2, machineCost: 1, hardwareCost: 1,
      consumablesCost: 0, laborCost: 0, softwareCost: 0, failureCost: 0,
      extrasCost: 0, postProcessingCost: 0,
      subtotal: 9, totalCost: 25.50, sellPrice: 50.00, profit: 24.50,
      marketplaceFee: 0, taxAmount: 0, costPerGram: 0, costPerUnit: 0,
      unitWeight: 50, estimatedPrintTime: 5, targetMarginPercent: 50,
      breakEvenPrice: 0, actualMargin: 49,
    },
    snapshot: null,
    ...overrides,
  }
}

describe('useHistoryStore (integration)', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset the store to clean defaults
    useHistoryStore.setState({
      entries: [],
      search: '',
      sortBy: 'date',
      sortOrder: 'desc',
      filterType: 'all',
      dateFrom: null,
      dateTo: null,
    })
  })

  // ── addEntry ──────────────────────────────────────────────────
  it('addEntry() → entry appears in the list', () => {
    const id = useHistoryStore.getState().addEntry(entryData({ name: 'My Print' }))
    const { entries } = useHistoryStore.getState()

    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe(id)
    expect(entries[0].name).toBe('My Print')
    expect(entries[0].totalCost).toBe(25.50)
  })

  // ── removeEntry ───────────────────────────────────────────────
  it('removeEntry() → entry is removed from list', () => {
    const id1 = useHistoryStore.getState().addEntry(entryData({ name: 'One' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'Two' }))
    expect(useHistoryStore.getState().entries).toHaveLength(2)

    useHistoryStore.getState().removeEntry(id1)
    const { entries } = useHistoryStore.getState()

    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Two')
  })

  // ── getFilteredEntries - filter by FDM type ──────────────────
  it('getFilteredEntries() filters by type "fdm"', () => {
    useHistoryStore.getState().addEntry(entryData({ type: 'fdm', name: 'FDM-1' }))
    useHistoryStore.getState().addEntry(entryData({ type: 'fdm', name: 'FDM-2' }))
    useHistoryStore.getState().addEntry(entryData({ type: 'resin', name: 'Resin-1' }))

    useHistoryStore.getState().setFilterType('fdm')
    const filtered = useHistoryStore.getState().getFilteredEntries()

    expect(filtered).toHaveLength(2)
    filtered.forEach((e) => expect(e.type).toBe('fdm'))
  })

  // ── getFilteredEntries - date sorting ───────────────────
  it('getFilteredEntries() sorts by date asc/desc', () => {
    const now = Date.now()
    // addEntry generates its own timestamp, but the timestamp field can be overridden
    useHistoryStore.getState().addEntry(entryData({ timestamp: now - 5000, name: 'Old' }))
    useHistoryStore.getState().addEntry(entryData({ timestamp: now, name: 'New' }))

    // Default sort = desc (newest first)
    useHistoryStore.getState().setSortBy('date')
    useHistoryStore.getState().setSortOrder('desc')
    let filtered = useHistoryStore.getState().getFilteredEntries()
    expect(filtered[0].name).toBe('New')
    expect(filtered[1].name).toBe('Old')

    // Switch to asc
    useHistoryStore.getState().setSortOrder('asc')
    filtered = useHistoryStore.getState().getFilteredEntries()
    expect(filtered[0].name).toBe('Old')
    expect(filtered[1].name).toBe('New')
  })

  // ── getFilteredEntries - price sorting ──────────────────
  it('getFilteredEntries() sorts by sellPrice', () => {
    useHistoryStore.getState().addEntry(entryData({ sellPrice: 100, name: 'Caríssimo' }))
    useHistoryStore.getState().addEntry(entryData({ sellPrice: 30, name: 'Barato' }))
    useHistoryStore.getState().addEntry(entryData({ sellPrice: 50, name: 'Médio' }))

    useHistoryStore.getState().setSortBy('price')
    useHistoryStore.getState().setSortOrder('asc')
    const asc = useHistoryStore.getState().getFilteredEntries()
    expect(asc[0].name).toBe('Barato')
    expect(asc[1].name).toBe('Médio')
    expect(asc[2].name).toBe('Caríssimo')

    useHistoryStore.getState().setSortOrder('desc')
    const desc = useHistoryStore.getState().getFilteredEntries()
    expect(desc[0].name).toBe('Caríssimo')
    expect(desc[2].name).toBe('Barato')
  })

  // ── exportJson ────────────────────────────────────────────────
  it('exportJson() → returns valid JSON string with correct structure', () => {
    useHistoryStore.getState().addEntry(entryData({ name: 'Export Test' }))

    const json = useHistoryStore.getState().exportJson()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe('2.0')
    expect(parsed.exportedAt).toBeDefined()
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].name).toBe('Export Test')
  })

  // ── importJson - intelligent merge ────────────────────────────
  it('importJson() merges without duplicating existing ids', () => {
    // Add an existing entry
    const existingId = useHistoryStore.getState().addEntry(entryData({ name: 'Original' }))

    // Prepare import JSON with the same entry (same id) + a new one
    const importPayload = {
      entries: [
        { ...entryData({ name: 'Original' }), id: existingId },
        { ...entryData({ name: 'New Import' }), id: undefined },
      ],
    }
    // Attach IDs to payload entries
    importPayload.entries[0].id = existingId

    const result = useHistoryStore.getState().importJson(JSON.stringify(importPayload))

    expect(result.skipped).toBe(1) // the duplicate
    expect(result.imported).toBe(1) // the new one
    expect(useHistoryStore.getState().entries).toHaveLength(2)
  })

  // ── importJson - invalid JSON ────────────────────────────────
  it('importJson() with invalid JSON returns 0 imported', () => {
    const result = useHistoryStore.getState().importJson('not valid json')
    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(0)
  })

  // ── clearHistory ──────────────────────────────────────────────
  it('clearHistory() → clears all entries', () => {
    useHistoryStore.getState().addEntry(entryData({ name: 'A' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'B' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'C' }))
    expect(useHistoryStore.getState().entries).toHaveLength(3)

    useHistoryStore.getState().clearHistory()
    expect(useHistoryStore.getState().entries).toHaveLength(0)
  })

  // ── getFilteredEntries - search filter ──────────────────
  it('getFilteredEntries() filters by search text', () => {
    useHistoryStore.getState().addEntry(entryData({ name: 'Benchy Boat', summary: '3D benchy' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'Vase', summary: 'decorative vase' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'Benchy v2', summary: 'improved benchy' }))

    useHistoryStore.getState().setSearch('benchy')
    const filtered = useHistoryStore.getState().getFilteredEntries()
    expect(filtered).toHaveLength(2)
  })

  // ══════════════════════════════════════════════════════════
  // NEW TESTS
  // ══════════════════════════════════════════════════════════

  // ── getEntry by ID ─────────────────────────────────────
  it('getEntry returns entry by ID', () => {
    const id = useHistoryStore.getState().addEntry(entryData({ name: 'Find Me' }))
    const entry = useHistoryStore.getState().getEntry(id)

    expect(entry).toBeDefined()
    expect(entry!.id).toBe(id)
    expect(entry!.name).toBe('Find Me')
  })

  // ── getEntry non-existent ID ──────────────────────────────
  it('getEntry returns undefined for non-existent ID', () => {
    useHistoryStore.getState().addEntry(entryData({ name: 'Some Entry' }))
    const entry = useHistoryStore.getState().getEntry('non_existent_id')

    expect(entry).toBeUndefined()
  })

  // ── setSearch ────────────────────────────────────────────
  it('setSearch updates the search field', () => {
    expect(useHistoryStore.getState().search).toBe('')

    useHistoryStore.getState().setSearch('benchy')
    expect(useHistoryStore.getState().search).toBe('benchy')

    useHistoryStore.getState().setSearch('')
    expect(useHistoryStore.getState().search).toBe('')
  })

  // ── setSortBy / setSortOrder ─────────────────────────────
  it('setSortBy and setSortOrder update sort', () => {
    expect(useHistoryStore.getState().sortBy).toBe('date')
    expect(useHistoryStore.getState().sortOrder).toBe('desc')

    useHistoryStore.getState().setSortBy('name')
    expect(useHistoryStore.getState().sortBy).toBe('name')

    useHistoryStore.getState().setSortOrder('asc')
    expect(useHistoryStore.getState().sortOrder).toBe('asc')

    useHistoryStore.getState().setSortBy('profit')
    expect(useHistoryStore.getState().sortBy).toBe('profit')
  })

  // ── setFilterType ────────────────────────────────────────
  it('setFilterType updates the filter', () => {
    expect(useHistoryStore.getState().filterType).toBe('all')

    useHistoryStore.getState().setFilterType('fdm')
    expect(useHistoryStore.getState().filterType).toBe('fdm')

    useHistoryStore.getState().setFilterType('resin')
    expect(useHistoryStore.getState().filterType).toBe('resin')

    useHistoryStore.getState().setFilterType('all')
    expect(useHistoryStore.getState().filterType).toBe('all')
  })

  // ── getFilteredEntries - sorting by profit ────────────
  it('getFilteredEntries sorts by profit asc/desc', () => {
    useHistoryStore.getState().addEntry(entryData({ profit: 50, name: 'Medium Profit' }))
    useHistoryStore.getState().addEntry(entryData({ profit: 10, name: 'Low Profit' }))
    useHistoryStore.getState().addEntry(entryData({ profit: 100, name: 'High Profit' }))

    useHistoryStore.getState().setSortBy('profit')
    useHistoryStore.getState().setSortOrder('asc')
    const asc = useHistoryStore.getState().getFilteredEntries()
    expect(asc[0].name).toBe('Low Profit')
    expect(asc[1].name).toBe('Medium Profit')
    expect(asc[2].name).toBe('High Profit')

    useHistoryStore.getState().setSortOrder('desc')
    const desc = useHistoryStore.getState().getFilteredEntries()
    expect(desc[0].name).toBe('High Profit')
    expect(desc[2].name).toBe('Low Profit')
  })

  // ── getFilteredEntries - sorting by name ──────────────
  it('getFilteredEntries sorts by name asc/desc', () => {
    useHistoryStore.getState().addEntry(entryData({ name: 'Zebra' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'Apple' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'Banana' }))

    useHistoryStore.getState().setSortBy('name')
    useHistoryStore.getState().setSortOrder('asc')
    const asc = useHistoryStore.getState().getFilteredEntries()
    expect(asc[0].name).toBe('Apple')
    expect(asc[1].name).toBe('Banana')
    expect(asc[2].name).toBe('Zebra')

    useHistoryStore.getState().setSortOrder('desc')
    const desc = useHistoryStore.getState().getFilteredEntries()
    expect(desc[0].name).toBe('Zebra')
    expect(desc[2].name).toBe('Apple')
  })

  // ── getFilteredEntries - search no results ───────────
  it('getFilteredEntries with search with no results returns empty', () => {
    useHistoryStore.getState().addEntry(entryData({ name: 'Benchy', summary: 'A boat' }))
    useHistoryStore.getState().addEntry(entryData({ name: 'Vase', summary: 'A vase' }))

    useHistoryStore.getState().setSearch('xyz_nonexistent')
    const filtered = useHistoryStore.getState().getFilteredEntries()

    expect(filtered).toHaveLength(0)
  })

  // ── getFilteredEntries with empty entries ────────────────
  it('getFilteredEntries with empty entries returns empty array', () => {
    // store is empty from beforeEach
    useHistoryStore.getState().setSearch('')
    useHistoryStore.getState().setFilterType('all')
    const filtered = useHistoryStore.getState().getFilteredEntries()

    expect(filtered).toEqual([])
  })

  // ── getFilteredEntries with filterType all ────────────────
  it('getFilteredEntries with filterType all returns all', () => {
    useHistoryStore.getState().addEntry(entryData({ type: 'fdm', name: 'FDM Item' }))
    useHistoryStore.getState().addEntry(entryData({ type: 'resin', name: 'Resin Item' }))

    useHistoryStore.getState().setFilterType('all')
    const filtered = useHistoryStore.getState().getFilteredEntries()

    expect(filtered).toHaveLength(2)
  })

  // ── addEntry with provided ID ────────────────────────────
  it('addEntry with provided ID uses that ID', () => {
    const customId = 'my_custom_id_123'
    const id = useHistoryStore.getState().addEntry(entryData({ id: customId, name: 'Custom ID' }))

    expect(id).toBe(customId)
    expect(useHistoryStore.getState().entries[0].id).toBe(customId)
  })

  // ── addEntry with provided timestamp ─────────────────────
  it('addEntry with provided timestamp uses that timestamp', () => {
    const customTimestamp = 1_600_000_000_000
    useHistoryStore.getState().addEntry(entryData({ timestamp: customTimestamp, name: 'Timeless' }))

    expect(useHistoryStore.getState().entries[0].timestamp).toBe(customTimestamp)
  })

  // ══════════════════════════════════════════════════════════
  //  Date range filter (Phase 1)
  // ══════════════════════════════════════════════════════════

  describe('Date range filter', () => {
    it('setDateFrom updates the state', () => {
      useHistoryStore.getState().setDateFrom(1_600_000_000_000)
      expect(useHistoryStore.getState().dateFrom).toBe(1_600_000_000_000)

      useHistoryStore.getState().setDateFrom(null)
      expect(useHistoryStore.getState().dateFrom).toBeNull()
    })

    it('setDateTo updates the state', () => {
      useHistoryStore.getState().setDateTo(1_700_000_000_000)
      expect(useHistoryStore.getState().dateTo).toBe(1_700_000_000_000)

      useHistoryStore.getState().setDateTo(null)
      expect(useHistoryStore.getState().dateTo).toBeNull()
    })

    it('getFilteredEntries with date range filters correctly', () => {
      const early = 1_600_000_000_000
      const middle = 1_650_000_000_000
      const late = 1_700_000_000_000

      useHistoryStore.getState().addEntry(entryData({ timestamp: early, name: 'Early' }))
      useHistoryStore.getState().addEntry(entryData({ timestamp: middle, name: 'Middle' }))
      useHistoryStore.getState().addEntry(entryData({ timestamp: late, name: 'Late' }))

      useHistoryStore.getState().setDateFrom(middle)
      useHistoryStore.getState().setDateTo(late)
      const filtered = useHistoryStore.getState().getFilteredEntries()

      expect(filtered).toHaveLength(2)
      expect(filtered.map(e => e.name).sort()).toEqual(['Late', 'Middle'])
    })

    it('getFilteredEntries with empty date range returns all', () => {
      useHistoryStore.getState().addEntry(entryData({ timestamp: 1_600_000_000_000, name: 'A' }))
      useHistoryStore.getState().addEntry(entryData({ timestamp: 1_700_000_000_000, name: 'B' }))

      // dateFrom and dateTo are null (default)
      const filtered = useHistoryStore.getState().getFilteredEntries()

      expect(filtered).toHaveLength(2)
    })
  })
})
