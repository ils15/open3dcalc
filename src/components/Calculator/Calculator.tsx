import { useCallback, useRef, useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { useFilamentInventory } from '@/stores/filamentInventory'
import { selectSpool } from '@/stores/storeBridge'
import { useCurrency } from '@/hooks/useCurrency'
import { InputGroup } from '@/components/ui/InputGroup'
import { Select } from '@/components/ui/Select'
import { ToggleSwitch } from '@/components/ui/ToggleCard'
import { ToastContainer } from '@/components/ui/Toast'
import { ResultsPanel } from './ResultsPanel'
import type { BufferGeometry } from 'three'
import { estimatePrintTimeFromDimensions } from '@/lib/printTimeEstimator'
import {
  Layers, SlidersHorizontal, Wrench, Printer, HardHat, ShieldCheck,
  DollarSign, BarChart3,
  FlaskConical, Upload, Receipt, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

const StlPreview = lazy(() => import('@/components/StlPreview/StlPreview').then(m => ({ default: m.StlPreview })))

const SECTIONS: { id: string; Icon: LucideIcon; label: string; shortKey: string }[] = [
  { id: 'material',  Icon: Layers,            label: 'calc.material',         shortKey: 'calc.sectionShort.material'  },
  { id: 'print',     Icon: SlidersHorizontal, label: 'calc.printParams',      shortKey: 'calc.sectionShort.print'     },
  { id: 'failure',   Icon: AlertTriangle,     label: 'calc.failure.title',    shortKey: 'calc.sectionShort.failure'   },
  { id: 'hardware',  Icon: Wrench,            label: 'calc.fdmHardware',      shortKey: 'calc.sectionShort.hardware'  },
  { id: 'machine',   Icon: Printer,           label: 'calc.machine',          shortKey: 'calc.sectionShort.machine'   },
  { id: 'fixedCost', Icon: Receipt,           label: 'calc.fixedCost.title',  shortKey: 'calc.sectionShort.fixedCost' },
  { id: 'labor',     Icon: HardHat,           label: 'calc.labor',            shortKey: 'calc.sectionShort.labor'     },
  { id: 'ops',       Icon: ShieldCheck,       label: 'calc.opsSoftware',      shortKey: 'calc.sectionShort.ops'       },
  { id: 'sales',     Icon: DollarSign,        label: 'calc.sales',            shortKey: 'calc.sectionShort.sales'     },
  { id: 'results',   Icon: BarChart3,         label: 'calc.results',          shortKey: 'calc.sectionShort.results'   },
]

const SECTION_ENABLES: Record<string, string[]> = {
  material:  ['material'],
  print:     ['energy'],
  failure:   ['failure'],
  hardware:  ['hardware', 'postProcessing'],
  machine:   ['machine'],
  fixedCost: [],
  labor:     ['labor'],
  ops:       ['software', 'consumables'],
  sales:     ['packaging', 'shipping', 'extras'],
  results:   [],
}

export function Calculator() {
  const { t } = useTranslation()
  const store = useCalculatorStore()

  const catalogPrinters = useCatalogStore(s => s.printers)
  const catalogMaterials = useCatalogStore(s => s.materials)
  const catalogMarketplaces = useCatalogStore(s => s.marketplaces)
  const inventorySpools = useFilamentInventory(s => s.spools)
  const [showSpoolSelector, setShowSpoolSelector] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stlGeometry, setStlGeometry] = useState<BufferGeometry | null>(null)
  const [stlInfo, setStlInfo] = useState<{ volume: number; faces: number; vertices: number; dimensions: { x: number; y: number; z: number } } | null>(null)
  const [stlLoading, setStlLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('material')
  const [toastItems, setToastItems] = useState<{ id: number; message: string; type: 'error' | 'success' | 'info' }[]>([])

  const dismissToast = (id: number) => {
    setToastItems(prev => prev.filter(t => t.id !== id))
  }

  const isFDM = store.activeTab === 'fdm'
  const { format: fmtCurrency, symbol: currencySymbol } = useCurrency()

  const handleFileDrop = useCallback(async (file: File) => {
    const toast = (msg: string) => {
      setToastItems(prev => [...prev, { id: Date.now(), message: msg, type: 'error' as const }])
    }
    if (!file.name.match(/\.(stl|obj|3mf|gcode)$/i)) {
      toast(t('stl.invalidFile'))
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast('Arquivo muito grande. Limite: 50MB.')
      return
    }
    setStlLoading(true)
    try {
      if (file.name.match(/\.gcode$/i)) {
        const { parseGcode } = await import('@/lib/gcodeParser')
        const text = await file.text()
        const gcode = parseGcode(text)
        if (gcode.printTimeMinutes > 0) {
          const hours = gcode.printTimeMinutes / 60
          if (isFDM) {
            store.setFdmPrintParams({ ...store.fdmPrintParams, printTimeHours: parseFloat(hours.toFixed(2)) })
          } else {
            store.setResinPrintParams({ ...store.resinPrintParams, printTimeHours: parseFloat(hours.toFixed(2)) })
          }
        }
        if (gcode.filamentUsedGrams > 0) {
          const w = parseFloat(gcode.filamentUsedGrams.toFixed(2))
          if (store.fdmAmsEnabled) {
            const idx = store.fdmAmsSlots.findIndex(s => s.enabled)
            if (idx >= 0) {
              const slot = { ...store.fdmAmsSlots[idx], weightUsedGrams: w }
              store.setFdmAmsSlot(idx, slot)
            }
          } else {
            store.setFdmMaterial({ ...store.fdmMaterial, weightUsed: w })
          }
        }
        setStlInfo({ volume: 0, faces: 0, vertices: 0, dimensions: { x: 0, y: 0, z: 0 } })
      } else {
        const { analyzeMeshFile, volumeToCm3, estimateWeight } = await import('@/lib/stlParser')
        const { geometry, analysis } = await analyzeMeshFile(file)
        if (analysis.triangleCount > 2_000_000) {
          toast('Malha muito complexa. Limite: 2 milhões de triângulos.')
          setStlLoading(false)
          return
        }
        setStlGeometry(geometry)
        const volume = volumeToCm3(analysis.volume)
        setStlInfo({ volume, faces: analysis.triangleCount, vertices: analysis.vertexCount, dimensions: analysis.dimensions })

        // Estimate print time from bounding box dimensions
        const { x: width, y: depth, z: height } = analysis.dimensions
        if (width > 0 && depth > 0 && height > 0) {
          const timeEstimate = estimatePrintTimeFromDimensions(width, depth, height)
          const estimatedHours = timeEstimate.estimatedHours
          if (isFDM) {
            store.setFdmPrintParams({ ...store.fdmPrintParams, printTimeHours: estimatedHours })
          } else {
            store.setResinPrintParams({ ...store.resinPrintParams, printTimeHours: estimatedHours })
          }
        }

        const density = store.fdmAmsEnabled
          ? (store.fdmAmsSlots.find(s => s.enabled)?.density ?? store.fdmMaterial.density)
          : store.fdmMaterial.density
        const weight = estimateWeight(volume, density, 20, 10)
        const w = parseFloat(weight.toFixed(2))
        if (store.fdmAmsEnabled) {
          const idx = store.fdmAmsSlots.findIndex(s => s.enabled)
          if (idx >= 0) {
            const slot = { ...store.fdmAmsSlots[idx], weightUsedGrams: w }
            store.setFdmAmsSlot(idx, slot)
          }
        } else {
          store.setFdmMaterial({ ...store.fdmMaterial, weightUsed: w })
        }
      }
    } catch {
      toast(t('stl.error'))
    }
    setStlLoading(false)
  }, [store, t, isFDM])

  const handlePrinterSelect = (id: string) => {
    const p = catalogPrinters.find(p => p.id === id)
    if (p) {
      store.setSelectedPrinter(p as Parameters<typeof store.setSelectedPrinter>[0])
      store.setFdmPrintParams({ ...store.fdmPrintParams, printerPowerWatts: p.power })
      store.setFdmMachine({ ...store.fdmMachine, machineCost: p.value })
    }
  }

  const handleMarketplaceChange = (id: string) => {
    const mp = catalogMarketplaces.find(m => m.id === id)
    if (mp) {
      store.setSelectedMarketplace(mp as Parameters<typeof store.setSelectedMarketplace>[0])
      store.setFdmSales({ ...store.fdmSales, marketplaceFeePercent: mp.feePercent })
    }
  }

  const handleInput = useCallback((value: string, setter: (v: number) => void) => {
    setter(value === '' ? 0 : parseFloat(value) || 0)
  }, [])

  const results = store.results

  if (!results) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Carregando...</div>
      </div>
    )
  }

  function renderSectionHeader(Icon: LucideIcon, title: string, subtitle?: string) {
    return (
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/[0.06]">
        <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-slate-100 truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
    )
  }

  function renderMaterialSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(isFDM ? Layers : FlaskConical, t('calc.material'), t(isFDM ? 'calc.sectionDesc.fdmMaterial' : 'calc.sectionDesc.resinMaterial'))}
        {isFDM ? (
          <>
          {(store.selectedPrinter.maxFilaments ?? 1) > 1 && (
            <div className="flex items-center justify-end gap-2 mb-3">
              <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wide">AMS Multi-material</span>
              <button
                onClick={() => {
                  const was = store.fdmAmsEnabled
                  if (!was) {
                    const slot0 = { ...store.fdmAmsSlots[0] }
                    slot0.materialType = store.fdmMaterial.type
                    slot0.costPerKg = store.fdmMaterial.costPerKg
                    slot0.weightUsedGrams = store.fdmMaterial.weightUsed
                    slot0.purgeWeightGrams = store.fdmMaterial.purgeWeight
                    slot0.density = store.fdmMaterial.density
                    slot0.spoolEfficiency = store.fdmMaterial.spoolEfficiency
                    store.setFdmAmsSlot(0, slot0)
                  }
                  store.setFdmAmsEnabled(!was)
                }}
                aria-pressed={store.fdmAmsEnabled}
                className={`relative w-9 h-4 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none shrink-0 ${store.fdmAmsEnabled ? 'bg-sky-600' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-md transition-all duration-200 ${store.fdmAmsEnabled ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          )}
          {store.fdmAmsEnabled ? (
            <div className="space-y-2">
              {store.fdmAmsSlots.map((slot, i) => (
                <div key={i} className="glass rounded-xl p-3 border-l-4" style={{ borderLeftColor: slot.color }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400">Slot {i + 1}</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={slot.color}
                        onChange={e => store.setFdmAmsSlot(i, { ...slot, color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                      <button
                        onClick={() => {
                          const s = { ...slot, enabled: !slot.enabled }
                          store.setFdmAmsSlot(i, s)
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${slot.enabled ? 'bg-sky-600/30 text-sky-300' : 'bg-white/5 text-gray-500'}`}
                      >
                        {slot.enabled ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>
                  {slot.enabled && (
                    <div className="space-y-2">
                      <Select label=""
                        value={slot.materialType}
                        onChange={v => store.setFdmAmsSlot(i, { ...slot, materialType: v })}
                        options={catalogMaterials.filter(m => m.type === 'fdm').map(m => ({ label: m.name, value: m.name }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <InputGroup label="R$/kg" value={slot.costPerKg}
                          onChange={v => store.setFdmAmsSlot(i, { ...slot, costPerKg: parseFloat(v) || 0 })}
                          type="number" prefix={currencySymbol} />
                        <InputGroup label="Peso (g)" value={slot.weightUsedGrams}
                          onChange={v => store.setFdmAmsSlot(i, { ...slot, weightUsedGrams: parseFloat(v) || 0 })}
                          type="number" unit="g" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <InputGroup label="Purga (g)" value={slot.purgeWeightGrams}
                          onChange={v => store.setFdmAmsSlot(i, { ...slot, purgeWeightGrams: parseFloat(v) || 0 })}
                          type="number" unit="g" />
                        <InputGroup label="Dens." value={slot.density}
                          onChange={v => store.setFdmAmsSlot(i, { ...slot, density: parseFloat(v) || 0 })}
                          type="number" unit="g/cm³" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label={t('calc.filamentType')} value={store.fdmMaterial.type}
              onChange={v => store.setFdmMaterial({ ...store.fdmMaterial, type: v })}
              options={catalogMaterials.filter(m => m.type === 'fdm').map(m => ({ label: m.name, value: m.name }))} />
            <div className="relative">
              <InputGroup label={t('calc.costPerKg')} value={store.fdmMaterial.costPerKg}
                onChange={v => handleInput(v, val => store.setFdmMaterial({ ...store.fdmMaterial, costPerKg: val }))}
                type="number" prefix={currencySymbol} />
              {inventorySpools.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSpoolSelector(!showSpoolSelector)}
                  className="absolute right-2 top-7 text-[10px] px-2 py-1 rounded-md bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 transition-colors"
                >
                  Inventário
                </button>
              )}
              {showSpoolSelector && (
                <div className="absolute z-20 mt-1 w-full glass rounded-xl p-2 max-h-48 overflow-y-auto shadow-xl">
                  {inventorySpools
                    .filter(s => s.material.toLowerCase() === store.fdmMaterial.type.toLowerCase() || showSpoolSelector)
                    .slice(0, 10)
                    .map(spool => (
                      <button
                        key={spool.id}
                        type="button"
                        onClick={() => { selectSpool(spool); setShowSpoolSelector(false) }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/10 transition-colors flex justify-between"
                      >
                        <span className="text-slate-200">{spool.brand} - {spool.color}</span>
                        <span className="text-indigo-400">R$ {spool.costPerKg.toFixed(2)}/kg</span>
                      </button>
                    ))}
                  {inventorySpools.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-2">Nenhum carretel no inventário</p>
                  )}
                </div>
              )}
            </div>
            <InputGroup label={t('calc.weight')} value={store.fdmMaterial.weightUsed}
              onChange={v => handleInput(v, val => store.setFdmMaterial({ ...store.fdmMaterial, weightUsed: val }))}
              type="number" unit="g" />
            <InputGroup label={t('calc.purge')} value={store.fdmMaterial.purgeWeight}
              onChange={v => handleInput(v, val => store.setFdmMaterial({ ...store.fdmMaterial, purgeWeight: val }))}
              type="number" unit="g" />
            <InputGroup label={t('calc.spoolEfficiency')} value={store.fdmMaterial.spoolEfficiency}
              onChange={v => handleInput(v, val => store.setFdmMaterial({ ...store.fdmMaterial, spoolEfficiency: val }))}
              type="number" unit="%" />
            <InputGroup label={t('calc.density')} value={store.fdmMaterial.density}
              onChange={v => handleInput(v, val => store.setFdmMaterial({ ...store.fdmMaterial, density: val }))}
              type="number" unit="g/cm³" />
          </div>
          )}
          <div className="sm:col-span-2 mt-3">
            <button
              type="button"
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f) }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex flex-col items-center gap-1.5"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,70,229,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              <input ref={fileInputRef} type="file" accept=".stl,.obj,.3mf,.gcode" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }} className="hidden" />
              <Upload className="w-4 h-4 text-slate-500" />
              <p className="text-xs text-slate-300">{t('product.uploadStl')}</p>
              {stlLoading && <p className="text-[10px] text-indigo-400">{t('stl.loading')}</p>}
            </button>
            {stlGeometry && (
              <div className="mt-2 h-40">
                <Suspense fallback={<div className="text-xs text-gray-400">{t('common.loading')}</div>}>
                  <StlPreview geometry={stlGeometry} />
                </Suspense>
              </div>
            )}
            {stlInfo && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div className="glass rounded-lg p-2 text-center">
                  <p className="text-gray-500">{t('stl.volume')}</p>
                  <p className="font-semibold text-purple-400">{stlInfo.volume.toFixed(1)} cm³</p>
                </div>
                <div className="glass rounded-lg p-2 text-center">
                  <p className="text-gray-500">{t('stl.faces')}</p>
                  <p className="font-semibold text-gray-200">{stlInfo.faces}</p>
                </div>
                <div className="glass rounded-lg p-2 text-center">
                  <p className="text-gray-500">{t('stl.vertices')}</p>
                  <p className="font-semibold text-gray-200">{stlInfo.vertices}</p>
                </div>
              </div>
            )}
          </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label={t('calc.resinType')} value={store.resinMaterial.type}
              onChange={v => store.setResinMaterial({ ...store.resinMaterial, type: v })}
              options={catalogMaterials.filter(m => m.type === 'resin').map(m => ({ label: m.name, value: m.name }))} />
            <InputGroup label={t('calc.costPerLiter')} value={store.resinMaterial.costPerLiter}
              onChange={v => handleInput(v, val => store.setResinMaterial({ ...store.resinMaterial, costPerLiter: val }))}
              type="number" prefix={currencySymbol} />
            <InputGroup label={t('calc.volumeMl')} value={store.resinMaterial.volumeUsedMl}
              onChange={v => handleInput(v, val => store.setResinMaterial({ ...store.resinMaterial, volumeUsedMl: val }))}
              type="number" unit="ml" />
            <InputGroup label={t('calc.wasteMargin')} value={store.resinMaterial.wasteMarginPercent}
              onChange={v => handleInput(v, val => store.setResinMaterial({ ...store.resinMaterial, wasteMarginPercent: val }))}
              type="number" unit="%" />
          </div>
        )}
      </div>
    )
  }

  function renderPrintSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(SlidersHorizontal, t('calc.printParams'), t('calc.sectionDesc.print'))}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputGroup label={t('calc.printTime')}
            value={isFDM ? store.fdmPrintParams.printTimeHours : store.resinPrintParams.printTimeHours}
            onChange={v => handleInput(v, val => isFDM
              ? store.setFdmPrintParams({ ...store.fdmPrintParams, printTimeHours: val })
              : store.setResinPrintParams({ ...store.resinPrintParams, printTimeHours: val })
            )} type="number" unit="h" />
          <InputGroup label={t('calc.printerPower')}
            value={isFDM ? store.fdmPrintParams.printerPowerWatts : store.resinPrintParams.printerPowerWatts}
            onChange={v => handleInput(v, val => isFDM
              ? store.setFdmPrintParams({ ...store.fdmPrintParams, printerPowerWatts: val })
              : store.setResinPrintParams({ ...store.resinPrintParams, printerPowerWatts: val })
            )} type="number" unit="W" />
          <InputGroup label={t('calc.energyCost')}
            value={isFDM ? store.fdmPrintParams.energyCostPerKwh : store.resinPrintParams.energyCostPerKwh}
            onChange={v => handleInput(v, val => isFDM
              ? store.setFdmPrintParams({ ...store.fdmPrintParams, energyCostPerKwh: val })
              : store.setResinPrintParams({ ...store.resinPrintParams, energyCostPerKwh: val })
            )} type="number" unit="R$/kWh" step="0.01" />
          {isFDM && (
            <div className="sm:col-span-2">
              <Select label={t('calc.printer')} value={store.selectedPrinter.id}
              onChange={handlePrinterSelect}
              options={catalogPrinters.map(p => ({ label: p.name, value: p.id, image: p.image, subtitle: `${p.power}W · R$ ${p.value}`, group: p.brand }))}
              groups search />
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderFailureSection() {
    const failureMode = isFDM ? store.fdmPrintParams.failureMode : store.resinPrintParams.failureMode
    const failureValue = isFDM ? store.fdmPrintParams.failureValue : store.resinPrintParams.failureValue
    const riskMultiplier = isFDM ? store.fdmPrintParams.riskMultiplier : store.resinPrintParams.riskMultiplier
    const failureEnabled = store.enabledSections.failure

    const setFailureField = (field: Partial<typeof store.fdmPrintParams>) => {
      const current = isFDM ? store.fdmPrintParams : store.resinPrintParams
      const update = { ...current, ...field }
      if (isFDM) {
        store.setFdmPrintParams(update)
      } else {
        store.setResinPrintParams(update)
      }
    }

    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(AlertTriangle, t('calc.failure.title'), t('calc.failure.description'))}
        <div className="space-y-4">
          <div className="flex items-center justify-between glass rounded-xl px-4 py-3">
            <span className="text-xs font-semibold text-gray-400">{t('calc.failure.enableFailure')}</span>
            <ToggleSwitch enabled={failureEnabled} onToggle={() => {
              store.toggleSection('failure')
              if (!failureEnabled && failureMode === 'none') {
                setFailureField({ failureMode: 'percent', failureValue: 10 })
              }
            }} />
          </div>
          <div className={`space-y-4 transition-all duration-300 ${failureEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label={t('calc.failure.mode')}
                value={failureMode === 'none' ? 'percent' : failureMode}
                onChange={v => setFailureField({ failureMode: v as 'percent' | 'fixed', failureValue: v === 'percent' ? (failureValue || 10) : failureValue })}
                options={[
                  { value: 'percent', label: t('calc.failure.modePercent') },
                  { value: 'fixed', label: t('calc.failure.modeFixed') },
                ]} />
              <InputGroup label={t('calc.failure.value')}
                value={failureValue}
                onChange={v => setFailureField({ failureValue: parseFloat(v) || 0 })}
                type="number"
                unit={failureMode === 'fixed' ? undefined : '%'}
                prefix={failureMode === 'fixed' ? 'R$' : undefined} />
            </div>
            <InputGroup label={t('calc.failure.riskMultiplier')}
              value={riskMultiplier}
              onChange={v => setFailureField({ riskMultiplier: parseFloat(v) || 0 })}
              type="number" step="0.1"
              tooltip={t('calc.failure.riskMultiplierTooltip')} />
          </div>
        </div>
      </div>
    )
  }

  function renderHardwareSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-6">
        {renderSectionHeader(Wrench, t('calc.fdmHardware'), t(isFDM ? 'calc.sectionDesc.fdmHardware' : 'calc.sectionDesc.resinHardware'))}
        {isFDM && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-sky-400">{t('calc.nozzle')}</span>
                  <ToggleSwitch enabled={store.fdmHardware.nozzleEnabled} onToggle={v => store.setFdmHardware({ ...store.fdmHardware, nozzleEnabled: v })} />
                </div>
                {store.fdmHardware.nozzleEnabled && (
                  <>
                    <InputGroup label={t('calc.nozzleCost')} value={store.fdmHardware.nozzleCost}
                      onChange={v => handleInput(v, val => store.setFdmHardware({ ...store.fdmHardware, nozzleCost: val }))} type="number" prefix={currencySymbol} />
                    <InputGroup label={t('calc.nozzleLife')} value={store.fdmHardware.nozzleLifespanKg}
                      onChange={v => handleInput(v, val => store.setFdmHardware({ ...store.fdmHardware, nozzleLifespanKg: val }))} type="number" unit="kg" />
                  </>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-sky-400">{t('calc.bed')}</span>
                  <ToggleSwitch enabled={store.fdmHardware.bedEnabled} onToggle={v => store.setFdmHardware({ ...store.fdmHardware, bedEnabled: v })} />
                </div>
                {store.fdmHardware.bedEnabled && (
                  <InputGroup label={t('calc.bedCost')} value={store.fdmHardware.bedAdhesionCost}
                    onChange={v => handleInput(v, val => store.setFdmHardware({ ...store.fdmHardware, bedAdhesionCost: val }))} type="number" prefix={currencySymbol} />
                )}
              </div>
            </div>
            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <span>🎨</span>
                <span className="text-sm font-semibold text-white">{t('calc.fdmFinishing')}</span>
              </div>
              <InputGroup label={t('calc.finishingSupplies')} value={store.fdmFinishing.suppliesCost}
                onChange={v => handleInput(v, val => store.setFdmFinishing({ ...store.fdmFinishing, suppliesCost: val }))} type="number" prefix={currencySymbol} />
            </div>
          </>
        )}
        {!isFDM && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span>🧪</span>
                <span className="text-sm font-semibold text-white">{t('calc.resinPostProcess')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">{t('calc.washing')}</span>
                <ToggleSwitch enabled={store.resinPostProcess.washingEnabled} onToggle={v => store.setResinPostProcess({ ...store.resinPostProcess, washingEnabled: v })} />
              </div>
              {store.resinPostProcess.washingEnabled && (
                <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-white/10">
                  <InputGroup label={t('calc.alcoholCost')} value={store.resinPostProcess.alcoholCostPerLiter}
                    onChange={v => handleInput(v, val => store.setResinPostProcess({ ...store.resinPostProcess, alcoholCostPerLiter: val }))} type="number" prefix="R$/L" />
                  <InputGroup label={t('calc.alcoholVol')} value={store.resinPostProcess.alcoholVolumeLiters}
                    onChange={v => handleInput(v, val => store.setResinPostProcess({ ...store.resinPostProcess, alcoholVolumeLiters: val }))} type="number" unit="L" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">{t('calc.curing')}</span>
                <ToggleSwitch enabled={store.resinPostProcess.curingEnabled} onToggle={v => store.setResinPostProcess({ ...store.resinPostProcess, curingEnabled: v })} />
              </div>
              {store.resinPostProcess.curingEnabled && (
                <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-white/10">
                  <InputGroup label={t('calc.cureTime')} value={store.resinPostProcess.curingTimeMinutes}
                    onChange={v => handleInput(v, val => store.setResinPostProcess({ ...store.resinPostProcess, curingTimeMinutes: val }))} type="number" unit="min" />
                  <InputGroup label={t('calc.curePower')} value={store.resinPostProcess.curingPowerWatts}
                    onChange={v => handleInput(v, val => store.setResinPostProcess({ ...store.resinPostProcess, curingPowerWatts: val }))} type="number" unit="W" />
                </div>
              )}
            </div>
            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <span>🖥️</span>
                <span className="text-sm font-semibold text-white">{t('calc.resinHardware')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputGroup label={t('calc.lcdCost')} value={store.resinHardware.lcdCost}
                  onChange={v => handleInput(v, val => store.setResinHardware({ ...store.resinHardware, lcdCost: val }))} type="number" prefix={currencySymbol} />
                <InputGroup label={t('calc.lcdLife')} value={store.resinHardware.lcdLifespanHours}
                  onChange={v => handleInput(v, val => store.setResinHardware({ ...store.resinHardware, lcdLifespanHours: val }))} type="number" unit="h" />
                <InputGroup label={t('calc.fepCost')} value={store.resinHardware.fepCost}
                  onChange={v => handleInput(v, val => store.setResinHardware({ ...store.resinHardware, fepCost: val }))} type="number" prefix={currencySymbol} />
                <InputGroup label={t('calc.fepLife')} value={store.resinHardware.fepLifespanPrints}
                  onChange={v => handleInput(v, val => store.setResinHardware({ ...store.resinHardware, fepLifespanPrints: val }))} type="number" unit="prints" />
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderMachineSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(Printer, t('calc.machine'), t('calc.sectionDesc.machine'))}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputGroup label={t('calc.machineCost')}
            value={isFDM ? store.fdmMachine.machineCost : store.resinMachine.machineCost}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmMachine({ ...store.fdmMachine, machineCost: val }) : store.setResinMachine({ ...store.resinMachine, machineCost: val }))} type="number" prefix={currencySymbol} />
          <InputGroup label={t('calc.depreciationMonths')}
            value={isFDM ? store.fdmMachine.depreciationMonths : store.resinMachine.depreciationMonths}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmMachine({ ...store.fdmMachine, depreciationMonths: val }) : store.setResinMachine({ ...store.resinMachine, depreciationMonths: val }))} type="number" unit="meses" />
          <InputGroup label={t('calc.hoursPerMonth')}
            value={isFDM ? store.fdmMachine.hoursPerMonth : store.resinMachine.hoursPerMonth}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmMachine({ ...store.fdmMachine, hoursPerMonth: val }) : store.setResinMachine({ ...store.resinMachine, hoursPerMonth: val }))} type="number" unit="h/mês" />
          <div className="sm:col-span-2 flex items-center justify-between glass rounded-xl p-4 sm:p-5">
            <span className="text-xs text-gray-400">{t('calc.maintenance')}</span>
            <ToggleSwitch enabled={isFDM ? store.fdmMachine.maintenanceEnabled : store.resinMachine.maintenanceEnabled}
              onToggle={v => isFDM ? store.setFdmMachine({ ...store.fdmMachine, maintenanceEnabled: v }) : store.setResinMachine({ ...store.resinMachine, maintenanceEnabled: v })} />
          </div>
          {(isFDM ? store.fdmMachine.maintenanceEnabled : store.resinMachine.maintenanceEnabled) && (
            <div className="sm:col-span-2">
              <InputGroup label={t('calc.maintenanceCost')}
                value={isFDM ? store.fdmMachine.maintenanceCost : store.resinMachine.maintenanceCost}
                onChange={v => handleInput(v, val => isFDM ? store.setFdmMachine({ ...store.fdmMachine, maintenanceCost: val }) : store.setResinMachine({ ...store.resinMachine, maintenanceCost: val }))} type="number" prefix="R$/mês" />
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderFixedCostsSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(Receipt, t('calc.fixedCost.title'), t('calc.fixedCost.description'))}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">{t('calc.fixedCost.title')}</span>
          <ToggleSwitch enabled={store.fixedCosts.enabled}
            onToggle={v => store.setFixedCostsField('enabled', v)} />
        </div>
        {store.fixedCosts.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputGroup label={t('calc.fixedCost.monthlyCost')}
              value={store.fixedCosts.monthlyCost}
              onChange={v => handleInput(v, val => store.setFixedCostsField('monthlyCost', val))}
              type="number" prefix={currencySymbol}
              tooltip={t('calc.fixedCost.monthlyCostTooltip')} />
            <InputGroup label={t('calc.fixedCost.monthlyHours')}
              value={store.fixedCosts.monthlyPrintHours}
              onChange={v => handleInput(v, val => store.setFixedCostsField('monthlyPrintHours', val))}
              type="number" unit="h/mês"
              tooltip={t('calc.fixedCost.monthlyHoursTooltip')} />
          </div>
        )}
      </div>
    )
  }

  function renderLaborSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(HardHat, t('calc.labor'), t('calc.sectionDesc.labor'))}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputGroup label={t('calc.setupTime')}
            value={isFDM ? store.fdmLabor.setupTimeMinutes : store.resinLabor.setupTimeMinutes}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmLabor({ ...store.fdmLabor, setupTimeMinutes: val }) : store.setResinLabor({ ...store.resinLabor, setupTimeMinutes: val }))} type="number" unit="min" />
          <InputGroup label={t('calc.postTime')}
            value={isFDM ? store.fdmLabor.postProcessingTimeMinutes : store.resinLabor.postProcessingTimeMinutes}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmLabor({ ...store.fdmLabor, postProcessingTimeMinutes: val }) : store.setResinLabor({ ...store.resinLabor, postProcessingTimeMinutes: val }))} type="number" unit="min" />
          <InputGroup label={t('calc.hourlyRate')}
            value={isFDM ? store.fdmLabor.hourlyRate : store.resinLabor.hourlyRate}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmLabor({ ...store.fdmLabor, hourlyRate: val }) : store.setResinLabor({ ...store.resinLabor, hourlyRate: val }))} type="number" prefix={currencySymbol} />
        </div>
      </div>
    )
  }

  function renderOpsSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(ShieldCheck, t('calc.opsSoftware'), t('calc.sectionDesc.ops'))}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <span className="text-xs font-semibold text-gray-300">{t('calc.ppe')}</span>
              <ToggleSwitch enabled={isFDM ? store.fdmOps.enabled : store.resinOps.enabled}
                onToggle={v => isFDM ? store.setFdmOps({ ...store.fdmOps, enabled: v }) : store.setResinOps({ ...store.resinOps, enabled: v })} />
            </div>
            {(isFDM ? store.fdmOps.enabled : store.resinOps.enabled) && (
              <InputGroup label={t('calc.ppeCost')}
                value={isFDM ? store.fdmOps.ppeCostPerPrint : store.resinOps.ppeCostPerPrint}
                onChange={v => handleInput(v, val => isFDM ? store.setFdmOps({ ...store.fdmOps, ppeCostPerPrint: val }) : store.setResinOps({ ...store.resinOps, ppeCostPerPrint: val }))} type="number" prefix={currencySymbol} />
            )}
          </div>
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <span className="text-xs font-semibold text-gray-300">{t('calc.software')}</span>
              <ToggleSwitch enabled={isFDM ? store.fdmSoft.enabled : store.resinSoft.enabled}
                onToggle={v => isFDM ? store.setFdmSoft({ ...store.fdmSoft, enabled: v }) : store.setResinSoft({ ...store.resinSoft, enabled: v })} />
            </div>
            {(isFDM ? store.fdmSoft.enabled : store.resinSoft.enabled) && (
              <div className="space-y-3">
                <InputGroup label={t('calc.slicerCost')}
                  value={isFDM ? store.fdmSoft.slicerMonthlyCost : store.resinSoft.slicerMonthlyCost}
                  onChange={v => handleInput(v, val => isFDM ? store.setFdmSoft({ ...store.fdmSoft, slicerMonthlyCost: val }) : store.setResinSoft({ ...store.resinSoft, slicerMonthlyCost: val }))} type="number" prefix={currencySymbol} />
                <InputGroup label={t('calc.modelCost')}
                  value={isFDM ? store.fdmSoft.modelFileCost : store.resinSoft.modelFileCost}
                  onChange={v => handleInput(v, val => isFDM ? store.setFdmSoft({ ...store.fdmSoft, modelFileCost: val }) : store.setResinSoft({ ...store.resinSoft, modelFileCost: val }))} type="number" prefix={currencySymbol} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderSalesSection() {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5">
        {renderSectionHeader(DollarSign, t('calc.sales'), t('calc.sectionDesc.sales'))}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputGroup label={t('calc.quantity')}
              value={store.quantity}
              onChange={v => handleInput(v, val => store.setQuantity(val > 0 ? val : 1))} type="number" unit="un" />
            <InputGroup label={t('calc.infillPercent')}
              value={store.infillPercent}
              onChange={v => handleInput(v, val => store.setInfillPercent(val))} type="number" unit="%" />
          </div>
          <InputGroup label={t('calc.extras')}
            value={isFDM ? store.fdmExtras.extrasCost : store.resinExtras.extrasCost}
            onChange={v => handleInput(v, val => isFDM ? store.setFdmExtras({ extrasCost: val }) : store.setResinExtras({ extrasCost: val }))} type="number" prefix={currencySymbol} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputGroup label={t('calc.packaging')}
              value={isFDM ? store.fdmSales.packagingCost : store.resinSales.packagingCost}
              onChange={v => handleInput(v, val => isFDM ? store.setFdmSales({ ...store.fdmSales, packagingCost: val }) : store.setResinSales({ ...store.resinSales, packagingCost: val }))} type="number" prefix={currencySymbol} />
            <InputGroup label={t('calc.shipping')}
              value={isFDM ? store.fdmSales.shippingCost : store.resinSales.shippingCost}
              onChange={v => handleInput(v, val => isFDM ? store.setFdmSales({ ...store.fdmSales, shippingCost: val }) : store.setResinSales({ ...store.resinSales, shippingCost: val }))} type="number" prefix={currencySymbol} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label={t('calc.marketplace')} value={store.selectedMarketplace.id}
              onChange={handleMarketplaceChange}
              options={catalogMarketplaces.map(m => ({ label: m.name, value: m.id, subtitle: `${m.feePercent}% + R$ ${m.feeFixed}` }))} />
            <InputGroup label={t('calc.taxPercent')}
              value={isFDM ? store.fdmSales.taxPercent : store.resinSales.taxPercent}
              onChange={v => handleInput(v, val => isFDM ? store.setFdmSales({ ...store.fdmSales, taxPercent: val }) : store.setResinSales({ ...store.resinSales, taxPercent: val }))} type="number" unit="%" />
          </div>
          <div className="glass rounded-xl p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-2">
              <span className="text-xs sm:text-sm text-gray-400">{t('calc.markupPresets')}</span>
              <div className="flex flex-wrap gap-1.5">
                {[100, 150, 200, 250, 300, 500].map(pct => (
                  <button key={pct}
                    onClick={() => isFDM
                      ? store.setFdmSales({ ...store.fdmSales, profitMarginPercent: pct })
                      : store.setResinSales({ ...store.resinSales, profitMarginPercent: pct })
                    }
                    className={`px-3 min-h-[44px] text-[11px] sm:text-xs rounded-md transition-all flex items-center ${
                      (isFDM ? store.fdmSales.profitMarginPercent : store.resinSales.profitMarginPercent) === pct
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <InputGroup label={t('calc.profitMargin')}
              value={isFDM ? store.fdmSales.profitMarginPercent : store.resinSales.profitMarginPercent}
              onChange={v => handleInput(v, val => isFDM ? store.setFdmSales({ ...store.fdmSales, profitMarginPercent: val }) : store.setResinSales({ ...store.resinSales, profitMarginPercent: val }))} type="number" unit="%" />
          </div>
        </div>
      </div>
    )
  }

  function renderRightSidebar() {
    return <ResultsPanel variant="sidebar" />
  }

  return (
    <>
      <ToastContainer items={toastItems} onDismiss={dismissToast} />
      <div className="flex gap-4 xl:gap-6 pb-20 lg:pb-0">
        {/* Desktop sidebar — icon + label + cost toggle dot */}
        <nav className="hidden lg:flex flex-col gap-0.5 w-[134px] xl:w-[142px] shrink-0 sticky top-6 h-fit">
          {SECTIONS.map(s => {
            const keys = SECTION_ENABLES[s.id] || []
            const anyEnabled = keys.length === 0 || keys.some(k => store.enabledSections[k])
            return (
              <div key={s.id} className="px-1">
                <button
                  onClick={() => {
                    setActiveSection(s.id)
                    document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`w-full py-2.5 px-2 rounded-xl flex items-center gap-2 transition-all text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                    activeSection === s.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : `text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent ${
                          keys.length > 0 && !anyEnabled ? 'opacity-50' : ''
                        }`
                  }`}
                  title={t(s.label)}>
                  <s.Icon className={`w-4 h-4 shrink-0 ${activeSection === s.id ? 'text-indigo-400' : ''}`} />
                  <span className="text-[11px] font-medium leading-tight">{t(s.shortKey)}</span>
                </button>
              </div>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* FDM / Resina tabs */}
          <div className="segmented-control">
            <button onClick={() => store.setActiveTab('fdm')}
              className={`segmented-btn focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${isFDM ? 'active-fdm' : ''}`}>
              <Printer className="w-4 h-4" />
              {t('calc.fdm')}
            </button>
            <button onClick={() => store.setActiveTab('resin')}
              className={`segmented-btn focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none ${!isFDM ? 'active-resin' : ''}`}>
              <FlaskConical className="w-4 h-4" />
              {t('calc.resin')}
            </button>
          </div>

          {/* Quick Mode */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('calc.quickMode')}</span>
            <button onClick={() => store.setQuickMode(!store.quickMode)}
              aria-pressed={store.quickMode}
              className={`relative w-9 h-4 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none shrink-0 ${store.quickMode ? 'bg-purple-600' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-md transition-all duration-200 ${store.quickMode ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Product Name */}
          <div className="glass rounded-2xl px-5 py-5">
            <InputGroup label={t('calc.productName')} value={store.productName}
              onChange={v => store.setProductName(v)}
              type="text" placeholder={t('calc.productNamePlaceholder')} />
          </div>

          {/* All sections */}
          <div className="space-y-4">
            <div id="section-material" className="scroll-mt-24">{renderMaterialSection()}</div>
            <div id="section-print" className="scroll-mt-24">{renderPrintSection()}</div>
            <div id="section-failure" className="scroll-mt-24">{renderFailureSection()}</div>
            <div id="section-hardware" className="scroll-mt-24">{renderHardwareSection()}</div>
            <div id="section-machine" className="scroll-mt-24">{renderMachineSection()}</div>
            <div id="section-fixedCost" className="scroll-mt-24">{renderFixedCostsSection()}</div>
            <div id="section-labor" className="scroll-mt-24">{renderLaborSection()}</div>
            <div id="section-ops" className="scroll-mt-24">{renderOpsSection()}</div>
            <div id="section-sales" className="scroll-mt-24">{renderSalesSection()}</div>
            <div id="section-results" className="scroll-mt-24 lg:hidden">
              <ResultsPanel variant="mobile" />
            </div>
          </div>
        </div>

        {/* Desktop right sidebar — always visible */}
        <div className="hidden lg:flex flex-col gap-4 w-[320px] xl:w-[360px] shrink-0">
          {renderRightSidebar()}
        </div>
      </div>

      {/* Mobile bottom bar — consolidated nav + results */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Results mini-bar */}
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-t border-white/[0.06]" style={{ background: 'rgba(6,8,24,0.92)', backdropFilter: 'blur(16px)' }}>
          <div className="flex gap-3 text-[11px]">
            <span className="text-slate-200"><span className="text-slate-500 mr-1">Custo</span>{fmtCurrency(results.totalCost)}</span>
            <span className="text-emerald-400 font-bold"><span className="text-slate-500 mr-1">Venda</span>{fmtCurrency(results.sellPrice)}</span>
            <span className="text-amber-400"><span className="text-slate-500 mr-1">Lucro</span>{fmtCurrency(results.profit)}</span>
          </div>

        </div>
        {/* Section nav */}
        <nav style={{ background: 'rgba(6,8,24,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex h-12 overflow-x-auto">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => {
                setActiveSection(s.id)
                document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[48px] min-h-[44px] text-[8px] font-semibold tracking-wide transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                  activeSection === s.id ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
                }`}>
                <s.Icon className={`w-[15px] h-[15px] transition-transform ${activeSection === s.id ? 'scale-110' : ''}`} />
                <span className="truncate max-w-[48px] leading-tight">{t(s.shortKey)}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </>
  )
}
