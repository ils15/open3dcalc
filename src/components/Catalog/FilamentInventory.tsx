import { useState, useMemo } from 'react'
import { useFilamentInventory, type FilamentSpool, type SpoolStatus } from '@/stores/filamentInventory'
import { useCurrency } from '@/hooks/useCurrency'
import { InputGroup } from '@/components/ui/InputGroup'
import { Select } from '@/components/ui/Select'
import { AlertTriangle, Plus, Pencil, Trash2, Search, X, Palette } from 'lucide-react'

const FILTER_MATERIALS = ['Todos', 'PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'SILK', 'Outro']
const FILTER_STATUSES = [
  { value: 'all',        label: 'Todos status' },
  { value: 'in_stock',   label: 'Em estoque' },
  { value: 'on_the_way', label: 'A caminho' },
  { value: 'empty',      label: 'Vazio' },
]
const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'SILK', 'Nylon', 'PLA-CF', 'PETG-CF', 'PVA', 'HIPS', 'Outro']
const BRANDS = [
  'Bambu Lab', 'Creality', 'Anycubic', 'Prusa', 'Elegoo', 'Flashforge',
  'Hatchbox', 'eSun', 'Sunlu', 'Polymaker', 'Voolt 3D', '3DPrime', 'Outro',
]
const STORES = [
  'Aliexpress', 'Mercado Livre', 'Amazon', 'Voolt 3D', '3DPrime',
  'Bambu Store', 'Creality Store', 'Shopee', 'Outro',
]
const STATUS_OPTIONS = [
  { value: 'in_stock',   label: 'Em estoque' },
  { value: 'on_the_way', label: 'A caminho' },
  { value: 'empty',      label: 'Vazio' },
]

const COLOR_HEX: Record<string, string> = {
  'preto': '#374151', 'branco': '#e2e8f0', 'branco dental': '#f8f5e4',
  'cinza': '#9ca3af', 'prata': '#94a3b8',
  'vermelho': '#ef4444', 'rosa': '#ec4899', 'rosa bebe': '#fda4af',
  'laranja': '#f97316', 'amarelo': '#eab308', 'dourado': '#d97706', 'bronze': '#b45309',
  'verde': '#22c55e', 'azul': '#3b82f6', 'azul velvet': '#1e40af',
  'roxo': '#a855f7', 'marrom': '#92400e',
  'transparente': '#94a3b8', 'natural': '#d4b896',
}

function resolveHex(color: string, stored?: string): string {
  if (stored) return stored
  const lower = color.toLowerCase()
  for (const [key, hex] of Object.entries(COLOR_HEX)) {
    if (lower === key || lower.includes(key)) return hex
  }
  return '#6366f1'
}

function SpoolIcon({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <ellipse cx="10" cy="22" rx="8" ry="13" fill={color} opacity="0.9" />
      <ellipse cx="34" cy="22" rx="8" ry="13" fill={color} opacity="0.9" />
      <rect x="10" y="15" width="24" height="14" fill={color} opacity="0.25" />
      <rect x="10" y="17" width="24" height="3.5" rx="1" fill={color} opacity="0.55" />
      <rect x="10" y="23.5" width="24" height="3.5" rx="1" fill={color} opacity="0.55" />
      <circle cx="22" cy="22" r="3.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  )
}

function StatusBadge({ status }: { status: SpoolStatus }) {
  const cfg: Record<SpoolStatus, { label: string; cls: string }> = {
    in_stock:   { label: 'Em estoque', cls: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30' },
    on_the_way: { label: 'A caminho',  cls: 'bg-amber-600/20  text-amber-400  border-amber-600/30'  },
    empty:      { label: 'Vazio',      cls: 'bg-gray-600/20   text-gray-400   border-gray-600/30'   },
  }
  const { label, cls } = cfg[status]
  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${cls}`}>
      {label}
    </span>
  )
}

interface FormState {
  brand: string; material: string; color: string; colorHex: string
  weight: string; costPerKg: string; diameter: string; notes: string
  status: SpoolStatus; purchaseStore: string
}

const emptyForm = (): FormState => ({
  brand: '', material: 'PLA', color: '', colorHex: '',
  weight: '', costPerKg: '', diameter: '1.75', notes: '',
  status: 'in_stock', purchaseStore: '',
})

function spoolToForm(s: FilamentSpool): FormState {
  return {
    brand: s.brand, material: s.material, color: s.color, colorHex: s.colorHex || '',
    weight: s.weightGrams.toString(),
    costPerKg: s.costPerKg > 0 ? s.costPerKg.toString() : '',
    diameter: s.diameterMm.toString(), notes: s.notes || '',
    status: s.status || 'in_stock', purchaseStore: s.purchaseStore || '',
  }
}

export function FilamentInventory() {
  const store = useFilamentInventory()
  const { format: fmtCurrency, symbol } = useCurrency()

  const [search, setSearch] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('Todos')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())

  const upd = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setForm(emptyForm()); setEditingId(null); setShowForm(true) }
  const openEdit = (s: FilamentSpool) => { setForm(spoolToForm(s)); setEditingId(s.id); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()) }

  const saveForm = () => {
    if (!form.brand.trim() || !form.color.trim() || !form.weight) return
    const hex = form.colorHex || resolveHex(form.color)
    const origWeight = editingId
      ? (store.spools.find(s => s.id === editingId)?.originalWeightGrams ?? (parseFloat(form.weight) || 1000))
      : parseFloat(form.weight) || 1000
    const data: Omit<FilamentSpool, 'id' | 'dateAdded'> = {
      brand: form.brand, material: form.material, color: form.color, colorHex: hex,
      weightGrams: parseFloat(form.weight) || 1000,
      originalWeightGrams: origWeight,
      costPerKg: parseFloat(form.costPerKg) || 0,
      diameterMm: parseFloat(form.diameter) || 1.75,
      notes: form.notes, status: form.status, purchaseStore: form.purchaseStore,
    }
    if (editingId) store.updateSpool(editingId, data)
    else store.addSpool(data)
    closeForm()
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const main = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'SILK']
    return store.spools.filter(s => {
      if (q && !s.color.toLowerCase().includes(q) && !s.brand.toLowerCase().includes(q) &&
          !s.material.toLowerCase().includes(q) && !(s.purchaseStore || '').toLowerCase().includes(q)) return false
      if (filterMaterial !== 'Todos') {
        const isOther = filterMaterial === 'Outro'
        if (isOther ? main.includes(s.material) : s.material !== filterMaterial) return false
      }
      if (filterStatus !== 'all' && (s.status || 'in_stock') !== filterStatus) return false
      return true
    })
  }, [store.spools, search, filterMaterial, filterStatus])

  const lowCount = store.getLowStockSpools(100).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Estoque</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {store.spools.length} rolos cadastrados
            {lowCount > 0 && (
              <span className="ml-2 text-amber-400 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{lowCount} com estoque baixo
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPalette(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] text-slate-300 hover:bg-white/10 transition-colors border border-white/10"
          >
            <Palette className="w-4 h-4" />
            Paleta de Cores
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-400 active:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Rolo
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cor, marca, material..."
            className="w-full h-11 pl-10 pr-9 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {FILTER_MATERIALS.map(m => (
            <button
              key={m}
              onClick={() => setFilterMaterial(m)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                filterMaterial === m
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/20 hover:text-slate-200'
              }`}
            >{m}</button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          {FILTER_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                filterStatus === s.value
                  ? 'bg-slate-600 text-white border-slate-500'
                  : 'bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/20 hover:text-slate-200'
              }`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map(s => {
          const pct = Math.min(100, Math.round((s.weightGrams / s.originalWeightGrams) * 100))
          const isLow = (s.status || 'in_stock') === 'in_stock' && s.weightGrams < 100
          const hex = resolveHex(s.color, s.colorHex)
          const status: SpoolStatus = s.status || 'in_stock'
          const barColor = pct < 20 ? '#f97316' : hex

          return (
            <div
              key={s.id}
              className="glass rounded-2xl p-4 group relative flex flex-col gap-3 hover:shadow-xl transition-shadow"
            >
              {isLow && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Estoque baixo
                </div>
              )}

              <div className="flex items-center gap-3">
                <SpoolIcon color={hex} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-[15px] leading-tight truncate pr-4">{s.color}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.material} · {s.brand}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400 font-medium">Restante</span>
                  <span>
                    <span className="font-bold text-white">{s.weightGrams}g</span>
                    <span className="text-gray-500"> / {s.originalWeightGrams}g</span>
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="text-right text-[10px] text-gray-500 mt-1">{pct}%</div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-sm min-w-0">
                  {s.costPerKg > 0 ? (
                    <>
                      <span className="font-bold text-white">{fmtCurrency(s.costPerKg)}</span>
                      {s.purchaseStore && (
                        <span className="text-gray-500 text-xs"> · {s.purchaseStore}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500 text-xs">{s.purchaseStore || '\u2014'}</span>
                  )}
                </span>
                <StatusBadge status={status} />
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(s)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-white/[0.05] text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </button>
                <button
                  onClick={() => store.removeSpool(s.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/30 hover:text-red-300 transition-colors"
                  aria-label="Remover rolo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-12 text-center text-gray-500 text-sm">
            {search || filterMaterial !== 'Todos' || filterStatus !== 'all'
              ? 'Nenhum rolo encontrado com esses filtros.'
              : 'Nenhum rolo cadastrado. Clique em "+ Novo Rolo" para começar.'}
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeForm}
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">
                {editingId ? 'Editar Rolo' : 'Novo Rolo'}
              </h3>
              <button
                onClick={closeForm}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex gap-2 items-end">
                <div className="flex-1">
                  <InputGroup label="Cor" value={form.color} onChange={v => upd('color', v)} type="text" placeholder="Ex: Azul Velvet" />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Hex</label>
                  <input
                    type="color"
                    value={form.colorHex || resolveHex(form.color)}
                    onChange={e => upd('colorHex', e.target.value)}
                    className="w-11 h-[42px] rounded-lg border border-white/10 bg-white/5 cursor-pointer p-0.5"
                    title="Cor da bobina"
                  />
                </div>
              </div>
              <Select label="Material" value={form.material} onChange={v => upd('material', v)} options={MATERIALS.map(m => ({ label: m, value: m }))} search={false} />
              <Select label="Marca" value={form.brand} onChange={v => upd('brand', v)} options={BRANDS.map(b => ({ label: b, value: b }))} search />
              <InputGroup label="Peso (g)" value={form.weight} onChange={v => upd('weight', v)} type="number" unit="g" />
              <InputGroup label="Custo/kg" value={form.costPerKg} onChange={v => upd('costPerKg', v)} type="number" prefix={symbol} />
              <Select label="Loja" value={form.purchaseStore} onChange={v => upd('purchaseStore', v)} options={STORES.map(s => ({ label: s, value: s }))} search />
              <Select label="Status" value={form.status} onChange={v => upd('status', v as SpoolStatus)} options={STATUS_OPTIONS} search={false} />
              <InputGroup label="Diametro" value={form.diameter} onChange={v => upd('diameter', v)} type="number" unit="mm" />
              <div className="col-span-2">
                <InputGroup label="Notas" value={form.notes} onChange={v => upd('notes', v)} type="text" placeholder="Opcional" />
              </div>
            </div>

            <button
              onClick={saveForm}
              disabled={!form.brand.trim() || !form.color.trim() || !form.weight}
              className="mt-5 w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              {editingId ? 'Salvar Alteracoes' : 'Salvar Rolo'}
            </button>
          </div>
        </div>
      )}

      {showPalette && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                Paleta de Cores
              </h3>
              <button
                onClick={() => setShowPalette(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {store.spools.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Nenhum rolo cadastrado.</p>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {store.spools.map(s => {
                  const hex = resolveHex(s.color, s.colorHex)
                  return (
                    <div key={s.id} className="flex flex-col items-center gap-1.5">
                      <div className="w-12 h-12 rounded-xl border border-white/10" style={{ backgroundColor: hex }} />
                      <p className="text-[10px] text-gray-300 text-center leading-tight truncate w-full font-medium">{s.color}</p>
                      <p className="text-[9px] text-gray-500 text-center">{s.material}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
