import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Scale, DollarSign, Box, Sliders } from "lucide-react";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import { calculateInfillImpact } from "@/shared/lib/calculator";
import { useCurrency } from "@/shared/hooks/useCurrency";

const MATERIALS = [
  { label: "PLA", value: "pla", density: 1.24, costPerKg: 125 },
  { label: "PETG", value: "petg", density: 1.27, costPerKg: 140 },
  { label: "ABS", value: "abs", density: 1.04, costPerKg: 110 },
  { label: "TPU", value: "tpu", density: 1.21, costPerKg: 180 },
  { label: "Nylon", value: "nylon", density: 1.14, costPerKg: 250 },
  { label: "PLA-CF", value: "pla_cf", density: 1.3, costPerKg: 200 },
];

export function InfillCalculator() {
  const { t } = useTranslation();
  const { format: fmtCurrency } = useCurrency();
  const [width, setWidth] = useState("50");
  const [depth, setDepth] = useState("50");
  const [height, setHeight] = useState("30");
  const [wallThickness, setWallThickness] = useState("1.2");
  const [topBottomLayers, setTopBottomLayers] = useState("4");
  const [layerHeight, setLayerHeight] = useState("0.2");
  const [material, setMaterial] = useState("pla");
  const [infillPercent, setInfillPercent] = useState("20");

  const mat = MATERIALS.find((m) => m.value === material) || MATERIALS[0];

  const boundingBoxCm3 =
    (parseFloat(width) * parseFloat(depth) * parseFloat(height)) / 1000;
  const wallVolumeCm3 =
    (2 *
      (parseFloat(width) + parseFloat(depth)) *
      parseFloat(height) *
      parseFloat(wallThickness)) /
    1000;
  const topBottomVolumeCm3 =
    (parseFloat(width) *
      parseFloat(depth) *
      parseFloat(topBottomLayers) *
      parseFloat(layerHeight) *
      2) /
    1000;
  const solidVolumeCm3 = wallVolumeCm3 + topBottomVolumeCm3;

  const result = calculateInfillImpact(
    solidVolumeCm3,
    boundingBoxCm3,
    parseFloat(infillPercent) || 0,
    mat.density,
    mat.costPerKg,
  );

  const comparisons = [10, 15, 20, 30, 50, 80, 100].map((pct) => {
    const r = calculateInfillImpact(
      solidVolumeCm3,
      boundingBoxCm3,
      pct,
      mat.density,
      mat.costPerKg,
    );
    return { infill: pct, weight: r.weight, cost: r.cost };
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-accent-subtle flex items-center justify-center text-accent shrink-0 border border-accent/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              {t("infillCalculator.title")}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              {t("infillCalculator.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-sunken border border-border-subtle text-xs font-semibold text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {mat.label} • {infillPercent}% infill
          </span>
        </div>
      </div>

      {/* Bento KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Estimated Weight */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all hover:border-border">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">
              {t("infillCalculator.estimatedWeight")}
            </span>
            <Scale className="w-4 h-4 text-info" />
          </div>
          <div className="my-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {result.weight.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-text-secondary ml-1">g</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {infillPercent}% • {mat.label}
          </div>
        </div>

        {/* Material Cost */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all hover:border-border">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">
              {t("infillCalculator.materialCost")}
            </span>
            <DollarSign className="w-4 h-4 text-positive" />
          </div>
          <div className="my-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-positive tracking-tight">
              {fmtCurrency(result.cost)}
            </span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {mat.label} ({fmtCurrency(mat.costPerKg)}/kg)
          </div>
        </div>

        {/* Solid Volume */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all hover:border-border">
          <div className="flex items-center justify-between text-text-secondary mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">
              {t("infillCalculator.solidVolume")}
            </span>
            <Box className="w-4 h-4 text-accent" />
          </div>
          <div className="my-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-accent tracking-tight">
              {solidVolumeCm3.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-text-secondary ml-1">cm³</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {boundingBoxCm3.toFixed(1)} cm³ bbox
          </div>
        </div>
      </div>

      {/* Main Content Grid: Parameters (5) and Comparison Table (7) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Parameters Column */}
        <div className="lg:col-span-5 bg-surface-raised border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              <h3 className="text-sm sm:text-[15px] font-bold text-text-primary">
                {t("infillCalculator.dimensions")}
              </h3>
            </div>
            <span className="text-[10px] font-mono uppercase text-text-muted">
              XYZ + Config
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputGroup
              label={t("infillCalculator.width")}
              value={width}
              onChange={(v) => setWidth(v)}
              type="number"
              unit="mm"
            />
            <InputGroup
              label={t("infillCalculator.depth")}
              value={depth}
              onChange={(v) => setDepth(v)}
              type="number"
              unit="mm"
            />
            <InputGroup
              label={t("infillCalculator.height")}
              value={height}
              onChange={(v) => setHeight(v)}
              type="number"
              unit="mm"
              className="col-span-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputGroup
              label={t("infillCalculator.wallThickness")}
              value={wallThickness}
              onChange={(v) => setWallThickness(v)}
              type="number"
              unit="mm"
            />
            <InputGroup
              label={t("infillCalculator.topBottomLayers")}
              value={topBottomLayers}
              onChange={(v) => setTopBottomLayers(v)}
              type="number"
              unit="un"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputGroup
              label={t("infillCalculator.layerHeight")}
              value={layerHeight}
              onChange={(v) => setLayerHeight(v)}
              type="number"
              unit="mm"
            />
            <Select
              label={t("infillCalculator.material")}
              value={material}
              onChange={setMaterial}
              options={MATERIALS.map((m) => ({
                label: m.label,
                value: m.value,
              }))}
              search={false}
            />
          </div>

          <div className="pt-2 border-t border-border-subtle space-y-3">
            <InputGroup
              label={t("infillCalculator.infillPercent")}
              value={infillPercent}
              onChange={(v) => setInfillPercent(v)}
              type="number"
              unit="%"
            />

            {/* Quick Presets Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[10, 15, 20, 30, 50, 80, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setInfillPercent(String(pct))}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                    parseFloat(infillPercent) === pct
                      ? "bg-accent text-[var(--color-accent-fill-fg)] font-bold shadow-xs"
                      : "bg-surface-sunken hover:bg-surface-canvas border border-border-subtle text-text-secondary"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Table Column */}
        <div className="lg:col-span-7 bg-surface-raised border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-sm min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <h3 className="text-sm sm:text-[15px] font-bold text-text-primary">
                {t("infillCalculator.comparison")}
              </h3>
              <span className="text-[11px] font-mono text-text-muted bg-surface-sunken px-2.5 py-1 rounded-md border border-border-subtle">
                {comparisons.length}x
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-subtle">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-text-muted font-mono uppercase text-[11px] bg-surface-sunken/60 border-b border-border-subtle">
                    <th className="text-left py-2.5 px-3.5">
                      {t("infillCalculator.colInfill")}
                    </th>
                    <th className="text-right py-2.5 px-3.5">
                      {t("infillCalculator.colWeight")}
                    </th>
                    <th className="text-right py-2.5 px-3.5">
                      {t("infillCalculator.colCost")}
                    </th>
                    <th className="text-right py-2.5 px-3.5">
                      {t("infillCalculator.colDifference")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {comparisons.map((c) => {
                    const diff = c.cost - comparisons[0].cost;
                    const isSelected = c.infill === parseFloat(infillPercent);
                    return (
                      <tr
                        key={c.infill}
                        onClick={() => setInfillPercent(String(c.infill))}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-accent-subtle/80 font-bold border-l-2 border-accent"
                            : "hover:bg-surface-sunken/40"
                        }`}
                      >
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                              isSelected
                                ? "bg-accent text-[var(--color-accent-fill-fg)]"
                                : "bg-surface-sunken text-text-primary"
                            }`}
                          >
                            {c.infill}%
                          </span>
                        </td>
                        <td className="text-right py-2.5 px-3.5 font-mono">
                          {c.weight.toFixed(1)}g
                        </td>
                        <td className="text-right py-2.5 px-3.5 font-mono">
                          {fmtCurrency(c.cost)}
                        </td>
                        <td
                          className={`text-right py-2.5 px-3.5 font-mono ${
                            diff > 0 ? "text-warning" : "text-text-muted"
                          }`}
                        >
                          {diff > 0 ? `+${fmtCurrency(diff)}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
            <span>{mat.label} ({mat.density} g/cm³)</span>
            <span>10% = ref</span>
          </div>
        </div>
      </div>
    </div>
  );
}
