import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HistoryEntry } from '@/types'

interface HistoryStore {
  entries: HistoryEntry[]
  search: string
  sortBy: 'date' | 'price' | 'profit' | 'name'
  sortOrder: 'asc' | 'desc'
  filterType: 'all' | 'fdm' | 'resin'

  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => string
  removeEntry: (id: string) => void
  clearHistory: () => void
  getEntry: (id: string) => HistoryEntry | undefined

  setSearch: (search: string) => void
  setSortBy: (sortBy: HistoryStore['sortBy']) => void
  setSortOrder: (order: 'asc' | 'desc') => void
  setFilterType: (type: 'all' | 'fdm' | 'resin') => void

  getFilteredEntries: () => HistoryEntry[]
  exportJson: () => string
  importJson: (json: string) => { imported: number; skipped: number }
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      entries: [],
      search: '',
      sortBy: 'date',
      sortOrder: 'desc',
      filterType: 'all',

      addEntry: (entry) => {
        const id = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const newEntry: HistoryEntry = {
          ...entry,
          id,
          timestamp: Date.now(),
        }
        set((state) => ({ entries: [newEntry, ...state.entries] }))
        return id
      },

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      clearHistory: () => set({ entries: [] }),

      getEntry: (id) => get().entries.find((e) => e.id === id),

      setSearch: (search) => set({ search }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setFilterType: (filterType) => set({ filterType }),

      getFilteredEntries: () => {
        const { entries, search, filterType, sortBy, sortOrder } = get()
        let filtered = [...entries]

        if (filterType !== 'all') {
          filtered = filtered.filter((e) => e.type === filterType)
        }
        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            (e) =>
              e.name.toLowerCase().includes(q) ||
              e.summary.toLowerCase().includes(q),
          )
        }

        filtered.sort((a, b) => {
          let cmp = 0
          switch (sortBy) {
            case 'date':
              cmp = a.timestamp - b.timestamp
              break
            case 'price':
              cmp = a.sellPrice - b.sellPrice
              break
            case 'profit':
              cmp = a.profit - b.profit
              break
            case 'name':
              cmp = a.name.localeCompare(b.name)
              break
          }
          return sortOrder === 'desc' ? -cmp : cmp
        })

        return filtered
      },

      exportJson: () => {
        return JSON.stringify(
          {
            entries: get().entries,
            version: '2.0',
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        )
      },

      importJson: (json) => {
        try {
          const data = JSON.parse(json)
          const incoming = data.entries || []
          let imported = 0
          let skipped = 0

          set((state) => {
            const existingIds = new Set(state.entries.map((e) => e.id))
            const newEntries = incoming.filter((e: HistoryEntry) => {
              if (existingIds.has(e.id)) {
                skipped++
                return false
              }
              imported++
              return true
            })
            return { entries: [...state.entries, ...newEntries] }
          })

          return { imported, skipped }
        } catch {
          return { imported: 0, skipped: 0 }
        }
      },
    }),
    {
      name: 'open3dcalc_history_v2',
      version: 2,
    },
  ),
)
