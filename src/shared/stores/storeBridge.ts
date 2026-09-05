import { useCalculatorStore } from '@/shared/stores/calculatorStore'
import { useCatalogStore } from '@/shared/stores/catalogStore'
import type { FilamentSpool } from '@/shared/stores/filamentInventory'
import type { Product } from '@/shared/types'
import type { PrinterProfile, Marketplace } from '@/shared/types'

export function selectSpool(spool: FilamentSpool) {
  const state = useCalculatorStore.getState()
  useCalculatorStore.getState().setFdmMaterial({
    ...state.fdmMaterial,
    type: spool.material,
    costPerKg: spool.costPerKg,
  })
}

export function selectProduct(product: Pick<Product, 'name'>) {
  useCalculatorStore.getState().setProductName(product.name)
}

export function restoreAutoSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('open3dcalc_settings_v2')
    if (!raw) return false
    const data = JSON.parse(raw)
    const calc = useCalculatorStore.getState()
    const catalogPrinters = useCatalogStore.getState().printers
    const catalogMarketplaces = useCatalogStore.getState().marketplaces
    const printer = catalogPrinters.find((p: { id: string }) => p.id === data.selectedPrinterId)
    const marketplace = catalogMarketplaces.find((m: { id: string }) => m.id === data.selectedMarketplaceId)

    useCalculatorStore.setState({
      activeTab: data.activeTab || 'fdm',
      fdmMaterial: data.fdmMaterial || calc.fdmMaterial,
      fdmPrintParams: data.fdmPrintParams || calc.fdmPrintParams,
      fdmAmsEnabled: data.fdmAmsEnabled ?? false,
      fdmAmsSlots: data.fdmAmsSlots || calc.fdmAmsSlots,
      fdmMachine: data.fdmMachine || calc.fdmMachine,
      fdmHardware: data.fdmHardware || calc.fdmHardware,
      fdmFinishing: data.fdmFinishing || calc.fdmFinishing,
      fdmLabor: data.fdmLabor || calc.fdmLabor,
      fdmExtras: data.fdmExtras || calc.fdmExtras,
      fdmSales: data.fdmSales || calc.fdmSales,
      fdmOps: data.fdmOps || calc.fdmOps,
      fdmSoft: data.fdmSoft || calc.fdmSoft,
      resinMaterial: data.resinMaterial || calc.resinMaterial,
      resinPrintParams: data.resinPrintParams || calc.resinPrintParams,
      resinPostProcess: data.resinPostProcess || calc.resinPostProcess,
      resinMachine: data.resinMachine || calc.resinMachine,
      resinHardware: data.resinHardware || calc.resinHardware,
      resinLabor: data.resinLabor || calc.resinLabor,
      resinExtras: data.resinExtras || calc.resinExtras,
      resinSales: data.resinSales || calc.resinSales,
      resinOps: data.resinOps || calc.resinOps,
      resinSoft: data.resinSoft || calc.resinSoft,
      productName: data.productName || calc.productName,
      quantity: data.quantity ?? calc.quantity,
      infillPercent: data.infillPercent ?? calc.infillPercent,
      targetMarginMode: data.targetMarginMode ?? calc.targetMarginMode,
      enabledSections: data.enabledSections || calc.enabledSections,
      selectedPrinter: (printer || catalogPrinters[0]) as unknown as PrinterProfile,
      selectedMarketplace: (marketplace || catalogMarketplaces[0]) as unknown as Marketplace,
    })
    return true
  } catch {
    return false
  }
}
