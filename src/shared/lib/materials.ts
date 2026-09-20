import type { Material, MaterialType } from '@/shared/types'

export const fdmMaterials: Material[] = [
  { id: 'pla' as MaterialType, name: 'PLA', density: 1.24, avgPrice: 90, type: 'fdm' },
  { id: 'pla_silk' as MaterialType, name: 'PLA Silk', density: 1.24, avgPrice: 120, type: 'fdm' },
  { id: 'pla_plus' as MaterialType, name: 'PLA+', density: 1.26, avgPrice: 100, type: 'fdm' },
  { id: 'petg' as MaterialType, name: 'PETG', density: 1.27, avgPrice: 110, type: 'fdm' },
  { id: 'abs' as MaterialType, name: 'ABS', density: 1.04, avgPrice: 100, type: 'fdm' },
  { id: 'asa' as MaterialType, name: 'ASA', density: 1.05, avgPrice: 140, type: 'fdm' },
  { id: 'tpu_85a' as MaterialType, name: 'TPU 85A', density: 1.20, avgPrice: 130, type: 'fdm' },
  { id: 'tpu_95a' as MaterialType, name: 'TPU 95A', density: 1.22, avgPrice: 120, type: 'fdm' },
  { id: 'nylon_pa6' as MaterialType, name: 'Nylon PA6', density: 1.14, avgPrice: 140, type: 'fdm' },
  { id: 'nylon_pa12' as MaterialType, name: 'Nylon PA12', density: 1.01, avgPrice: 160, type: 'fdm' },
  { id: 'pc' as MaterialType, name: 'Policarbonato (PC)', density: 1.20, avgPrice: 180, type: 'fdm' },
  { id: 'pc_abs' as MaterialType, name: 'PC/ABS', density: 1.15, avgPrice: 160, type: 'fdm' },
  { id: 'pla_cf' as MaterialType, name: 'PLA + Fibra de Carbono', density: 1.30, avgPrice: 160, type: 'fdm' },
  { id: 'petg_cf' as MaterialType, name: 'PETG + Fibra de Carbono', density: 1.28, avgPrice: 180, type: 'fdm' },
  { id: 'nylon_cf' as MaterialType, name: 'Nylon + Fibra de Carbono', density: 1.10, avgPrice: 250, type: 'fdm' },
  { id: 'pla_wood' as MaterialType, name: 'PLA + Madeira', density: 1.20, avgPrice: 130, type: 'fdm' },
  { id: 'pla_metal' as MaterialType, name: 'PLA + Metal', density: 1.80, avgPrice: 200, type: 'fdm' },
  { id: 'hips' as MaterialType, name: 'HIPS', density: 1.03, avgPrice: 130, type: 'fdm' },
  { id: 'pva' as MaterialType, name: 'PVA', density: 1.23, avgPrice: 200, type: 'fdm' },
  { id: 'pp' as MaterialType, name: 'Polipropileno (PP)', density: 0.90, avgPrice: 150, type: 'fdm' },
  { id: 'peek' as MaterialType, name: 'PEEK', density: 1.32, avgPrice: 1000, type: 'fdm' },
  { id: 'peek_cf' as MaterialType, name: 'PEEK + CF', density: 1.40, avgPrice: 1200, type: 'fdm' },
  { id: 'ultem' as MaterialType, name: 'PEI / ULTEM', density: 1.27, avgPrice: 1500, type: 'fdm' },
]

export const resinMaterials: Material[] = [
  { id: 'standard' as unknown as MaterialType, name: 'Resina Standard', density: 1.10, avgPrice: 180, type: 'resin' },
  { id: 'abs_like' as unknown as MaterialType, name: 'Resina ABS-Like', density: 1.15, avgPrice: 200, type: 'resin' },
  { id: 'water_washable' as unknown as MaterialType, name: 'Resina Water Washable', density: 1.10, avgPrice: 220, type: 'resin' },
  { id: 'tough' as unknown as MaterialType, name: 'Resina Tough', density: 1.12, avgPrice: 250, type: 'resin' },
  { id: 'flexible' as unknown as MaterialType, name: 'Resina Flexible', density: 1.08, avgPrice: 280, type: 'resin' },
  { id: 'clear' as unknown as MaterialType, name: 'Resina Transparente', density: 1.10, avgPrice: 200, type: 'resin' },
  { id: 'dental' as unknown as MaterialType, name: 'Resina Odontológica', density: 1.15, avgPrice: 500, type: 'resin' },
  { id: 'castable' as unknown as MaterialType, name: 'Resina Fundível', density: 1.05, avgPrice: 350, type: 'resin' },
]

export const materials: Material[] = [...fdmMaterials, ...resinMaterials]

