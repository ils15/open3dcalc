import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCustomerStore } from '@/shared/stores/customerStore'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Users, Plus, Pencil, Trash2, Search, FileJson, Upload, X } from 'lucide-react'
import type { Customer, CustomerFormData } from '@/shared/types'
import { downloadBlob } from '@/shared/lib/download'

const EMPTY_FORM: CustomerFormData = {
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
}

function validateEmail(email: string): boolean {
  if (!email) return true // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface CustomerFormModalProps {
  open: boolean
  customer: Customer | null
  onClose: () => void
  onSave: (data: CustomerFormData) => void
}

function CustomerFormModal({ open, customer, onClose, onSave }: CustomerFormModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<CustomerFormData>(() => {
    if (customer) {
      return {
        name: customer.name,
        company: customer.company || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        notes: customer.notes || '',
      }
    }
    return EMPTY_FORM
  })
  const [emailError, setEmailError] = useState(false)

  useEffect(() => {
    if (open) {
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [open])

  // Focus trap + ESC
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, input, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleSubmit = () => {
    if (!form.name.trim()) return
    if (!validateEmail(form.email)) {
      setEmailError(true)
      return
    }
    setEmailError(false)
    onSave(form)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={customer ? t('customers.editCustomer') : t('customers.newCustomer')}
    >
      <div
        ref={dialogRef}
        className="surface rounded-xl p-6 w-[90%] max-w-md max-h-[85vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold gradient-text">
            {customer ? t('customers.editCustomer') : t('customers.newCustomer')}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none transition-colors hover:bg-[var(--color-bg-elevated)]"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t('customers.name')} *</label>
            <input
              ref={nameInputRef}
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
              placeholder={t('customers.name')}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t('customers.company')}</label>
            <input
              type="text"
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
              placeholder={t('customers.company')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t('customers.email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setEmailError(false) }}
              className={`w-full bg-[var(--color-bg-elevated)] border hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all ${emailError ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}`}
              placeholder={t('customers.email')}
            />
            {emailError && <p className="text-xs text-[var(--color-danger)] mt-1">Email inválido</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t('customers.phone')}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
              placeholder={t('customers.phone')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t('customers.address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
              placeholder={t('customers.address')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t('customers.notes')}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all resize-none"
              placeholder={t('customers.notes')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-xl bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CustomerTab() {
  const { t } = useTranslation()
  const store = useCustomerStore()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<string | null>(null)

  const customers = store.searchCustomers(search)

  useEffect(() => {
    if (!importResult) return
    const timer = setTimeout(() => setImportResult(null), 3000)
    return () => clearTimeout(timer)
  }, [importResult])

  const handleExport = useCallback(() => {
    const data = store.exportCustomers()
    downloadBlob(new Blob([data], { type: 'application/json' }), 'open3dcalc_customers.json')
  }, [store])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result = store.importCustomers(ev.target?.result as string)
        if (result.imported === 0 && result.skipped === 0) {
          setImportResult(t('history.importError'))
        } else {
          setImportResult(t('history.importSuccess', { imported: result.imported, skipped: result.skipped }))
        }
      } catch {
        setImportResult(t('history.importError'))
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSave = (data: CustomerFormData) => {
    try {
      if (editingCustomer) {
        store.updateCustomer(editingCustomer.id, data)
      } else {
        store.addCustomer(data)
      }
      setFormOpen(false)
      setEditingCustomer(null)
    } catch {
      // validation error in store — silently ignore for now
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormOpen(true)
  }

  const handleDelete = () => {
    if (confirmDeleteId) {
      store.removeCustomer(confirmDeleteId)
    }
    setConfirmDeleteId(null)
  }

  return (
    <div className="surface rounded-xl p-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('customers.title')}</h2>
            <p className="text-xs text-[var(--color-text-muted)]">{t('customers.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setFormOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <Plus className="w-4 h-4" />
          {t('customers.newCustomer')}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('customers.searchPlaceholder')}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-12 pl-10 pr-4 placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
        />
      </div>

      {/* Customer list */}
      {customers.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">{t('customers.noCustomers')}</p>
      ) : (
        <div className="space-y-2 max-h-[50vh] sm:max-h-80 overflow-y-auto">
          {customers.map(customer => (
            <div
              key={customer.id}
              className="surface rounded-xl p-3 flex items-center gap-3 hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[var(--color-accent)] font-semibold text-sm">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{customer.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                  {customer.company && <span>{customer.company}</span>}
                  {customer.email && <span className="truncate">{customer.email}</span>}
                  {customer.phone && <span>{customer.phone}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(customer)}
                  className="p-1.5 text-xs rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                  aria-label={t('customers.editCustomer')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(customer.id)}
                  className="p-1.5 text-xs rounded-lg bg-red-600/20 text-[var(--color-danger)] hover:bg-red-600 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                  aria-label={t('customers.remove')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export / Import buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleExport}
          className="flex-1 py-2.5 rounded-xl text-sm surface text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-2"
        >
          <FileJson className="w-4 h-4" /> {t('customers.export')}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2.5 rounded-xl text-sm surface text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" /> {t('customers.import')}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />

      {importResult && (
        <div className="mt-2 text-xs text-center text-emerald-400 animate-fade-in">{importResult}</div>
      )}

      {/* Form modal */}
      <CustomerFormModal
        key={editingCustomer?.id ?? 'new'}
        open={formOpen}
        customer={editingCustomer}
        onClose={() => { setFormOpen(false); setEditingCustomer(null) }}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t('customers.remove')}
        message={t('customers.deleteConfirm')}
        variant="danger"
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
