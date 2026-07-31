import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuoteStore } from '@/shared/stores/quoteStore'
import { useCustomerStore } from '@/shared/stores/customerStore'
import { useHistoryStore } from '@/shared/stores/historyStore'
import { useCurrency } from '@/shared/hooks/useCurrency'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { QuoteDoc } from '@/shared/lib/QuoteDoc'
import type { Quote, QuoteItem, QuoteFormData, Customer } from '@/shared/types'
import {
  X, Search, Plus, FileText, Eye, Edit, Trash2, Download,
  AlertCircle,
} from 'lucide-react'
import { EmptyState } from '@/shared/components/ui/EmptyState'

// ── Status helpers ──────────────────────────────────────────────
const STATUS_CONFIG: Record<Quote['status'], { label: string; color: string; bg: string }> = {
  draft:    { label: 'Rascunho',  color: 'text-[var(--color-text-secondary)]',  bg: 'bg-gray-500/20' },
  sent:     { label: 'Enviado',   color: 'text-blue-400',  bg: 'bg-blue-500/20' },
  approved: { label: 'Aprovado',  color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  rejected: { label: 'Recusado',  color: 'text-red-400',   bg: 'bg-red-500/20' },
}

// ── Focus trap hook ─────────────────────────────────────────────
function useFocusTrap(
  dialogRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
  isOpen: boolean,
) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
  }, [isOpen, onClose, dialogRef])
}

// ── Modal wrapper ────────────────────────────────────────────────
function Modal({
  open, title, onClose, children, wide = false,
}: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(dialogRef, onClose, open)

  useEffect(() => {
    if (open) setTimeout(() => closeRef.current?.focus(), 50)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={dialogRef}
        className={`surface rounded-xl max-h-[90vh] overflow-y-auto animate-fade-in ${
          wide ? 'w-[95%] max-w-3xl' : 'w-[90%] max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg-primary)]/90 z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold gradient-text">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 pt-4">{children}</div>
      </div>
    </div>
  )
}

// ── QuoteFormModal ────────────────────────────────────────────────
function QuoteFormModal({
  editQuote,
  onClose,
  onSave,
  locale: localeProp,
}: {
  editQuote?: Quote
  onClose: () => void
  onSave: () => void
  locale?: string
}) {
  const { symbol } = useCurrency()
  const customers = useCustomerStore((s) => s.customers)
  const historyEntries = useHistoryStore((s) => s.entries)
  const quoteStore = useQuoteStore.getState()

  const isEditing = !!editQuote
  const [title, setTitle] = useState(editQuote?.title ?? '')
  const [customerId, setCustomerId] = useState(editQuote?.customerId ?? '')
  const [items, setItems] = useState<QuoteItem[]>(editQuote?.items ?? [])
  const [globalDiscount, setGlobalDiscount] = useState(editQuote?.globalDiscountPercent ?? 0)
  const [validUntil, setValidUntil] = useState(editQuote?.validUntil ?? '')
  const [paymentTerms, setPaymentTerms] = useState(editQuote?.paymentTerms ?? '')
  const [deliveryEstimate, setDeliveryEstimate] = useState(editQuote?.deliveryEstimate ?? '')
  const [footerNote, setFooterNote] = useState(editQuote?.footerNote ?? '')
  const [showHistoryPicker, setShowHistoryPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCustomer = customers.find((c) => c.id === customerId)

  // Compute totals
  const { subtotal, discountAmount, total } = quoteStore.calculateTotals(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountPercent: i.discountPercent,
    })),
    globalDiscount,
  )

  const locale = localeProp ?? 'pt-BR'
  const formatPrice = useCallback(
    (val: number) =>
      val.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  const addItemFromHistory = (entryId: string) => {
    const entry = historyEntries.find((e) => e.id === entryId)
    if (!entry) return

    setItems((prev) => [
      ...prev,
      {
        historyEntryId: entry.id,
        name: entry.name,
        quantity: 1,
        unitPrice: entry.sellPrice,
        totalPrice: entry.sellPrice,
        discountPercent: 0,
      },
    ])
    setShowHistoryPicker(false)
  }

  const updateItem = (idx: number, field: keyof QuoteItem, value: number | string) => {
    setItems((prev) => {
      const updated = prev.map((item, i) => {
        if (i !== idx) return item
        const newItem = { ...item, [field]: field === 'name' ? (value as string) : Number(value) }
        // Recalculate totalPrice for this item
        const lineTotal = newItem.quantity * newItem.unitPrice
        newItem.totalPrice = newItem.discountPercent > 0
          ? lineTotal * (1 - newItem.discountPercent / 100)
          : lineTotal
        return newItem
      })
      return updated
    })
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!title.trim()) {
      setError('O título do orçamento é obrigatório.')
      return
    }
    setError(null)

    const formData: QuoteFormData = {
      title: title.trim(),
      customerId: customerId || undefined,
      items: items.map((item) => ({
        historyEntryId: item.historyEntryId,
        quantity: item.quantity,
        discountPercent: item.discountPercent,
      })),
      globalDiscountPercent: globalDiscount,
      validUntil,
      paymentTerms,
      deliveryEstimate,
      footerNote: footerNote || undefined,
    }

    if (isEditing && editQuote) {
      // Update with recalculated items
      quoteStore.updateQuote(editQuote.id, {
        ...editQuote,
        title: title.trim(),
        customerId: customerId || undefined,
        items,
        globalDiscountPercent: globalDiscount,
        subtotal,
        discountAmount,
        total,
        validUntil,
        paymentTerms,
        deliveryEstimate,
        footerNote: footerNote || undefined,
      })
    } else {
      quoteStore.addQuote(formData)
    }
    onSave()
  }

  return (
    <Modal
      open
      title={isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
            Título do Orçamento
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Orçamento para João"
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 placeholder:text-[var(--color-text-secondary)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
          />
        </div>

        {/* Customer selector */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
            Cliente
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all appearance-none cursor-pointer"
          >
            <option value="">Selecionar cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
              {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
              {selectedCustomer.phone && <span>· {selectedCustomer.phone}</span>}
            </div>
          )}
        </div>

        {/* Items section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Itens ({items.length})
            </label>
            <button
              onClick={() => setShowHistoryPicker(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/50 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Adicionar do Histórico
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4 italic">
              Adicione itens do histórico de cálculos
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] font-medium truncate">
                      {item.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-[var(--color-text-muted)] uppercase">Qtd</span>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="w-14 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] h-8 px-2 text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-[var(--color-text-muted)] uppercase">V.Unit</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                        className="w-20 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] h-8 px-2 text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-[var(--color-text-muted)] uppercase">Desc%</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.discountPercent}
                        onChange={(e) => updateItem(idx, 'discountPercent', e.target.value)}
                        className="w-14 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] h-8 px-2 text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1.5 rounded-lg text-[var(--color-danger)] hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                      aria-label="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global discount */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
              Desc. Global %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={globalDiscount}
              onChange={(e) => setGlobalDiscount(Number(e.target.value))}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
              Validade
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
              Pagamento
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="À vista, 30 dias..."
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 placeholder:text-[var(--color-text-secondary)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
              Prazo Entrega
            </label>
            <input
              type="text"
              value={deliveryEstimate}
              onChange={(e) => setDeliveryEstimate(e.target.value)}
              placeholder="5 dias úteis"
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-11 px-3 placeholder:text-[var(--color-text-secondary)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
            />
          </div>
        </div>

        {/* Footer note */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5">
            Observações
          </label>
          <textarea
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder="Notas adicionais..."
            rows={2}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] px-3 py-2 placeholder:text-[var(--color-text-secondary)]/70 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all resize-none"
          />
        </div>

        {/* Totals */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--color-text-secondary)]">Subtotal</span>
            <span className="text-[var(--color-text-primary)] font-mono">{symbol} {formatPrice(subtotal)}</span>
          </div>
          {globalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-[var(--color-danger)]">Desconto ({globalDiscount}%)</span>
              <span className="text-[var(--color-danger)] font-mono">-{symbol} {formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-base font-bold mt-3 pt-3 border-t border-[var(--color-border)]">
            <span className="text-[var(--color-text-primary)]">TOTAL</span>
            <span className="text-[var(--color-success)] font-mono text-lg">{symbol} {formatPrice(total)}</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-danger)] bg-red-500/10 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {isEditing ? 'Atualizar' : 'Salvar Orçamento'}
          </button>
        </div>
      </div>

      {/* History Picker Modal */}
      <Modal
        open={showHistoryPicker}
        title="Selecionar Item do Histórico"
        onClose={() => setShowHistoryPicker(false)}
      >
        <div className="max-h-72 overflow-y-auto space-y-2">
          {historyEntries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
              Nenhum item no histórico
            </p>
          ) : (
            historyEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => addItemFromHistory(entry.id)}
                className="w-full text-left p-3 rounded-xl bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                <div className="text-sm text-[var(--color-text-primary)] font-medium">{entry.name}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {symbol} {formatPrice(entry.sellPrice)} · {entry.type.toUpperCase()}
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </Modal>
  )
}

// ── QuoteViewModal ────────────────────────────────────────────────
function QuoteViewModal({
  quote,
  customer,
  onClose,
  locale = 'pt-BR',
}: {
  quote: Quote
  customer?: Customer
  onClose: () => void
  locale?: string
}) {
  const { symbol, format: formatMoney } = useCurrency()
  const quoteStore = useQuoteStore.getState()
  const statusConfig = STATUS_CONFIG[quote.status]

  const updateStatus = (newStatus: Quote['status']) => {
    quoteStore.setQuoteStatus(quote.id, newStatus)
  }

  const handleExportPdf = async () => {
    const { pdf: pdfFn } = await import('@react-pdf/renderer')
    const blob = await pdfFn(
      <QuoteDoc
        quote={quote}
        customer={customer}
        currencySymbol={symbol}
      />,
    ).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orcamento_${String(quote.number).padStart(3, '0')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open
      title={`Orçamento #${String(quote.number).padStart(3, '0')}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {/* Status + actions bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Criado em {new Date(quote.createdAt).toLocaleDateString(locale)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={quote.status}
              onChange={(e) => updateStatus(e.target.value as Quote['status'])}
              className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)] h-8 px-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all appearance-none cursor-pointer"
            >
              <option value="draft">Rascunho</option>
              <option value="sent">Enviado</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Recusado</option>
            </select>
            <button
              onClick={handleExportPdf}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* Quote info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Título</p>
            <p className="text-sm text-[var(--color-text-primary)] font-medium">{quote.title}</p>
          </div>
          {quote.validUntil && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Validade</p>
              <p className="text-sm text-[var(--color-text-primary)]">{new Date(quote.validUntil + 'T00:00:00').toLocaleDateString(locale)}</p>
            </div>
          )}
        </div>

        {/* Customer info */}
        {customer && (
          <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Cliente</p>
            <p className="text-sm text-[var(--color-text-primary)]">{customer.name}</p>
            {customer.company && <p className="text-xs text-[var(--color-text-secondary)]">{customer.company}</p>}
            {customer.email && <p className="text-xs text-[var(--color-text-secondary)]">{customer.email}</p>}
            {customer.phone && <p className="text-xs text-[var(--color-text-secondary)]">{customer.phone}</p>}
          </div>
        )}

        {/* Items table */}
        {quote.items.length > 0 && (
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Itens</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                    <th className="text-left py-2 pr-2">Qtd</th>
                    <th className="text-left py-2 px-2">Descrição</th>
                    <th className="text-right py-2 px-2">V. Unit.</th>
                    <th className="text-right py-2 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unitPrice
                    const discountedTotal = item.discountPercent > 0
                      ? lineTotal * (1 - item.discountPercent / 100)
                      : lineTotal
                    return (
                      <tr key={idx} className="border-b border-[var(--color-border)]">
                        <td className="py-2.5 pr-2 text-[var(--color-text-primary)]">{item.quantity}</td>
                        <td className="py-2.5 px-2 text-[var(--color-text-primary)]">
                          {item.name}
                          {item.discountPercent > 0 && (
                            <span className="text-[var(--color-danger)] text-xs ml-1">(-{item.discountPercent}%)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[var(--color-text-secondary)] font-mono">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="py-2.5 pl-2 text-right text-[var(--color-text-primary)] font-mono font-medium">
                          {formatMoney(discountedTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-4 max-w-xs ml-auto">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">Subtotal</span>
            <span className="text-[var(--color-text-primary)] font-mono">{formatMoney(quote.subtotal)}</span>
          </div>
          {quote.globalDiscountPercent > 0 && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-[var(--color-danger)]">Desconto ({quote.globalDiscountPercent}%)</span>
              <span className="text-[var(--color-danger)] font-mono">-{formatMoney(quote.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold mt-3 pt-3 border-t border-[var(--color-border)]">
            <span className="text-[var(--color-text-primary)]">TOTAL</span>
            <span className="text-[var(--color-success)] font-mono text-lg">{formatMoney(quote.total)}</span>
          </div>
        </div>

        {/* Terms */}
        {(quote.paymentTerms || quote.deliveryEstimate || quote.footerNote) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {quote.paymentTerms && (
              <div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Pagamento</p>
                <p className="text-[var(--color-text-primary)]">{quote.paymentTerms}</p>
              </div>
            )}
            {quote.deliveryEstimate && (
              <div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Prazo</p>
                <p className="text-[var(--color-text-primary)]">{quote.deliveryEstimate}</p>
              </div>
            )}
            {quote.footerNote && (
              <div className="sm:col-span-2">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Observações</p>
                <p className="text-[var(--color-text-primary)] italic">{quote.footerNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Main QuoteSection ─────────────────────────────────────────────
export function QuoteSection({ locale: localeProp }: { locale?: string } = {}) {
  const { t, i18n } = useTranslation()
  const { format: formatMoney } = useCurrency()
  const locale = localeProp ?? i18n.language ?? 'pt-BR'
  const quoteStore = useQuoteStore()
  const customers = useCustomerStore((s) => s.customers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editQuote, setEditQuote] = useState<Quote | undefined>(undefined)
  const [viewQuote, setViewQuote] = useState<Quote | undefined>(undefined)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Sync search with store
  useEffect(() => {
    quoteStore.setSearchQuery(search)
  }, [search, quoteStore.setSearchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = quoteStore.getFilteredQuotes()

  const statusFilters: Array<{ key: typeof quoteStore.statusFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'draft', label: 'Rascunho' },
    { key: 'sent', label: 'Enviado' },
    { key: 'approved', label: 'Aprovado' },
    { key: 'rejected', label: 'Recusado' },
  ]

  const handleNewQuote = () => {
    setEditQuote(undefined)
    setShowForm(true)
  }

  const handleEditQuote = (quote: Quote) => {
    setEditQuote(quote)
    setShowForm(true)
  }

  const handleFormSave = () => {
    setShowForm(false)
    setEditQuote(undefined)
  }

  const handleViewQuote = (quote: Quote) => {
    setViewQuote(quote)
  }

  const getCustomerForQuote = (quote: Quote): Customer | undefined => {
    if (quote.customerId) return customers.find((c) => c.id === quote.customerId)
    return undefined
  }

  return (
    <div className="surface rounded-xl p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-2">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--color-accent)]" />
          {t('quotes.title', 'Orçamentos')}
        </h2>
        <button
          onClick={handleNewQuote}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('quotes.newQuote', 'Novo Orçamento')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0" style={{ scrollbarWidth: 'none' }}>
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => quoteStore.setStatusFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap ${
                quoteStore.statusFilter === f.key
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('quotes.searchPlaceholder', 'Buscar por título ou cliente...')}
          className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl text-sm text-[var(--color-text-primary)] h-12 pl-10 pr-4 placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]/60 transition-all"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento criado ainda"
          description="Crie orçamentos profissionais a partir dos seus cálculos salvos no histórico."
          action={{ label: 'Criar primeiro orçamento', onClick: handleNewQuote }}
        />
      ) : (
        <div className="space-y-2 max-h-[60vh] sm:max-h-80 overflow-y-auto">
          {filtered.map((quote) => {
            const customer = getCustomerForQuote(quote)
            const statusCfg = STATUS_CONFIG[quote.status]
            return (
              <div
                key={quote.id}
                className="surface rounded-xl p-3 flex items-center gap-3 hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                {/* Quote info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-accent)] font-mono font-bold">
                      #{String(quote.number).padStart(3, '0')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate mt-0.5">
                    {quote.title}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {customer ? customer.name : 'Sem cliente'}
                    <span className="mx-1">·</span>
                    {new Date(quote.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[var(--color-success)] font-mono">
                    {formatMoney(quote.total)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleViewQuote(quote)}
                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                    aria-label="Visualizar"
                    title="Visualizar"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleEditQuote(quote)}
                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-warning)] hover:bg-amber-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                    aria-label="Editar"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(quote.id)}
                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                    aria-label="Excluir"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <QuoteFormModal
          editQuote={editQuote}
          onClose={() => { setShowForm(false); setEditQuote(undefined) }}
          onSave={handleFormSave}
          locale={locale}
        />
      )}
      {viewQuote && (
        <QuoteViewModal
          quote={viewQuote}
          customer={getCustomerForQuote(viewQuote)}
          onClose={() => setViewQuote(undefined)}
          locale={locale}
        />
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir Orçamento"
        message={
          confirmDeleteId
            ? `Tem certeza que deseja excluir o orçamento #${String(
                useQuoteStore.getState().getQuote(confirmDeleteId)?.number ?? '',
              ).padStart(3, '0')}?`
            : ''
        }
        variant="danger"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            useQuoteStore.getState().removeQuote(confirmDeleteId)
          }
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
