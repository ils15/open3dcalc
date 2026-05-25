import { create } from 'zustand'

export type SpoolStatus = 'in_stock' | 'on_the_way' | 'empty'

export interface FilamentSpool {
  id: string
  brand: string
  material: string
  color: string
  colorHex: string
  weightGrams: number
  originalWeightGrams: number
  costPerKg: number
  diameterMm: number
  dateAdded: number
  notes: string
  status: SpoolStatus
  purchaseStore: string
}

interface FilamentInventoryState {
  spools: FilamentSpool[]
  addSpool: (spool: Omit<FilamentSpool, 'id' | 'dateAdded'>) => void
  removeSpool: (id: string) => void
  updateSpool: (id: string, updates: Partial<FilamentSpool>) => void
  deductWeight: (id: string, grams: number) => void
  getTotalWeight: () => number
  getSpoolsByMaterial: (material: string) => FilamentSpool[]
  getLowStockSpools: (thresholdGrams: number) => FilamentSpool[]
}

const migrateSpool = (s: Record<string, unknown>): FilamentSpool => ({
  id: s.id as string,
  brand: (s.brand as string) || '',
  material: (s.material as string) || 'PLA',
  color: (s.color as string) || '',
  colorHex: (s.colorHex as string) || '',
  weightGrams: (s.weightGrams as number) || 0,
  originalWeightGrams: (s.originalWeightGrams as number) || 1000,
  costPerKg: (s.costPerKg as number) || 0,
  diameterMm: (s.diameterMm as number) || 1.75,
  dateAdded: (s.dateAdded as number) || Date.now(),
  notes: (s.notes as string) || '',
  status: (s.status as SpoolStatus) || 'in_stock',
  purchaseStore: (s.purchaseStore as string) || '',
})

const loadSpools = (): FilamentSpool[] => {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('open3dcalc_filaments')
    const raw = saved ? JSON.parse(saved) : []
    return (raw as Record<string, unknown>[]).map(migrateSpool)
  } catch { return [] }
}

export const useFilamentInventory = create<FilamentInventoryState>((set, get) => ({
  spools: loadSpools(),

  addSpool: (spool) => {
    const newSpool: FilamentSpool = {
      ...spool,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      dateAdded: Date.now(),
    }
    const spools = [...get().spools, newSpool]
    localStorage.setItem('open3dcalc_filaments', JSON.stringify(spools))
    set({ spools })
  },

  removeSpool: (id) => {
    const spools = get().spools.filter(s => s.id !== id)
    localStorage.setItem('open3dcalc_filaments', JSON.stringify(spools))
    set({ spools })
  },

  updateSpool: (id, updates) => {
    const spools = get().spools.map(s => s.id === id ? { ...s, ...updates } : s)
    localStorage.setItem('open3dcalc_filaments', JSON.stringify(spools))
    set({ spools })
  },

  deductWeight: (id, grams) => {
    const spools = get().spools.map(s =>
      s.id === id ? { ...s, weightGrams: Math.max(0, s.weightGrams - grams) } : s
    )
    localStorage.setItem('open3dcalc_filaments', JSON.stringify(spools))
    set({ spools })
  },

  getTotalWeight: () => {
    return get().spools.reduce((sum, s) => sum + s.weightGrams, 0)
  },

  getSpoolsByMaterial: (material) => {
    return get().spools.filter(s => s.material.toLowerCase() === material.toLowerCase())
  },

  getLowStockSpools: (thresholdGrams) => {
    return get().spools.filter(s => s.weightGrams < thresholdGrams)
  },
}))
