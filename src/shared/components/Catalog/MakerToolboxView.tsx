import { useMemo, useState, type ReactElement } from "react";
import { Check, Gauge, Ruler, Scale, Wrench } from "lucide-react";
import {
  BRAND_TARE_GRAMS,
  BRAND_TARE_SOURCE_NOTE,
  lookupBrandTare,
} from "@/shared/lib/brandTare";
import {
  DEFAULT_SPOOL_DIAMETER_MM,
  metersFromGrams,
  remainingNetGrams,
} from "@/shared/lib/filamentRemaining";
import { resolveFilamentDensity } from "@/shared/lib/filamentProfiles";
import {
  computeRecommendedHoleDiameter,
  computeVolumetricFlow,
  HEAT_SET_INSERTS,
  MATERIAL_TOLERANCE_PROFILES,
  type FitType,
  type ToolboxMaterial,
} from "@/shared/lib/holeTolerance";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";

const MATERIALS: readonly ToolboxMaterial[] = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
];

const FIT_LABELS: Record<FitType, { label: string; desc: string }> = {
  clearance_loose: {
    label: "Folga Deslizante",
    desc: "Parafusos livres e eixos móveis",
  },
  snug_fit: {
    label: "Encaixe Firme",
    desc: "Pinos alinhadores sem jogo excessivo",
  },
  press_fit: {
    label: "Press-Fit (Interferência)",
    desc: "Encaixe travado sob pressão",
  },
};

const HOTEND_TIER_LABEL = {
  standard_ptfe: {
    name: "Hotend PTFE Padrão (≤ 12 mm³/s)",
    tone: "text-positive bg-positive-subtle border-positive/30",
  },
  all_metal: {
    name: "All-Metal (12–18 mm³/s)",
    tone: "text-info bg-accent-subtle border-accent/30",
  },
  high_flow: {
    name: "High-Flow / Bambu / K1 (18–28 mm³/s)",
    tone: "text-warning bg-warning-subtle border-warning/30",
  },
  ultra_high_flow: {
    name: "Ultra High-Flow (> 28 mm³/s — risco de subextrusão)",
    tone: "text-critical bg-critical-subtle border-critical/30",
  },
} as const;

export function MakerToolboxView(): ReactElement {
  // 1. Hole Tolerance & Heat-Set Inserts
  const [material, setMaterial] = useState<ToolboxMaterial>("PLA");
  const [fitType, setFitType] = useState<FitType>("snug_fit");
  const [nominalDiameterMm, setNominalDiameterMm] = useState<number>(4);

  const holeResult = useMemo(
    () => computeRecommendedHoleDiameter(nominalDiameterMm, material, fitType),
    [nominalDiameterMm, material, fitType],
  );

  // 2. Kitchen Scale Spool Checker
  const spools = useFilamentInventory((s) => s.spools ?? []);
  const updateSpool = useFilamentInventory((s) => s.updateSpool);
  const [selectedSpoolId, setSelectedSpoolId] = useState<string>("");
  const [brandInput, setBrandInput] = useState<string>("Bambu Lab");
  const [manualTareGrams, setManualTareGrams] = useState<number>(250);
  const [grossScaleGrams, setGrossScaleGrams] = useState<number>(680);
  const [spoolMaterial, setSpoolMaterial] = useState<string>("PLA");
  const [spoolUpdatedId, setSpoolUpdatedId] = useState<string | null>(null);

  const selectedSpool = useMemo(
    () => spools.find((s) => s.id === selectedSpoolId) ?? null,
    [spools, selectedSpoolId],
  );

  const effectiveTare = useMemo(() => {
    const brandTare = selectedSpool
      ? lookupBrandTare(selectedSpool.brand)
      : lookupBrandTare(brandInput);
    return brandTare > 0 ? brandTare : manualTareGrams;
  }, [selectedSpool, brandInput, manualTareGrams]);

  const activeMaterialForScale = selectedSpool?.material ?? spoolMaterial;
  const netRemainingGrams = useMemo(
    () =>
      remainingNetGrams(
        {
          brand: selectedSpool?.brand ?? brandInput,
          material: activeMaterialForScale,
          weightGrams: grossScaleGrams,
        },
        effectiveTare,
      ),
    [selectedSpool?.brand, brandInput, activeMaterialForScale, grossScaleGrams, effectiveTare],
  );
  const remainingMetersEstimate = useMemo(
    () =>
      metersFromGrams(
        netRemainingGrams,
        resolveFilamentDensity(activeMaterialForScale),
        selectedSpool?.diameterMm ?? DEFAULT_SPOOL_DIAMETER_MM,
      ),
    [netRemainingGrams, activeMaterialForScale, selectedSpool?.diameterMm],
  );

  const handleUpdateStockFromScale = () => {
    if (!selectedSpool) return;
    updateSpool(selectedSpool.id, {
      weightGrams: Number(netRemainingGrams.toFixed(1)),
    });
    setSpoolUpdatedId(selectedSpool.id);
    setTimeout(() => setSpoolUpdatedId(null), 2200);
  };

  // 3. Volumetric Flow Rate Calculator
  const [layerHeightMm, setLayerHeightMm] = useState<number>(0.2);
  const [lineWidthMm, setLineWidthMm] = useState<number>(0.42);
  const [printSpeedMmS, setPrintSpeedMmS] = useState<number>(180);

  const flowResult = useMemo(
    () => computeVolumetricFlow(layerHeightMm, lineWidthMm, printSpeedMmS),
    [layerHeightMm, lineWidthMm, printSpeedMmS],
  );
  const tierMeta = HOTEND_TIER_LABEL[flowResult.tier];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Wrench className="w-5 h-5 text-accent" aria-hidden="true" />
          <h2 className="text-base font-bold text-text-primary">
            Ferramentas de Bancada (Maker Toolbox)
          </h2>
        </div>
        <p className="text-xs text-text-secondary">
          Utilitários práticos de engenharia e oficina 3D integrados ao seu
          estoque e parâmetros de impressão.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Tool 1: Hole Tolerance & Heat-Set Inserts */}
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-info" aria-hidden="true" />
            <h3 className="text-sm font-bold text-text-primary">
              Folga de Furos, Pinos & Insertos Térmicos
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MATERIALS.map((mat) => (
              <button
                key={mat}
                type="button"
                onClick={() => setMaterial(mat)}
                className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border transition-colors ${
                  material === mat
                    ? "border-accent bg-accent-subtle text-accent"
                    : "border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary"
                }`}
              >
                {mat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Diâmetro Nominal (mm)
              </span>
              <input
                type="number"
                step="0.1"
                min={0.5}
                value={nominalDiameterMm}
                onChange={(e) =>
                  setNominalDiameterMm(Number(e.target.value) || 0.5)
                }
                className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Tipo de Encaixe
              </span>
              <select
                value={fitType}
                onChange={(e) => setFitType(e.target.value as FitType)}
                className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent"
              >
                {(Object.keys(FIT_LABELS) as FitType[]).map((key) => (
                  <option key={key} value={key}>
                    {FIT_LABELS[key].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-accent/30 bg-accent-subtle p-3.5 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-text-muted block">
                Modelar no CAD ({FIT_LABELS[fitType].desc})
              </span>
              <span className="text-xl font-extrabold font-mono text-accent">
                Ø {holeResult.cadHoleMm.toFixed(2)} mm
              </span>
            </div>
            <div className="text-right font-mono text-xs text-text-secondary">
              <div>
                Compensação:{" "}
                <strong className="text-text-primary">
                  {holeResult.offsetMm >= 0 ? "+" : ""}
                  {holeResult.offsetMm.toFixed(2)} mm
                </strong>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {MATERIAL_TOLERANCE_PROFILES[material].shrinkageNote}
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-text-muted font-bold block mb-2">
              Tabela Rápida — Insertos Térmicos de Latão (Heat-Set)
            </span>
            <div className="overflow-x-auto rounded-xl border border-border-subtle">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-sunken border-b border-border-subtle font-mono text-[10px] uppercase text-text-muted">
                    <th className="py-2 px-3">Rosca</th>
                    <th className="py-2 px-3">Furo CAD</th>
                    <th className="py-2 px-3">Prof. Mín.</th>
                    <th className="py-2 px-3">Parede Mín.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  {HEAT_SET_INSERTS.map((row) => (
                    <tr key={row.thread} className="hover:bg-surface-overlay/40">
                      <td className="py-1.5 px-3 font-bold text-text-primary">
                        {row.thread}
                      </td>
                      <td className="py-1.5 px-3 font-bold text-accent">
                        {row.holeDiameterMm.toFixed(1)} mm
                      </td>
                      <td className="py-1.5 px-3 text-text-secondary">
                        {row.minHoleDepthMm.toFixed(1)} mm
                      </td>
                      <td className="py-1.5 px-3 text-text-secondary">
                        {row.minWallThicknessMm.toFixed(1)} mm
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tool 2 & 3 Right Column */}
        <div className="space-y-5">
          {/* Tool 2: Kitchen Scale Spool Checker */}
          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-positive" aria-hidden="true" />
              <h3 className="text-sm font-bold text-text-primary">
                Balança de Carretel (Tara por Marca → Estoque)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {spools.length > 0 && (
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-mono uppercase text-text-muted block">
                    Carretel do Meu Estoque (Opcional)
                  </span>
                  <select
                    value={selectedSpoolId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSpoolId(id);
                      const found = spools.find((s) => s.id === id);
                      if (found) {
                        setBrandInput(found.brand);
                        setSpoolMaterial(found.material);
                      }
                    }}
                    className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent"
                  >
                    <option value="">— Calcular manualmente sem vincular —</option>
                    {spools.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.brand} · {sp.material} ({sp.color}) —{" "}
                        {Math.round(sp.weightGrams)}g atuais
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Peso Bruto na Balança (g)
                </span>
                <input
                  type="number"
                  min={0}
                  value={grossScaleGrams}
                  onChange={(e) =>
                    setGrossScaleGrams(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Marca / Tara do Carretel Vazio
                </span>
                <select
                  value={
                    lookupBrandTare(brandInput) > 0
                      ? brandInput
                      : "__custom__"
                  }
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setBrandInput("");
                    } else {
                      setBrandInput(e.target.value);
                    }
                  }}
                  className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent"
                >
                  {BRAND_TARE_GRAMS.map((entry) => (
                    <option key={entry.brand} value={entry.brand}>
                      {entry.brand} ({entry.tareGrams}g tara)
                    </option>
                  ))}
                  <option value="__custom__">Tara Manual</option>
                </select>
              </label>

              {lookupBrandTare(brandInput) === 0 && (
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase text-text-muted block">
                    Tara Manual (g)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={manualTareGrams}
                    onChange={(e) =>
                      setManualTareGrams(
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
                  />
                </label>
              )}
            </div>

            <div className="rounded-xl border border-positive/30 bg-positive-subtle p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Filamento Líquido Restante (Tara {effectiveTare}g)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold font-mono text-positive">
                    {netRemainingGrams.toFixed(0)} g
                  </span>
                  <span className="text-xs font-mono text-text-secondary">
                    ≈ {remainingMetersEstimate.toFixed(1)} m (
                    {activeMaterialForScale})
                  </span>
                </div>
              </div>

              {selectedSpool && (
                <button
                  type="button"
                  onClick={handleUpdateStockFromScale}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--color-positive-fill)] px-3 py-1.5 text-xs font-bold text-[var(--color-positive-fill-fg)] hover:brightness-110 transition-all"
                >
                  {spoolUpdatedId === selectedSpool.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Estoque Atualizado!</span>
                    </>
                  ) : (
                    <span>Atualizar Peso no Estoque</span>
                  )}
                </button>
              )}
            </div>

            <p className="text-[10px] text-text-muted">
              {BRAND_TARE_SOURCE_NOTE}
            </p>
          </section>

          {/* Tool 3: Volumetric Flow Rate Calculator */}
          <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-warning" aria-hidden="true" />
              <h3 className="text-sm font-bold text-text-primary">
                Calibrador de Vazão Volumétrica (mm³/s)
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Camada (mm)
                </span>
                <input
                  type="number"
                  step="0.02"
                  min={0.05}
                  value={layerHeightMm}
                  onChange={(e) =>
                    setLayerHeightMm(Number(e.target.value) || 0.2)
                  }
                  className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-2.5 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Linha (mm)
                </span>
                <input
                  type="number"
                  step="0.02"
                  min={0.1}
                  value={lineWidthMm}
                  onChange={(e) =>
                    setLineWidthMm(Number(e.target.value) || 0.42)
                  }
                  className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-2.5 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">
                  Veloc. (mm/s)
                </span>
                <input
                  type="number"
                  step="10"
                  min={10}
                  value={printSpeedMmS}
                  onChange={(e) =>
                    setPrintSpeedMmS(Number(e.target.value) || 60)
                  }
                  className="w-full rounded-xl border border-border-subtle bg-surface-sunken px-2.5 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
                />
              </label>
            </div>

            <div
              className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-2 ${tierMeta.tone}`}
            >
              <div>
                <span className="text-[10px] font-mono uppercase block opacity-85">
                  Vazão Exigida do Hotend
                </span>
                <span className="text-xl font-extrabold font-mono">
                  {flowResult.flowMm3PerSec.toFixed(2)} mm³/s
                </span>
              </div>
              <div className="text-right text-[11px] font-semibold">
                <div>{tierMeta.name}</div>
                <div className="font-mono text-[10px] opacity-85">
                  Teto All-Metal: {flowResult.maxSafeSpeedForAllMetalMmPerSec}{" "}
                  mm/s · High-Flow:{" "}
                  {flowResult.maxSafeSpeedForHighFlowMmPerSec} mm/s
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
