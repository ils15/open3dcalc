/**
 * Shareable calculation link via URL hash.
 *
 * Serializes calculator state into a compact base64-encoded JSON fragment
 * in the URL hash (`#calc=...`), and restores it on page load.
 *
 * Format: only calculation-relevant fields (no UI state like scroll position,
 * active tab in UI, etc.) to keep URLs compact.
 *
 * Versioning (payload.v) ensures forward compatibility.
 */

import type {
  MaterialStateFDM,
  MaterialStateResin,
  PrintParameters,
  MachineCosts,
  LaborCosts,
  AdditionalCosts,
  SalesParameters,
  OperationalCosts,
  SoftwareCosts,
  FDMHardware,
  FDMFinishing,
  PostProcessingResin,
  ResinHardware,
  AMSSlot,
  FixedCosts,
} from '@/shared/types'

// ---------------------------------------------------------------------------
// Payload shape (short keys for compact encoding)
// ---------------------------------------------------------------------------

interface CalculationPayload {
  v: 1
  /** Active tab */
  t: 'fdm' | 'resin'

  // --- FDM sections ---
  fm?: MaterialStateFDM
  fp?: PrintParameters
  fc?: MachineCosts
  fh?: FDMHardware
  ff?: FDMFinishing
  fl?: LaborCosts
  fe?: AdditionalCosts
  fs?: SalesParameters
  fo?: OperationalCosts
  fw?: SoftwareCosts

  // --- Resin sections ---
  rm?: MaterialStateResin
  rp?: PrintParameters
  rc?: MachineCosts
  rh?: ResinHardware
  rr?: PostProcessingResin
  rl?: LaborCosts
  re?: AdditionalCosts
  rs?: SalesParameters
  ro?: OperationalCosts
  rw?: SoftwareCosts

  // --- Printer / Marketplace (by ID) ---
  pi?: string
  mi?: string

  // --- AMS ---
  ae?: boolean
  as?: AMSSlot[]

  // --- General ---
  fk?: FixedCosts
  pn?: string
  q?: number
  ip?: number
  tm?: boolean
  es?: Record<string, boolean>
}

// ---------------------------------------------------------------------------
// Result shape returned after decoding
// ---------------------------------------------------------------------------

export interface SharedCalculationState {
  activeTab: 'fdm' | 'resin'
  fdmMaterial?: MaterialStateFDM
  fdmPrintParams?: PrintParameters
  fdmMachine?: MachineCosts
  fdmHardware?: FDMHardware
  fdmFinishing?: FDMFinishing
  fdmLabor?: LaborCosts
  fdmExtras?: AdditionalCosts
  fdmSales?: SalesParameters
  fdmOps?: OperationalCosts
  fdmSoft?: SoftwareCosts
  resinMaterial?: MaterialStateResin
  resinPrintParams?: PrintParameters
  resinMachine?: MachineCosts
  resinHardware?: ResinHardware
  resinPostProcess?: PostProcessingResin
  resinLabor?: LaborCosts
  resinExtras?: AdditionalCosts
  resinSales?: SalesParameters
  resinOps?: OperationalCosts
  resinSoft?: SoftwareCosts
  selectedPrinterId?: string
  selectedMarketplaceId?: string
  fdmAmsEnabled?: boolean
  fdmAmsSlots?: AMSSlot[]
  fixedCosts?: FixedCosts
  productName?: string
  quantity?: number
  infillPercent?: number
  targetMarginMode?: boolean
  enabledSections?: Record<string, boolean>
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/**
 * Serializes calculator state into a URL-safe base64 string.
 */
export function encodeCalculationState(
  state: SharedCalculationState,
): string {
  const payload: CalculationPayload = {
    v: 1,
    t: state.activeTab,
  }

  // FDM
  if (state.fdmMaterial) payload.fm = state.fdmMaterial
  if (state.fdmPrintParams) payload.fp = state.fdmPrintParams
  if (state.fdmMachine) payload.fc = state.fdmMachine
  if (state.fdmHardware) payload.fh = state.fdmHardware
  if (state.fdmFinishing) payload.ff = state.fdmFinishing
  if (state.fdmLabor) payload.fl = state.fdmLabor
  if (state.fdmExtras) payload.fe = state.fdmExtras
  if (state.fdmSales) payload.fs = state.fdmSales
  if (state.fdmOps) payload.fo = state.fdmOps
  if (state.fdmSoft) payload.fw = state.fdmSoft

  // Resin
  if (state.resinMaterial) payload.rm = state.resinMaterial
  if (state.resinPrintParams) payload.rp = state.resinPrintParams
  if (state.resinMachine) payload.rc = state.resinMachine
  if (state.resinHardware) payload.rh = state.resinHardware
  if (state.resinPostProcess) payload.rr = state.resinPostProcess
  if (state.resinLabor) payload.rl = state.resinLabor
  if (state.resinExtras) payload.re = state.resinExtras
  if (state.resinSales) payload.rs = state.resinSales
  if (state.resinOps) payload.ro = state.resinOps
  if (state.resinSoft) payload.rw = state.resinSoft

  // Printer / Marketplace
  if (state.selectedPrinterId) payload.pi = state.selectedPrinterId
  if (state.selectedMarketplaceId) payload.mi = state.selectedMarketplaceId

  // AMS
  if (state.fdmAmsEnabled !== undefined) payload.ae = state.fdmAmsEnabled
  if (state.fdmAmsSlots) payload.as = state.fdmAmsSlots

  // General
  if (state.fixedCosts) payload.fk = state.fixedCosts
  if (state.productName) payload.pn = state.productName
  if (state.quantity !== undefined) payload.q = state.quantity
  if (state.infillPercent !== undefined) payload.ip = state.infillPercent
  if (state.targetMarginMode !== undefined) payload.tm = state.targetMarginMode
  if (state.enabledSections) payload.es = state.enabledSections

  const json = JSON.stringify(payload)
  // Use btoa + encodeURIComponent for safe URL transport.
  // encodeURIComponent ensures the JSON string is ASCII-safe first,
  // then btoa produces a base64 string that's URL-safe when placed in a hash.
  return btoa(encodeURIComponent(json))
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Deserializes a base64-encoded hash back to calculator state.
 * Returns null if the payload is invalid or uses an incompatible version.
 */
export function decodeCalculationState(
  hash: string,
): SharedCalculationState | null {
  try {
    const json = decodeURIComponent(atob(hash))
    const payload: CalculationPayload = JSON.parse(json)

    if (payload.v !== 1) return null

    const state: SharedCalculationState = {
      activeTab: payload.t,
    }

    // FDM
    if (payload.fm) state.fdmMaterial = payload.fm
    if (payload.fp) state.fdmPrintParams = payload.fp
    if (payload.fc) state.fdmMachine = payload.fc
    if (payload.fh) state.fdmHardware = payload.fh
    if (payload.ff) state.fdmFinishing = payload.ff
    if (payload.fl) state.fdmLabor = payload.fl
    if (payload.fe) state.fdmExtras = payload.fe
    if (payload.fs) state.fdmSales = payload.fs
    if (payload.fo) state.fdmOps = payload.fo
    if (payload.fw) state.fdmSoft = payload.fw

    // Resin
    if (payload.rm) state.resinMaterial = payload.rm
    if (payload.rp) state.resinPrintParams = payload.rp
    if (payload.rc) state.resinMachine = payload.rc
    if (payload.rh) state.resinHardware = payload.rh
    if (payload.rr) state.resinPostProcess = payload.rr
    if (payload.rl) state.resinLabor = payload.rl
    if (payload.re) state.resinExtras = payload.re
    if (payload.rs) state.resinSales = payload.rs
    if (payload.ro) state.resinOps = payload.ro
    if (payload.rw) state.resinSoft = payload.rw

    // Printer / Marketplace
    if (payload.pi) state.selectedPrinterId = payload.pi
    if (payload.mi) state.selectedMarketplaceId = payload.mi

    // AMS
    if (payload.ae !== undefined) state.fdmAmsEnabled = payload.ae
    if (payload.as) state.fdmAmsSlots = payload.as

    // General
    if (payload.fk) state.fixedCosts = payload.fk
    if (payload.pn) state.productName = payload.pn
    if (payload.q !== undefined) state.quantity = payload.q
    if (payload.ip !== undefined) state.infillPercent = payload.ip
    if (payload.tm !== undefined) state.targetMarginMode = payload.tm
    if (payload.es) state.enabledSections = payload.es

    return state
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const HASH_PREFIX = '#calc='

/**
 * Checks if the current URL has a shared calculation hash.
 */
export function hasSharedCalculation(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.hash.startsWith(HASH_PREFIX)
  )
}

/**
 * Gets the shared calculation data from the URL hash.
 */
export function getSharedCalculation(): SharedCalculationState | null {
  if (!hasSharedCalculation()) return null
  const hash = window.location.hash.replace(HASH_PREFIX, '')
  return decodeCalculationState(hash)
}

/**
 * Generates a shareable URL with the current calculation state.
 */
export function generateShareUrl(state: SharedCalculationState): string {
  const encoded = encodeCalculationState(state)
  const url = new URL(window.location.href)
  url.hash = `${HASH_PREFIX}${encoded}`
  return url.toString()
}
