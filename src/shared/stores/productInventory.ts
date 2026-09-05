import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, ProductFormData } from '@/shared/types'

function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** True when the sale price is below cost. Warn-only — never blocks saving. */
export function isBelowCost(p: Pick<Product, 'costPrice' | 'salePrice'>): boolean {
  return p.salePrice < p.costPrice
}

function escapeCsvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportProductsCSV(): string {
  const header = 'id,name,weightGrams,filamentType,costPrice,salePrice,sold,createdAt,updatedAt'
  const rows = useProductInventory
    .getState()
    .products.map((p) =>
      [
        p.id,
        p.name,
        p.weightGrams,
        p.filamentType,
        p.costPrice,
        p.salePrice,
        p.sold ? 1 : 0,
        p.createdAt,
        p.updatedAt,
      ]
        .map(escapeCsvCell)
        .join(','),
    )
  return [header, ...rows].join('\n')
}

interface ProductInventoryState {
  products: Product[]

  addProduct: (data: ProductFormData) => string
  updateProduct: (id: string, data: Partial<ProductFormData>) => void
  removeProduct: (id: string) => void
  markSold: (id: string, sold: boolean) => void

  getProduct: (id: string) => Product | undefined
  searchProducts: (query: string) => Product[]
  getAllProducts: () => Product[]
}

export const useProductInventory = create<ProductInventoryState>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (data) => {
        const name = data.name.trim()
        if (name.length < 2) {
          throw new Error('Name must be at least 2 characters')
        }
        const now = Date.now()
        const id = generateId()
        const product: Product = {
          id,
          name,
          weightGrams: data.weightGrams || 0,
          filamentType: data.filamentType || '',
          costPrice: data.costPrice || 0,
          salePrice: data.salePrice || 0,
          sold: false,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ products: [...state.products, product] }))
        return id
      },

      updateProduct: (id, data) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...(data.name !== undefined ? { name: data.name } : {}),
                  ...(data.weightGrams !== undefined ? { weightGrams: data.weightGrams } : {}),
                  ...(data.filamentType !== undefined ? { filamentType: data.filamentType } : {}),
                  ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
                  ...(data.salePrice !== undefined ? { salePrice: data.salePrice } : {}),
                  updatedAt: Date.now(),
                }
              : p,
          ),
        }))
      },

      removeProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),

      markSold: (id, sold) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, sold, updatedAt: Date.now() } : p,
          ),
        })),

      getProduct: (id) => get().products.find((p) => p.id === id),

      searchProducts: (query) => {
        const { products } = get()
        if (!query) return [...products]
        const q = query.toLowerCase()
        return products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.filamentType && p.filamentType.toLowerCase().includes(q)),
        )
      },

      getAllProducts: () => [...get().products],
    }),
    {
      name: 'open3dcalc_products',
      version: 1,
    },
  ),
)
