import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InputGroup } from '@/components/ui/InputGroup'
import { Select } from '@/components/ui/Select'
import { calculateInfillImpact } from '@/lib/calculator'
import { useCurrency } from '@/hooks/useCurrency'

const MATERIALS = [
  { label: 'PLA', value: 'pla', density: 1.24, costPerKg: 125 },
  { label: 'PETG', value: 'petg', density: 1.27, costPerKg: 140 },
  { label: 'ABS', value: 'abs', density: 1.04, costPerKg: 110 },
  { label: 'TPU', value: 'tpu', density: 1.21, costPerKg: 180 },
  { label: 'Nylon', value: 'nylon', density: 1.14, costPerKg: 250 },
  { label: 'PLA-CF', value: 'pla_cf', density: 1.30, costPerKg: 200 },
]

export function InfillCalculator() {
  const { t } = useTranslation()
  const { format: fmtCurrency } = useCurrency()
  const [width, setWidth] = useState('50')
  const [depth, setDepth] = useState('50')
  const [height, setHeight] = useState('30')
  const [wallThickness, setWallThickness] = useState('1.2')
  const [topBottomLayers, setTopBottomLayers] = useState('4')
  const [layerHeight, setLayerHeight] = useState('0.2')
  const [material, setMaterial] = useState('pla')
  const [infillPercent, setInfillPercent] = useState('20')

  const mat = MATERIALS.find(m => m.value === material) || MATERIALS[0]

  const boundingBoxCm3 = (parseFloat(width) * parseFloat(depth) * parseFloat(height)) / 1000
  const wallVolumeCm3 = (2 * (parseFloat(width) + parseFloat(depth)) * parseFloat(height) * parseFloat(wallThickness)) / 1000
  const topBottomVolumeCm3 = (parseFloat(width) * parseFloat(depth) * parseFloat(topBottomLayers) * parseFloat(layerHeight) * 2) / 1000
  const solidVolumeCm3 = wallVolumeCm3 + topBottomVolumeCm3

  const result = calculateInfillImpact(
    solidVolumeCm3,
    boundingBoxCm3,
    parseFloat(infillPercent) || 0,
    mat.density,
    mat.costPerKg,
  )

  const comparisons = [10, 15, 20, 30, 50, 80, 100].map(pct => {
    const r = calculateInfillImpact(solidVolumeCm3, boundingBoxCm3, pct, mat.density, mat.costPerKg)
    return { infill: pct, weight: r.weight, cost: r.cost }
  })

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="glass rounded-2xl p-6 sm:p-7">
        <h2 className="text-lg sm:text-xl font-bold text-white">{t('calc.infillPercent')} Calculator</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Veja como o % de infill afeta peso, custo e tempo</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <div className="glass rounded-2xl p-6 sm:p-7 space-y-4">
          <div className="text-sm sm:text-[15px] font-semibold text-white">Dimensões (mm)</div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <InputGroup label="Largura" value={width} onChange={v => setWidth(v)} type="number" unit="mm" />
            <InputGroup label="Profundidade" value={depth} onChange={v => setDepth(v)} type="number" unit="mm" />
            <InputGroup label="Altura" value={height} onChange={v => setHeight(v)} type="number" unit="mm" className="col-span-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <InputGroup label="Espessura Parede" value={wallThickness} onChange={v => setWallThickness(v)} type="number" unit="mm" />
            <InputGroup label="Camadas Topo/Base" value={topBottomLayers} onChange={v => setTopBottomLayers(v)} type="number" unit="un" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <InputGroup label="Layer Height" value={layerHeight} onChange={v => setLayerHeight(v)} type="number" unit="mm" />
            <Select label="Material" value={material} onChange={setMaterial}
              options={MATERIALS.map(m => ({ label: m.label, value: m.value }))} search={false} />
          </div>
          <InputGroup label="Infill %" value={infillPercent} onChange={v => setInfillPercent(v)} type="number" unit="%" />
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Result Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="glass rounded-2xl p-4 sm:p-5 text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 mb-1">Peso Estimado</p>
              <p className="text-lg sm:text-xl font-bold text-cyan-400">{result.weight.toFixed(1)}g</p>
            </div>
            <div className="glass rounded-2xl p-4 sm:p-5 text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 mb-1">Custo Material</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-400">{fmtCurrency(result.cost)}</p>
            </div>
            <div className="glass rounded-2xl p-4 sm:p-5 text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 mb-1">Volume Sólido</p>
              <p className="text-lg sm:text-xl font-bold text-purple-400">{(solidVolumeCm3).toFixed(1)} cm³</p>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="glass rounded-2xl p-6 sm:p-7">
            <h3 className="text-sm sm:text-[15px] font-bold text-white mb-3">Comparação de Infill</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="text-left py-2 px-3">Infill</th>
                    <th className="text-right py-2 px-3">Peso</th>
                    <th className="text-right py-2 px-3">Custo</th>
                    <th className="text-right py-2 px-3">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(c => {
                    const diff = c.cost - comparisons[0].cost
                    return (
                      <tr key={c.infill} className={`border-b border-white/5 ${c.infill === parseFloat(infillPercent) ? 'bg-purple-600/10' : ''}`}>
                        <td className="py-2 px-3 font-semibold">{c.infill}%</td>
                        <td className="text-right py-2 px-3">{c.weight.toFixed(1)}g</td>
                        <td className="text-right py-2 px-3">{fmtCurrency(c.cost)}</td>
                        <td className={`text-right py-2 px-3 ${diff > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {diff > 0 ? `+${fmtCurrency(diff)}` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
