import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProductInventory, isBelowCost, exportProductsCSV } from '@/shared/stores/productInventory'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Package, Plus, Pencil, Trash2, Search, Download } from 'lucide-react'
import type { Product } from '@/shared/types'

interface ProductFormState {
  name: string
  weightGrams: string
  filamentType: string
  costPrice: string
  salePrice: string
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  weightGrams: '',
  filamentType: '',
  costPrice: '',
  salePrice: '',
}

const toNumber = (s: string): number => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function ProductFormModal({
  product,
  onClose,
  onSave,
}: {
  product: Product | null
  onClose: () => void
  onSave: (data: { name: string; weightGrams: number; filamentType: string; costPrice: number; salePrice: number }) => void
}) {
  const { t } = useTranslation()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<ProductFormState>(() =>
    product
      ? {
          name: product.name,
          weightGrams: String(product.weightGrams),
          filamentType: product.filamentType,
          costPrice: String(product.costPrice),
          salePrice: String(product.salePrice),
        }
      : EMPTY_FORM,
  )

  // The parent remounts this modal (via `key`) on every open, so the
  // useState initializer above always starts from the current product.
  // This effect only syncs focus with the DOM (an external system).
  useEffect(() => {
    const timer = setTimeout(() => nameInputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const belowCost = toNumber(form.salePrice) < toNumber(form.costPrice)
  const canSave = form.name.trim().length >= 2

  const handleSubmit = () => {
    if (!canSave) return
    onSave({
      name: form.name.trim(),
      weightGrams: toNumber(form.weightGrams),
      filamentType: form.filamentType.trim(),
      costPrice: toNumber(form.costPrice),
      salePrice: toNumber(form.salePrice),
    })
  }

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product ? t('products.editProduct') : t('products.newProduct')}
    >
      <div
        className="surface rounded-xl p-6 w-[90%] max-w-md max-h-[85vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
          {product ? t('products.editProduct') : t('products.newProduct')}
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="product-name" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t('products.name')}
            </label>
            <input
              id="product-name"
              ref={nameInputRef}
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="product-weight" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t('products.weight')}
              </label>
              <input
                id="product-weight"
                type="number"
                min="0"
                step="any"
                value={form.weightGrams}
                onChange={(e) => setForm({ ...form, weightGrams: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="product-filament" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t('products.filament')}
              </label>
              <input
                id="product-filament"
                type="text"
                value={form.filamentType}
                onChange={(e) => setForm({ ...form, filamentType: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="product-cost" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t('products.cost')}
              </label>
              <input
                id="product-cost"
                type="number"
                min="0"
                step="any"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="product-price" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t('products.price')}
              </label>
              <input
                id="product-price"
                type="number"
                min="0"
                step="any"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          {belowCost && (
            <p role="alert" className="text-xs font-medium text-amber-400">
              ⚠ {t('products.belowCostWarn')}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProductInventory() {
  const { t } = useTranslation()
  const products = useProductInventory((s) => s.products)
  const addProduct = useProductInventory((s) => s.addProduct)
  const updateProduct = useProductInventory((s) => s.updateProduct)
  const removeProduct = useProductInventory((s) => s.removeProduct)
  const markSold = useProductInventory((s) => s.markSold)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (statusFilter === 'sold' && !p.sold) return false
      if (statusFilter === 'available' && p.sold) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.filamentType && p.filamentType.toLowerCase().includes(q))
      )
    })
  }, [products, search, statusFilter])

  const handleSave = (data: { name: string; weightGrams: number; filamentType: string; costPrice: number; salePrice: number }) => {
    if (editing) updateProduct(editing.id, data)
    else addProduct(data)
    setEditing(null)
    setFormOpen(false)
  }

  const handleExportCsv = () => {
    const blob = new Blob([exportProductsCSV()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="surface rounded-xl p-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('products.title')}</h2>
            <p className="text-xs text-[var(--color-text-muted)]">{t('products.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            <Download className="w-4 h-4" />
            {t('products.exportCsv')}
          </button>
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            <Plus className="w-4 h-4" />
            {t('products.newProduct')}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('products.searchPlaceholder')}
            aria-label={t('products.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          />
        </div>
        <select
          aria-label={t('products.status')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'available' | 'sold')}
          className="px-3 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <option value="all">{t('products.filterAll')}</option>
          <option value="available">{t('products.filterAvailable')}</option>
          <option value="sold">{t('products.filterSold')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
          {t('products.noProducts')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3">{t('products.name')}</th>
                <th className="py-2 pr-3">{t('products.weight')}</th>
                <th className="py-2 pr-3">{t('products.filament')}</th>
                <th className="py-2 pr-3">{t('products.cost')}</th>
                <th className="py-2 pr-3">{t('products.price')}</th>
                <th className="py-2 pr-3">{t('products.sold')}</th>
                <th className="py-2"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 pr-3 font-medium text-[var(--color-text-primary)]">
                    {p.name}
                    {isBelowCost(p) && (
                      <span title={t('products.belowCostWarn')} className="ml-2 text-amber-400" aria-label={t('products.belowCostWarn')}>
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{p.weightGrams} g</td>
                  <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{p.filamentType || '—'}</td>
                  <td className="py-2 pr-3 text-[var(--color-text-secondary)]">R$ {p.costPrice.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-[var(--color-text-secondary)]">R$ {p.salePrice.toFixed(2)}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`${t('products.sold')}: ${p.name}`}
                      checked={p.sold}
                      onChange={(e) => markSold(p.id, e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-accent)]"
                    />
                  </td>
                  <td className="py-2 flex gap-1">
                    <button
                      onClick={() => { setEditing(p); setFormOpen(true) }}
                      aria-label={`${t('common.edit')}: ${p.name}`}
                      className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      aria-label={`${t('common.delete')}: ${p.name}`}
                      className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-400 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <ProductFormModal
          key={editing?.id ?? 'new'}
          product={editing}
          onClose={() => { setEditing(null); setFormOpen(false) }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message={t('products.deleteConfirm')}
        confirmLabel={t('common.confirm')}
        onConfirm={() => { if (confirmDeleteId) removeProduct(confirmDeleteId); setConfirmDeleteId(null) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
