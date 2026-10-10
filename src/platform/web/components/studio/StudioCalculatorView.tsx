import { deriveProfitAndMargin } from "./studioProfit";
import React, { useState } from "react";
import {
  Printer,
  Droplet,
  FileText,
  Save,
  Copy,
  Sparkles,
  Edit3,
  Clock,
  DollarSign,
  Layers,
  Box,
  Check,
  RotateCcw,
  Zap,
  Package,
  ExternalLink,
  Download,
  FileDown,
  Sliders,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useSpoolStore, FilamentSpool } from "@/shared/stores/spoolStore";
import { marketplaces, Marketplace } from "@/shared/lib/marketplace";
import { generateQuotePdf } from "./exportQuotePdf";
import { guardExport } from "@/shared/lib/demoExportGuard";

export interface StudioCalculatorViewProps {
  onOpenCopilot: () => void;
  onOpenQuoteModal: () => void;
  activeTechnology: "fdm" | "resin";
  onTechnologyChange: (technology: "fdm" | "resin") => void;
  onProjectNameChange?: (name: string) => void;
  onTabChange?: (tab: Tab) => void;
}

const DEMO_PRESETS = {
  fdm: {
    projectName: "Suporte Articulado FDM",
    filamentType: "PLA Basic Preto",
    costPerKg: 110,
    weightGrams: 120,
    filamentDiameter: 1.75,
    hours: 3,
    minutes: 45,
    powerWatts: 200,
    kwhRate: 0.95,
    hardwareCost: 3.5,
    packagingCost: 2.5,
    finishingCost: 0,
    bedAdhesionCost: 0.5,
    nozzleWearCost: 0.4,
    marginPercent: 100,
    hourlyRate: 25,
  },
  resin: {
    projectName: "Miniatura Colecionável Resina",
    filamentType: "Resina Standard Cinza",
    costPerKg: 180, // R$/L
    density: 1.12,
    volumeMl: 40,
    weightGrams: 45,
    hours: 2,
    minutes: 15,
    cureMinutes: 10,
    washMinutes: 8,
    powerWatts: 60,
    cureStationWatts: 45,
    kwhRate: 0.95,
    ipaCost: 2.5,
    ppeCost: 2.0,
    fepCost: 1.5,
    hardwareCost: 0,
    packagingCost: 3.0,
    finishingCost: 4.0,
    marginPercent: 120,
    hourlyRate: 30,
  },
};

const CLEAN_INITIAL = {
  projectName: "",
  filamentType: "PLA Basic",
  costPerKg: 120,
  weightGrams: 0,
  filamentDiameter: 1.75,
  hours: 0,
  minutes: 0,
  powerWatts: 200,
  kwhRate: 0.95,
  hardwareCost: 0,
  packagingCost: 0,
  finishingCost: 0,
  bedAdhesionCost: 0,
  nozzleWearCost: 0,
  marginPercent: 100,
  hourlyRate: 25,
  density: 1.12,
  volumeMl: 0,
  cureMinutes: 10,
  washMinutes: 8,
  cureStationWatts: 45,
  ipaCost: 0,
  ppeCost: 0,
  fepCost: 0,
};

export const StudioCalculatorView: React.FC<StudioCalculatorViewProps> = (
  props,
) => {
  const isDemoMode = useIsDemoMode();
  const formKey = isDemoMode ? `demo-${props.activeTechnology}` : "user-clean";

  return (
    <StudioCalculatorForm key={formKey} isDemoMode={isDemoMode} {...props} />
  );
};

interface StudioCalculatorFormProps extends StudioCalculatorViewProps {
  isDemoMode: boolean;
}

const StudioCalculatorForm: React.FC<StudioCalculatorFormProps> = ({
  onOpenCopilot,
  onOpenQuoteModal,
  activeTechnology,
  onTechnologyChange,
  onProjectNameChange,
  onTabChange,
  isDemoMode,
}) => {
  const initial = isDemoMode ? DEMO_PRESETS[activeTechnology] : CLEAN_INITIAL;

  // Stores
  const calcStore = useCalculatorStore();
  const spools = useSpoolStore((s) => s.spools);

  // Technology is owned by StudioLayout so the demo preset and material
  // selector cannot drift apart.
  const tech = activeTechnology;
  const [projectName, setProjectName] = useState(initial.projectName);
  const [activeSection, setActiveSection] = useState<
    "material" | "params" | "extras" | "pricing" | "advanced"
  >("material");

  // Keep the Studio selector on the same persisted level as Classic/Bento.
  const complexity =
    calcStore.calcLevel === "basic"
      ? "rapido"
      : calcStore.calcLevel === "intermediate"
        ? "detalhado"
        : "avancado";
  const setComplexity = (level: "rapido" | "detalhado" | "avancado") => {
    calcStore.setCalcLevel(
      level === "rapido"
        ? "basic"
        : level === "detalhado"
          ? "intermediate"
          : "advanced",
    );
    if (level !== "avancado") {
      setActiveSection((current) =>
        current === "advanced" ? "pricing" : current,
      );
    }
  };

  // Common input states
  const [filamentType, setFilamentType] = useState(initial.filamentType);
  const [costPerKg, setCostPerKg] = useState(initial.costPerKg);
  const [weightGrams, setWeightGrams] = useState(initial.weightGrams);

  // Resin specific states
  const [resinDensity, setResinDensity] = useState(
    "density" in initial ? initial.density : 1.12,
  );
  const [resinVolumeMl, setResinVolumeMl] = useState(
    "volumeMl" in initial ? initial.volumeMl : 0,
  );
  const [cureTimeMinutes, setCureTimeMinutes] = useState(
    "cureMinutes" in initial ? initial.cureMinutes : 10,
  );
  const [cureStationWatts, setCureStationWatts] = useState(
    "cureStationWatts" in initial ? initial.cureStationWatts : 45,
  );
  const [washTimeMinutes, setWashTimeMinutes] = useState(
    "washMinutes" in initial ? initial.washMinutes : 8,
  );
  const [ipaCost, setIpaCost] = useState(
    "ipaCost" in initial ? initial.ipaCost : 2.5,
  );
  const [ppeCost, setPpeCost] = useState(
    "ppeCost" in initial ? initial.ppeCost : 2.0,
  );
  const [fepCost, setFepCost] = useState(
    "fepCost" in initial ? initial.fepCost : 1.5,
  );

  // FDM specific states
  const [filamentDiameter, setFilamentDiameter] = useState(
    "filamentDiameter" in initial ? initial.filamentDiameter : 1.75,
  );
  const [bedAdhesionCost, setBedAdhesionCost] = useState(
    "bedAdhesionCost" in initial ? initial.bedAdhesionCost : 0.5,
  );
  const [nozzleWearCost, setNozzleWearCost] = useState(
    "nozzleWearCost" in initial ? initial.nozzleWearCost : 0.4,
  );

  // Print Time & Energy states
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [powerWatts, setPowerWatts] = useState(initial.powerWatts);
  const [kwhRate, setKwhRate] = useState(initial.kwhRate);

  // Hardware & Finishing & Sales
  const [hardwareCost, setHardwareCost] = useState(initial.hardwareCost);
  const [packagingCost, setPackagingCost] = useState(initial.packagingCost);
  const [finishingCost, setFinishingCost] = useState(initial.finishingCost);
  const [marginPercent, setMarginPercent] = useState(initial.marginPercent);
  const [hourlyRate, setHourlyRate] = useState(initial.hourlyRate);

  // Advanced Mode Parameters (Oficina Pro)
  const [supportPercent, setSupportPercent] = useState(0); // % adicional de suporte
  const [multiColorPurgePercent, setMultiColorPurgePercent] = useState(0); // % purga multi-filamento (AMS/MMU)
  const [selectedMarketplaceId, setSelectedMarketplaceId] =
    useState<string>("direct");
  const [taxPercent, setTaxPercent] = useState(0); // Imposto fiscal (MEI 0%, Simples 6%)
  const [workshopHourlyOverhead, setWorkshopHourlyOverhead] = useState(1.5); // R$/hora rateio de aluguel/internet

  // Custom price override
  const [customSellPrice, setCustomSellPrice] = useState<number | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // Stock picker state
  const [showInsumoPicker, setShowInsumoPicker] = useState(false);

  // UI feedback states
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const isResinMat = (mat: string) =>
    mat.toLowerCase().includes("resina") || mat.toLowerCase().includes("resin");

  const availableInsumos = spools.filter((s) => {
    const isR = isResinMat(s.material);
    return tech === "resin" ? isR : !isR;
  });

  const handleTechSwitch = (newTech: "fdm" | "resin") => {
    onTechnologyChange(newTech);
    calcStore.setActiveTab(newTech);
    setCustomSellPrice(null);

    if (newTech === "resin") {
      setFilamentType(isDemoMode ? "Resina Standard Cinza" : "Resina Standard");
      setCostPerKg(180);
      setPowerWatts(60);
      const defaultVol =
        weightGrams > 0
          ? Math.round((weightGrams / resinDensity) * 10) / 10
          : 40;
      setResinVolumeMl(defaultVol);
      setWeightGrams(Math.round(defaultVol * resinDensity * 10) / 10);
    } else {
      setFilamentType(isDemoMode ? "PLA Basic Preto" : "PLA Basic");
      setCostPerKg(110);
      setPowerWatts(200);
      if (resinVolumeMl > 0 && weightGrams === 0) {
        setWeightGrams(Math.round(resinVolumeMl * resinDensity));
      }
    }
  };

  const handleVolumeChange = (ml: number) => {
    setResinVolumeMl(ml);
    const calculatedGrams = Math.round(ml * resinDensity * 10) / 10;
    setWeightGrams(calculatedGrams);
  };

  const handleDensityChange = (d: number) => {
    setResinDensity(d);
    if (resinVolumeMl > 0) {
      setWeightGrams(Math.round(resinVolumeMl * d * 10) / 10);
    }
  };

  const handleGramsChange = (g: number) => {
    setWeightGrams(g);
    if (tech === "resin" && resinDensity > 0) {
      setResinVolumeMl(Math.round((g / resinDensity) * 10) / 10);
    }
  };

  const handleSelectInsumoFromStock = (spool: FilamentSpool) => {
    setFilamentType(`${spool.brand} ${spool.material} ${spool.color}`);
    setCostPerKg(spool.costPerKg);
    if (tech === "resin" && spool.diameterMm) {
      if (spool.diameterMm > 0.5 && spool.diameterMm < 2.0) {
        setResinDensity(spool.diameterMm);
      }
    } else if (tech === "fdm" && spool.diameterMm) {
      setFilamentDiameter(spool.diameterMm);
    }
    setShowInsumoPicker(false);
  };

  const handleNameChange = (val: string) => {
    setProjectName(val);
    onProjectNameChange?.(val);
  };

  const handleReset = () => {
    setProjectName("");
    setWeightGrams(0);
    setResinVolumeMl(0);
    setHours(0);
    setMinutes(0);
    setHardwareCost(0);
    setPackagingCost(0);
    setFinishingCost(0);
    setSupportPercent(0);
    setMultiColorPurgePercent(0);
    setCustomSellPrice(null);
    onProjectNameChange?.("");
  };

  // Computations
  const totalTimeHours = hours + minutes / 60;
  const hasInputs =
    weightGrams > 0 ||
    resinVolumeMl > 0 ||
    totalTimeHours > 0 ||
    hardwareCost > 0 ||
    packagingCost > 0;

  // 1. Material Cost (with Advanced Support & Purge multipliers):
  const rawMaterialCost =
    tech === "resin"
      ? (costPerKg / 1000) *
        (resinVolumeMl > 0
          ? resinVolumeMl
          : weightGrams / (resinDensity || 1.12))
      : (costPerKg / 1000) * weightGrams;

  const extraMaterialFactor =
    complexity === "avancado"
      ? 1 + supportPercent / 100 + multiColorPurgePercent / 100
      : 1;

  const materialCost = rawMaterialCost * extraMaterialFactor;

  // 2. Dynamic Energy Calculation:
  const printEnergyKwh = (powerWatts / 1000) * totalTimeHours;
  const postCureTimeHours =
    tech === "resin" ? (cureTimeMinutes + washTimeMinutes) / 60 : 0;
  const postCureEnergyKwh =
    tech === "resin" ? (cureStationWatts / 1000) * postCureTimeHours : 0;
  const totalEnergyKwh = printEnergyKwh + postCureEnergyKwh;
  const energyCost = totalEnergyKwh * kwhRate;

  // 3. Machine Depreciation & Maintenance:
  const machineDeprec = totalTimeHours * (tech === "resin" ? 1.8 : 1.35);
  const machineMaint = totalTimeHours * (tech === "resin" ? 1.4 : 0.75);

  // 4. Failure Risk:
  const failureRisk = (materialCost + energyCost) * 0.05;

  // 5. Labor Cost:
  const laborCost =
    totalTimeHours > 0 ? totalTimeHours * (hourlyRate * 0.25) : 0;

  // 6. Specific Insumos & Extras:
  const specificConsumables =
    tech === "resin"
      ? ipaCost + ppeCost + fepCost
      : bedAdhesionCost + nozzleWearCost;

  // Workshop Overhead Cost (in advanced mode):
  const workshopOverheadCost =
    complexity === "avancado" ? totalTimeHours * workshopHourlyOverhead : 0;

  const extraCosts =
    hardwareCost +
    packagingCost +
    finishingCost +
    specificConsumables +
    workshopOverheadCost;

  // Total Production Base Cost:
  const totalCost = hasInputs
    ? materialCost +
      energyCost +
      machineDeprec +
      machineMaint +
      failureRisk +
      laborCost +
      extraCosts
    : 0;

  // Derivation of Profit and Margin (Cleanly fixes "price 0, profit 100%" bug)
  const {
    sellPrice: effectiveSellPrice,
    profit: effectiveProfit,
    marginPercent: effectiveMargin,
  } = deriveProfitAndMargin({
    baseCost: totalCost,
    targetMarginPercent: marginPercent,
    customSellPrice,
  });

  // Selected marketplace deduction (Advanced mode)
  const activeMarketplace: Marketplace =
    marketplaces.find((m) => m.id === selectedMarketplaceId) || marketplaces[0];
  const marketplaceFeeAmount =
    effectiveSellPrice > 0
      ? effectiveSellPrice * (activeMarketplace.feePercent / 100) +
        activeMarketplace.feeFixed
      : 0;
  const taxAmount =
    effectiveSellPrice > 0 ? effectiveSellPrice * (taxPercent / 100) : 0;
  const netProfitAfterDeductions = Math.max(
    0,
    effectiveProfit - marketplaceFeeAmount - taxAmount,
  );

  const sellPriceFormatted =
    effectiveSellPrice > 0
      ? effectiveSellPrice.toFixed(2).replace(".", ",")
      : "0,00";
  const totalCostFormatted =
    totalCost > 0 ? totalCost.toFixed(2).replace(".", ",") : "0,00";
  const profitFormatted =
    effectiveProfit > 0 ? effectiveProfit.toFixed(2).replace(".", ",") : "0,00";

  const handleCopyLink = () => {
    if (guardExport()) return;
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveBudget = () => {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleDownloadPdf = () => {
    setIsExportingPdf(true);
    try {
      generateQuotePdf({
        projectName:
          projectName.trim() ||
          (tech === "resin" ? "Peça em Resina 3D" : "Peça em Filamento FDM"),
        tech,
        filamentType:
          filamentType || (tech === "resin" ? "Resina Standard" : "PLA Basic"),
        costPerKg,
        weightGrams: weightGrams * extraMaterialFactor,
        resinVolumeMl: resinVolumeMl * extraMaterialFactor,
        resinDensity,
        filamentDiameter,
        hours,
        minutes,
        powerWatts,
        kwhRate,
        energyCost,
        totalEnergyKwh,
        cureTimeMinutes,
        washTimeMinutes,
        materialCost,
        machineDeprec,
        machineMaint,
        failureRisk,
        laborCost,
        hourlyRate,
        hardwareCost,
        packagingCost,
        finishingCost,
        specificConsumables: specificConsumables + workshopOverheadCost,
        totalCost,
        profit: effectiveProfit,
        marginPercent: effectiveMargin,
        sellPrice: effectiveSellPrice,
      });
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } catch (err) {
      console.error("Erro ao gerar relatório em PDF:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-text-primary mx-auto w-full max-w-7xl pb-20 items-start">
      {/* Left Sub-nav & Main Form */}
      <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-4 w-full">
        {/* Sub-Nav menu.
            LAYOUT-ONLY FIX (VIS-003a), deliberately touching nothing else in
            this file: the deferred colour epic owns this component's palette
            and none of its literals were altered.

            On mobile this is a horizontal row of five `whitespace-nowrap`
            buttons (~665px of content in a ~326px column), and with no overflow
            handling the row escaped its column by ~340px. That was the single
            largest contributor to the page being 628px wide at a 390px
            viewport (the dock stays in document flow with its own scroll
            container, so it never establishes page width).

            `overflow-x-auto` makes this box the scroll container so the pills
            scroll inside it, exactly as the sub-header tab strip already does;
            `md:` restores the original vertical column, where five short labels
            fit without scrolling.
            Beta owns ONE navigation model (the sidebar): this in-calculator
            sub-nav would compete with it, so it is withheld there. All
            sections stay rendered below, so nothing is orphaned. */}
        {!isBetaChannel && (
          <div className="w-full md:w-36 shrink-0 overflow-x-auto bg-surface-raised border border-border-subtle rounded-xl p-2.5 flex flex-row md:flex-col gap-1 select-none">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted px-2 py-1 hidden md:block">
              FORMULÁRIO
            </span>
            {[
              { id: "material" as const, label: "1. Insumos & Mat." },
              { id: "params" as const, label: "2. Parâmetros & Cura" },
              { id: "extras" as const, label: "3. Extras & Insumos" },
              { id: "pricing" as const, label: "4. Vendas & Margem" },
              ...(complexity === "avancado"
                ? [{ id: "advanced" as const, label: "5. Modo Oficina Pro" }]
                : []),
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id);
                  document
                    .getElementById(`studio-section-${sec.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex-1 md:flex-none min-h-11 text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeSection === sec.id
                    ? "bg-accent-subtle text-info border border-accent/30"
                    : "text-text-secondary hover:text-text-secondary hover:bg-surface-raised"
                }`}
              >
                {sec.label}
              </button>
            ))}

            {hasInputs && !isDemoMode && (
              <button
                onClick={handleReset}
                className="mt-auto hidden md:flex min-h-11 items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-text-secondary hover:text-critical hover:bg-critical-subtle transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Demo Mode Notice */}
          {isDemoMode && (
            <div className="bg-surface-raised border border-accent/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <div>
                  <span className="font-bold text-accent block">
                    Modo Demo Ativo (Templates Pré-Carregados)
                  </span>
                  <span className="text-[11px] text-accent">
                    Alterne entre os dois templates para simular cálculos:
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-surface-sunken p-0.5 rounded-lg border border-accent/30">
                <button
                  type="button"
                  onClick={() => onTechnologyChange("fdm")}
                  aria-pressed={activeTechnology === "fdm"}
                  className={`min-h-11 px-3 py-1 rounded text-xs font-semibold transition-all ${
                    activeTechnology === "fdm"
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span aria-hidden="true">🖨️ </span>Template Filamento (FDM)
                </button>
                <button
                  type="button"
                  onClick={() => onTechnologyChange("resin")}
                  aria-pressed={activeTechnology === "resin"}
                  className={`min-h-11 px-3 py-1 rounded text-xs font-semibold transition-all ${
                    activeTechnology === "resin"
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span aria-hidden="true">💧 </span>Template Resina (MSLA)
                </button>
              </div>
            </div>
          )}

          {/* 🌟 SELETOR PRINCIPAL DE TIPO DE INSUMO (FDM vs RESINA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTechSwitch("fdm")}
              aria-label="Insumo Filamento (FDM)"
              aria-pressed={tech === "fdm"}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all relative overflow-hidden group ${
                tech === "fdm"
                  ? "bg-accent-subtle border-accent shadow-md shadow-accent/40 ring-1 ring-accent/40"
                  : "bg-surface-raised border-border-subtle hover:border-border-subtle opacity-75 hover:opacity-100"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  tech === "fdm"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                    : "bg-surface-sunken text-text-secondary"
                }`}
              >
                <Printer className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-text-primary group-hover:text-info transition-colors">
                    Insumo Filamento (FDM)
                  </span>
                  {tech === "fdm" && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-accent-subtle text-info border border-accent/30">
                      ATIVO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                  Carretéis termoplásticos (PLA, PETG, ABS, TPU) • Medição em
                  Gramas (g)
                </p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-text-secondary font-mono">
                  <span className="flex items-center gap-1 text-warning">
                    <Zap className="w-3 h-3" /> ~200W (Mesa + Bico)
                  </span>
                  <span>•</span>
                  <span>Ø 1.75 mm</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTechSwitch("resin")}
              aria-label="Insumo Resina (SLA / MSLA / DLP)"
              aria-pressed={tech === "resin"}
              className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all relative overflow-hidden group ${
                tech === "resin"
                  ? "bg-accent-subtle border-accent shadow-md shadow-accent/40 ring-1 ring-accent/40"
                  : "bg-surface-raised border-border-subtle hover:border-border-subtle opacity-75 hover:opacity-100"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  tech === "resin"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                    : "bg-surface-sunken text-text-secondary"
                }`}
              >
                <Droplet className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-text-primary group-hover:text-accent transition-colors">
                    Insumo Resina (SLA / MSLA / DLP)
                  </span>
                  {tech === "resin" && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-accent-subtle text-accent border border-accent/30">
                      ATIVO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                  Garrafas UV 405nm • Medição em Volume (ml) • Densidade &
                  Pós-Cura
                </p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-text-secondary font-mono">
                  <span className="flex items-center gap-1 text-accent">
                    <Zap className="w-3 h-3" /> ~60W LCD + Estação UV
                  </span>
                  <span>•</span>
                  <span>Lavagem & Cura</span>
                </div>
              </div>
            </button>
          </div>

          {/* 🌟 NÍVEL DE COMPLEXIDADE DO FORMULÁRIO (RÁPIDO vs DETALHADO vs AVANÇADO) */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-raised border border-border-subtle rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-info" />
              <div>
                <span className="text-xs font-bold text-text-primary block">
                  Nível de Cálculo & Detalhamento:
                </span>
                <span className="text-[10px] text-text-secondary leading-snug">
                  {complexity === "rapido"
                    ? "Visão expressa e simplificada"
                    : complexity === "detalhado"
                      ? "Parâmetros completos de produção"
                      : "Oficina Pro (Multi-cor, comissões de marketplaces e atacado)"}
                </span>
              </div>
            </div>

            <div
              role="group"
              aria-label="Nível de cálculo"
              className="grid w-full grid-cols-3 gap-1.5 rounded-xl border border-border-subtle bg-surface-sunken p-1.5 sm:flex sm:w-auto"
            >
              <button
                type="button"
                onClick={() => setComplexity("rapido")}
                aria-pressed={complexity === "rapido"}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-w-[6rem] sm:flex-row sm:gap-2 sm:px-3 sm:text-xs ${
                  complexity === "rapido"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-md"
                    : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                }`}
              >
                <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Rápido</span>
              </button>
              <button
                type="button"
                onClick={() => setComplexity("detalhado")}
                aria-pressed={complexity === "detalhado"}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-w-[7rem] sm:flex-row sm:gap-2 sm:px-3 sm:text-xs ${
                  complexity === "detalhado"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-md"
                    : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                }`}
              >
                <Sliders className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Detalhado</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setComplexity("avancado");
                  setActiveSection("advanced");
                  window.requestAnimationFrame(() => {
                    document
                      .getElementById("studio-section-advanced")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                aria-pressed={complexity === "avancado"}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-w-[9rem] sm:flex-row sm:gap-2 sm:px-3 sm:text-xs ${
                  complexity === "avancado"
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-md"
                    : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Avançado / Pro</span>
              </button>
            </div>
          </div>

          {/* Piece Identification & Insumo Stock Integration */}
          <div className="bg-surface-raised border border-border-subtle rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:flex-1 relative">
              <label className="text-[10px] font-mono uppercase font-bold text-text-secondary block mb-1">
                IDENTIFICAÇÃO DA PEÇA / ARQUIVO 3D
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Suporte para headset, miniatura articulada, engrenagem..."
                  className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-medium"
                />
                <Edit3 className="w-3.5 h-3.5 text-text-muted absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="w-full sm:w-auto self-end flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInsumoPicker(!showInsumoPicker)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-subtle hover:bg-accent-subtle border border-accent/30 text-info text-xs font-semibold transition-all whitespace-nowrap"
                title="Puxar material e custo direto do seu estoque cadastrado"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Puxar de Insumos ({availableInsumos.length})</span>
              </button>

              {onTabChange && (
                <button
                  type="button"
                  onClick={() => onTabChange("inventory")}
                  className="p-2 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary transition-colors"
                  title="Abrir Gestão de Insumos"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Insumo Stock Quick Picker Popover */}
          {showInsumoPicker && (
            <div className="bg-surface-raised border border-accent/40 rounded-xl p-3 shadow-2xl flex flex-col gap-2 animate-fade-up">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-border-subtle">
                <span className="font-bold text-text-primary flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-info" />
                  Selecione do Estoque (
                  {tech === "resin" ? "Garrafas de Resina" : "Carretéis FDM"}):
                </span>
                <button
                  onClick={() => setShowInsumoPicker(false)}
                  className="text-text-secondary hover:text-text-primary text-xs px-1"
                >
                  ✕
                </button>
              </div>

              {availableInsumos.length === 0 ? (
                <div className="text-center py-4 text-xs text-text-secondary">
                  Nenhum insumo de {tech === "resin" ? "resina" : "filamento"}{" "}
                  encontrado em estoque.{" "}
                  {onTabChange && (
                    <button
                      onClick={() => onTabChange("inventory")}
                      className="text-info underline font-bold ml-1"
                    >
                      Cadastrar em Insumos
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {availableInsumos.map((spool) => (
                    <button
                      key={spool.id}
                      type="button"
                      onClick={() => handleSelectInsumoFromStock(spool)}
                      className="text-left bg-surface-overlay hover:bg-surface-overlay border border-border-subtle hover:border-accent/50 p-2 rounded-lg flex items-center gap-2.5 transition-all group"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-border-subtle shrink-0 shadow-sm"
                        style={{
                          backgroundColor:
                            spool.colorHex || "var(--color-info)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-text-primary group-hover:text-info truncate">
                          {spool.brand} {spool.material}
                        </div>
                        <div className="text-[10px] text-text-secondary flex items-center justify-between">
                          <span>{spool.color}</span>
                          <span className="font-mono text-positive font-bold">
                            R$ {spool.costPerKg.toFixed(2)}/
                            {tech === "resin" ? "L" : "kg"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 1: Insumos & Materiais */}
          {/* F1 tour anchor `material` — step copy promises "o tipo de
              filamento, o peso da peça e o custo". This card owns all three
              (TIPO DE FILAMENTO, PESO ESTIMADO DO FATIADOR, CUSTO / KG) in both
              the FDM and the Resin branch. */}
          <div
            id="studio-section-material"
            data-tutorial="material"
            className="scroll-mt-24 bg-surface-raised border border-border-subtle rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between border-b border-border-subtle pb-2">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                <Box className="w-4 h-4 text-info" />
                1. INSUMO & CONSUMO DE MATERIAL
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-subtle text-info border border-accent/20 font-bold">
                {tech === "resin"
                  ? "🧪 Resina Fotopolímero"
                  : "🧵 Filamento Termoplástico"}
              </span>
            </div>

            {tech === "resin" ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    TIPO DE RESINA (UV 405nm)
                  </label>
                  <input
                    type="text"
                    value={filamentType}
                    onChange={(e) => setFilamentType(e.target.value)}
                    placeholder="Ex: Resina Standard Cinza, ABS-Like..."
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary font-semibold outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    CUSTO / LITRO (R$/L)
                  </label>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-text-muted mr-1.5 font-bold">R$</span>
                    <input
                      type="number"
                      value={costPerKg || ""}
                      onChange={(e) => setCostPerKg(Number(e.target.value))}
                      placeholder="180"
                      className="bg-transparent text-text-primary font-semibold outline-none w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1 flex items-center justify-between">
                    <span>DENSIDADE</span>
                    <span className="text-accent font-bold">
                      {resinDensity} g/cm³
                    </span>
                  </label>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                    <input
                      type="number"
                      step="0.01"
                      min="0.9"
                      max="1.5"
                      value={resinDensity}
                      onChange={(e) =>
                        handleDensityChange(Number(e.target.value))
                      }
                      className="bg-transparent text-text-primary font-semibold outline-none w-full"
                    />
                    <span className="text-text-muted text-[10px] ml-1">
                      g/ml
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-4 bg-surface-sunken border border-border-subtle p-3 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      VOLUME USADO NO FATIADOR (ml)
                    </label>
                    <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                      <input
                        type="number"
                        step="1"
                        value={resinVolumeMl || ""}
                        onChange={(e) =>
                          handleVolumeChange(Number(e.target.value))
                        }
                        placeholder="0"
                        className="bg-transparent text-text-primary font-bold text-sm outline-none w-full"
                      />
                      <span className="text-accent font-bold ml-1">ml</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      PESO EQUIVALENTE CALCULADO (g)
                    </label>
                    <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                      <input
                        type="number"
                        step="0.5"
                        value={weightGrams || ""}
                        onChange={(e) =>
                          handleGramsChange(Number(e.target.value))
                        }
                        placeholder="0"
                        className="bg-transparent text-positive font-bold text-sm outline-none w-full"
                      />
                      <span className="text-text-secondary font-bold ml-1">
                        g
                      </span>
                      {materialCost > 0 && (
                        <span className="ml-auto font-mono text-positive font-bold text-xs whitespace-nowrap">
                          R$ {materialCost.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    TIPO DE FILAMENTO
                  </label>
                  <input
                    type="text"
                    value={filamentType}
                    onChange={(e) => setFilamentType(e.target.value)}
                    placeholder="Ex: PLA Basic Preto, PETG Branco..."
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary font-semibold outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    DIÂMETRO
                  </label>
                  <select
                    value={filamentDiameter}
                    onChange={(e) =>
                      setFilamentDiameter(Number(e.target.value))
                    }
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-secondary outline-none"
                  >
                    <option value={1.75}>1.75 mm (Padrão)</option>
                    <option value={2.85}>2.85 mm</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    CUSTO / KG (R$/kg)
                  </label>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-text-muted mr-1.5 font-bold">R$</span>
                    <input
                      type="number"
                      value={costPerKg || ""}
                      onChange={(e) => setCostPerKg(Number(e.target.value))}
                      placeholder="110"
                      className="bg-transparent text-text-primary font-semibold outline-none w-full"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4 bg-surface-sunken border border-border-subtle p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="w-full sm:w-1/2">
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      PESO ESTIMADO DO FATIADOR (g)
                    </label>
                    <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                      <input
                        type="number"
                        step="1"
                        value={weightGrams || ""}
                        onChange={(e) => setWeightGrams(Number(e.target.value))}
                        placeholder="0"
                        className="bg-transparent text-text-primary font-bold text-sm outline-none w-full"
                      />
                      <span className="text-info font-bold ml-1">g</span>
                    </div>
                  </div>

                  <div className="text-right w-full sm:w-auto">
                    <span className="text-[10px] text-text-secondary uppercase font-mono block">
                      CUSTO DE MATERIAL
                    </span>
                    <span className="text-base font-extrabold text-positive font-mono">
                      R$ {materialCost.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Tempo, Cura & Consumo de Energia */}
          {/* F1 tour anchor `print` — step copy promises "o tempo de impressão,
              potência da sua impressora e o custo da energia". TEMPO DE
              IMPRESSÃO, POTÊNCIA FDM (MESA+BICO) and TARIFA ENERGIA (R$/kWh)
              are all in this card. */}
          <div
            id="studio-section-params"
            data-tutorial="print"
            className="scroll-mt-24 bg-surface-raised border border-border-subtle rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between border-b border-border-subtle pb-2">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                2. TEMPO DE MÁQUINA, CURA & ENERGIA
              </h2>
              <span className="text-[11px] text-warning font-bold">
                {hours > 0 || minutes > 0
                  ? `Impressão: ${hours}h ${minutes}m`
                  : "Definir tempo"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                  TEMPO DE IMPRESSÃO
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2 py-1.5 text-xs flex-1">
                    <input
                      type="number"
                      value={hours || ""}
                      onChange={(e) => setHours(Number(e.target.value))}
                      placeholder="0"
                      className="bg-transparent text-text-primary font-semibold outline-none w-full text-center"
                    />
                    <span className="text-text-muted font-bold ml-1">h</span>
                  </div>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2 py-1.5 text-xs flex-1">
                    <input
                      type="number"
                      value={minutes || ""}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      placeholder="0"
                      className="bg-transparent text-text-primary font-semibold outline-none w-full text-center"
                    />
                    <span className="text-text-muted font-bold ml-1">m</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                  {tech === "resin"
                    ? "POTÊNCIA LCD (UV)"
                    : "POTÊNCIA FDM (MESA+BICO)"}
                </label>
                <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs justify-between">
                  <input
                    type="number"
                    value={powerWatts || ""}
                    onChange={(e) => setPowerWatts(Number(e.target.value))}
                    placeholder={tech === "resin" ? "60" : "200"}
                    className="bg-transparent text-text-primary font-semibold outline-none w-full"
                  />
                  <span className="text-text-muted font-bold ml-1">W</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                  TARIFA ENERGIA (R$/kWh)
                </label>
                <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs justify-between">
                  <input
                    type="number"
                    step="0.05"
                    value={kwhRate}
                    onChange={(e) => setKwhRate(Number(e.target.value))}
                    className="bg-transparent text-text-primary font-semibold outline-none w-full"
                  />
                  <span className="text-text-muted font-bold ml-1 text-[10px]">
                    R$/kWh
                  </span>
                </div>
              </div>
            </div>

            {tech === "resin" && (
              <div className="bg-surface-raised border border-accent/30 rounded-xl p-3 flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between text-xs text-accent font-bold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    Pós-Cura UV & Estação de Lavagem (Wash & Cure)
                  </span>
                  <span className="text-[11px] font-mono text-accent">
                    +{cureTimeMinutes + washTimeMinutes} min de pós-processo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      TEMPO DE CURA UV
                    </label>
                    <div className="flex items-center bg-surface-sunken border border-accent/30 rounded-lg px-2.5 py-1.5 text-xs">
                      <input
                        type="number"
                        value={cureTimeMinutes}
                        onChange={(e) =>
                          setCureTimeMinutes(Number(e.target.value))
                        }
                        className="bg-transparent text-text-primary font-semibold outline-none w-full"
                      />
                      <span className="text-accent font-bold ml-1 text-[10px]">
                        min
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      TEMPO DE LAVAGEM (IPA)
                    </label>
                    <div className="flex items-center bg-surface-sunken border border-accent/30 rounded-lg px-2.5 py-1.5 text-xs">
                      <input
                        type="number"
                        value={washTimeMinutes}
                        onChange={(e) =>
                          setWashTimeMinutes(Number(e.target.value))
                        }
                        className="bg-transparent text-text-primary font-semibold outline-none w-full"
                      />
                      <span className="text-accent font-bold ml-1 text-[10px]">
                        min
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      POTÊNCIA ESTAÇÃO CURA
                    </label>
                    <div className="flex items-center bg-surface-sunken border border-accent/30 rounded-lg px-2.5 py-1.5 text-xs">
                      <input
                        type="number"
                        value={cureStationWatts}
                        onChange={(e) =>
                          setCureStationWatts(Number(e.target.value))
                        }
                        className="bg-transparent text-text-primary font-semibold outline-none w-full"
                      />
                      <span className="text-accent font-bold ml-1 text-[10px]">
                        W
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Custos Extras */}
          <div
            id="studio-section-extras"
            className="scroll-mt-24 bg-surface-raised border border-border-subtle rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between border-b border-border-subtle pb-2">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" />
                3. CUSTOS EXTRAS & INSUMOS AUXILIARES
              </h2>
              <span className="text-[11px] text-accent font-bold">
                Total Extras: R$ {extraCosts.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {complexity === "rapido" ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-text-secondary">
                  Os custos extras salvos continuam incluídos na estimativa: R${" "}
                  {extraCosts.toFixed(2).replace(".", ",")}.
                </p>
                <button
                  type="button"
                  onClick={() => setComplexity("detalhado")}
                  className="min-h-11 shrink-0 rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-raised"
                >
                  Editar custos no modo Detalhado
                </button>
              </div>
            ) : (
              <>
                {tech === "resin" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-raised p-3 rounded-xl border border-border-subtle">
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                        ÁLCOOL ISOPROPÍLICO (IPA)
                      </label>
                      <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-text-muted mr-1.5 font-bold">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          value={ipaCost}
                          onChange={(e) => setIpaCost(Number(e.target.value))}
                          className="bg-transparent text-text-primary font-semibold outline-none w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                        EPIS (LUVAS + FILTRO)
                      </label>
                      <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-text-muted mr-1.5 font-bold">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          value={ppeCost}
                          onChange={(e) => setPpeCost(Number(e.target.value))}
                          className="bg-transparent text-text-primary font-semibold outline-none w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                        DESGASTE FILME FEP
                      </label>
                      <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-text-muted mr-1.5 font-bold">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          value={fepCost}
                          onChange={(e) => setFepCost(Number(e.target.value))}
                          className="bg-transparent text-text-primary font-semibold outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-raised p-3 rounded-xl border border-border-subtle">
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                        ADESIVO / COLA DE MESA (R$)
                      </label>
                      <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-text-muted mr-1.5 font-bold">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={bedAdhesionCost}
                          onChange={(e) =>
                            setBedAdhesionCost(Number(e.target.value))
                          }
                          className="bg-transparent text-text-primary font-semibold outline-none w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                        DESGASTE DE BICO / NOZZLE (R$)
                      </label>
                      <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-text-muted mr-1.5 font-bold">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={nozzleWearCost}
                          onChange={(e) =>
                            setNozzleWearCost(Number(e.target.value))
                          }
                          className="bg-transparent text-text-primary font-semibold outline-none w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      HARDWARE / PARAFUSOS (R$)
                    </label>
                    <input
                      type="number"
                      value={hardwareCost || ""}
                      onChange={(e) => setHardwareCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      EMBALAGEM & CAIXA (R$)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={packagingCost || ""}
                      onChange={(e) => setPackagingCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                      ACABAMENTO / PINTURA (R$)
                    </label>
                    <input
                      type="number"
                      value={finishingCost || ""}
                      onChange={(e) => setFinishingCost(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Section 4: Precificação Comercial & Lucro */}
          {/* F1 tour anchor `sales` — step copy promises "definir sua margem de
              lucro". The margin slider (MARGEM DE LUCRO DESEJADA) and VALOR HORA
              DE TRABALHO are here, so this card is the honest anchor for the step.

              The step copy used to promise "custos de embalagem e frete" as well,
              which over-promised on this surface: EMBALAGEM & CAIXA lives in
              Section 3 (Custos Extras) and the Studio has no frete/shipping field
              at all. RESOLVED IN THE TOUR COPY, not by moving the field — the
              step now names only what this section shows (margin, hourly rate,
              sales channel, quantity discount table). This anchor did not move. */}
          <div
            id="studio-section-pricing"
            data-tutorial="sales"
            className="scroll-mt-24 bg-surface-raised border border-border-subtle rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between border-b border-border-subtle pb-2">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-positive" />
                4. PRECIFICAÇÃO COMERCIAL & MARGEM
              </h2>
              <span className="text-[11px] text-positive font-bold">
                {totalCost > 0
                  ? `+${effectiveMargin}% Margem`
                  : "Aguardando Custo"}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-text-secondary font-semibold">
                    Margem de Lucro Desejada:
                  </span>
                  <span className="text-positive font-bold">
                    +{marginPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="250"
                  value={marginPercent}
                  onChange={(e) => {
                    setMarginPercent(Number(e.target.value));
                    setCustomSellPrice(null);
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-text-muted font-mono mt-1">
                  <span>10% (Mínimo)</span>
                  <span>100% (Padrão 2x)</span>
                  <span>250% (Alta Margem)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    VALOR HORA DE TRABALHO
                  </label>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-text-muted mr-1.5 font-bold">R$</span>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="bg-transparent text-text-primary font-semibold outline-none w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    MÃO DE OBRA CALCULADA
                  </label>
                  <div className="bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-secondary font-bold">
                    R$ {laborCost.toFixed(2).replace(".", ",")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 SECTION 5: PARÂMETROS AVANÇADOS (Modo Oficina Pro) */}
          {complexity === "avancado" && (
            <div
              id="studio-section-advanced"
              className="scroll-mt-24 bg-surface-raised border border-accent/40 rounded-xl p-4 flex flex-col gap-4 animate-fade-in"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent-subtle border border-accent/30 flex items-center justify-center text-accent">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-text-primary">
                      5. MODO OFICINA PRO • PARÂMETROS AVANÇADOS
                    </h2>
                    <span className="text-xs text-text-secondary">
                      Perda de purga multi-filamento, taxas de marketplaces e
                      atacado
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-accent-subtle text-accent font-bold border border-accent/30">
                  PRO ATIVO
                </span>
              </div>

              {/* Multi-cor e Suportes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-sunken p-3 rounded-xl border border-border-subtle">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-secondary font-semibold">
                      Suportes de Fatiamento (%):
                    </span>
                    <span className="text-info font-mono font-bold">
                      +{supportPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={supportPercent}
                    onChange={(e) => setSupportPercent(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-text-muted">
                    Material adicional consumido na estrutura de suporte
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-secondary font-semibold">
                      Purga Multi-Cor (AMS / MMU):
                    </span>
                    <span className="text-accent font-mono font-bold">
                      +{multiColorPurgePercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={multiColorPurgePercent}
                    onChange={(e) =>
                      setMultiColorPurgePercent(Number(e.target.value))
                    }
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-text-muted">
                    Perda por torre de purga e trocas de filamento
                  </span>
                </div>
              </div>

              {/* Canal de Venda e Taxas de Marketplace */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-sunken p-3 rounded-xl border border-border-subtle">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    CANAL DE VENDA (MARKETPLACE)
                  </label>
                  <select
                    value={selectedMarketplaceId}
                    onChange={(e) => setSelectedMarketplaceId(e.target.value)}
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-secondary outline-none"
                  >
                    {marketplaces.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.feePercent}%{" "}
                        {m.feeFixed > 0 ? `+ R$ ${m.feeFixed.toFixed(2)}` : ""})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    ALÍQUOTA DE IMPOSTO FISCAL (%)
                  </label>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="30"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(Number(e.target.value))}
                      className="bg-transparent text-text-primary font-semibold outline-none w-full"
                    />
                    <span className="text-text-muted font-bold ml-1">%</span>
                  </div>
                  <span className="text-[9px] text-text-muted">
                    Ex: Simples 6%, MEI 0%
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    OVERHEAD FIXO OFICINA (R$/h)
                  </label>
                  <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-text-muted mr-1 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.5"
                      value={workshopHourlyOverhead}
                      onChange={(e) =>
                        setWorkshopHourlyOverhead(Number(e.target.value))
                      }
                      className="bg-transparent text-text-primary font-semibold outline-none w-full"
                    />
                  </div>
                  <span className="text-[9px] text-text-muted">
                    Rateio aluguel, luz e softwares
                  </span>
                </div>
              </div>

              {/* Tabela de Preços por Quantidade (Atacado) */}
              <div className="bg-surface-sunken p-3 rounded-xl border border-border-subtle">
                <span className="text-[10px] font-mono uppercase text-text-secondary font-bold block mb-2">
                  TABELA DE DESCONTOS PROGRESSIVOS POR QUANTIDADE (ATACADO)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { qty: 1, discount: 0, label: "1 un (Avulso)" },
                    { qty: 5, discount: 5, label: "5 un (-5%)" },
                    { qty: 10, discount: 10, label: "10 un (-10%)" },
                    { qty: 25, discount: 15, label: "25 un (-15%)" },
                  ].map((tier) => {
                    const tierUnitSell =
                      effectiveSellPrice * (1 - tier.discount / 100);
                    const tierProfit = (tierUnitSell - totalCost) * tier.qty;
                    return (
                      <div
                        key={tier.qty}
                        className="bg-surface-raised border border-border-subtle p-2 rounded-lg"
                      >
                        <span className="text-[10px] text-text-secondary font-semibold block">
                          {tier.label}
                        </span>
                        <span className="text-xs font-bold text-text-primary block mt-0.5">
                          R${" "}
                          {tierUnitSell > 0
                            ? tierUnitSell.toFixed(2).replace(".", ",")
                            : "0,00"}
                          /un
                        </span>
                        <span className="text-[10px] text-positive font-mono block">
                          Lucro: R${" "}
                          {tierProfit > 0
                            ? tierProfit.toFixed(2).replace(".", ",")
                            : "0,00"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sticky Results Panel */}
      {/* F1 tour anchor `results` — step copy promises "o custo total, o preço
          sugerido e o lucro estimado". PREÇO SUGERIDO, CUSTO DE PRODUÇÃO and
          LUCRO BRUTO are all in this panel. This panel holds NO slider at all,
          so the step's "use os sliders" tail pointed at the margin slider in
          Section 4 (`sales`) and not here; RESOLVED IN THE TOUR COPY, which now
          points back to Section 4 for scenarios. This anchor did not move. */}
      <div
        data-tutorial="results"
        className="w-full lg:w-80 shrink-0 bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col gap-4 sticky top-28 shadow-xl"
      >
        {/* Suggested Price Header */}
        <div className="text-center py-2 border-b border-border-subtle">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-positive uppercase tracking-wider mb-1">
            <span>PREÇO SUGERIDO</span>
            <button
              onClick={() => setIsEditingPrice(!isEditingPrice)}
              title="Ajustar preço manualmente"
              className="text-text-secondary hover:text-text-primary"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            {totalCost > 0 ? (
              <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-positive-subtle border border-positive/30">
                +{effectiveMargin}% LUCRO
              </span>
            ) : (
              <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-surface-sunken text-text-secondary border border-border-subtle">
                SEM DADOS
              </span>
            )}
          </div>

          {isEditingPrice ? (
            <div className="flex items-center justify-center gap-1.5 my-1">
              <span className="text-text-secondary font-bold text-lg">R$</span>
              <input
                type="number"
                step="0.5"
                value={
                  customSellPrice !== null
                    ? customSellPrice
                    : effectiveSellPrice
                }
                onChange={(e) => setCustomSellPrice(Number(e.target.value))}
                placeholder="0,00"
                className="w-32 bg-surface-raised border border-positive rounded px-2 py-1 text-2xl font-extrabold text-text-primary text-center outline-none"
              />
            </div>
          ) : (
            <div className="text-3xl font-extrabold text-text-primary tracking-tight">
              R$ {sellPriceFormatted}
            </div>
          )}
        </div>

        {/* Cost vs Profit Row */}
        <div className="grid grid-cols-2 gap-2 text-center py-2 bg-surface-sunken rounded-xl p-2.5 border border-border-subtle">
          <div>
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              CUSTO DE PRODUÇÃO
            </span>
            <span className="text-sm font-bold text-text-primary block">
              R$ {totalCostFormatted}
            </span>
            <span className="text-[10px] text-text-muted">
              {totalCost > 0 && weightGrams > 0
                ? `R$ ${(totalCost / (weightGrams * extraMaterialFactor)).toFixed(2).replace(".", ",")}/g`
                : "R$ 0,00"}
            </span>
          </div>
          <div className="border-l border-border-subtle">
            <span className="text-[10px] text-text-secondary uppercase font-mono block">
              LUCRO BRUTO
            </span>
            <span className="text-sm font-bold text-positive block">
              R$ {profitFormatted}
            </span>
            <span className="text-[10px] text-text-muted">
              {effectiveProfit > 0 && totalTimeHours > 0
                ? `R$ ${(effectiveProfit / totalTimeHours).toFixed(2).replace(".", ",")}/h`
                : "R$ 0,00/h"}
            </span>
          </div>
        </div>

        {/* Deduction Warning if Marketplace Active in Advanced Mode */}
        {complexity === "avancado" &&
          (marketplaceFeeAmount > 0 || taxAmount > 0) && (
            <div className="bg-surface-raised border border-accent/30 p-2.5 rounded-xl text-[11px] flex flex-col gap-1">
              <div className="flex items-center justify-between text-text-secondary font-semibold">
                <span>LUCRO LÍQUIDO NO BOLSO:</span>
                <span className="font-mono text-positive font-bold">
                  R$ {netProfitAfterDeductions.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="text-[10px] text-text-secondary flex items-center justify-between">
                <span>Taxa {activeMarketplace.name}:</span>
                <span>
                  -R$ {marketplaceFeeAmount.toFixed(2).replace(".", ",")}
                </span>
              </div>
              {taxAmount > 0 && (
                <div className="text-[10px] text-text-secondary flex items-center justify-between">
                  <span>Imposto ({taxPercent}%):</span>
                  <span>-R$ {taxAmount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </div>
          )}

        {/* Cost Breakdown */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-text-secondary">
            <span>COMPOSIÇÃO DE CUSTOS</span>
            <Layers className="w-3.5 h-3.5 text-text-muted" />
          </div>

          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent" />{" "}
                {tech === "resin" ? "Resina Líquida" : "Filamento FDM"}
              </span>
              <span className="font-mono">
                {totalCost > 0
                  ? `${Math.round((materialCost / totalCost) * 100)}%`
                  : "0%"}{" "}
                <span className="text-text-secondary">
                  R$ {materialCost.toFixed(2).replace(".", ",")}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-warning" /> Energia
                Elétrica {tech === "resin" && "(LCD + Cura)"}
              </span>
              <span className="font-mono">
                {totalCost > 0
                  ? `${Math.round((energyCost / totalCost) * 100)}%`
                  : "0%"}{" "}
                <span className="text-text-secondary">
                  R$ {energyCost.toFixed(2).replace(".", ",")}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent" /> Insumos
                Auxiliares {tech === "resin" ? "(IPA/EPI)" : "(Cola/Bico)"}
              </span>
              <span className="font-mono">
                {totalCost > 0
                  ? `${Math.round((specificConsumables / totalCost) * 100)}%`
                  : "0%"}{" "}
                <span className="text-text-secondary">
                  R$ {specificConsumables.toFixed(2).replace(".", ",")}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-text-muted" />{" "}
                Depreciação Máquina
              </span>
              <span className="font-mono">
                {totalCost > 0
                  ? `${Math.round((machineDeprec / totalCost) * 100)}%`
                  : "0%"}{" "}
                <span className="text-text-secondary">
                  R$ {machineDeprec.toFixed(2).replace(".", ",")}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-critical" /> Manutenção
                Máquina
              </span>
              <span className="font-mono">
                {totalCost > 0
                  ? `${Math.round((machineMaint / totalCost) * 100)}%`
                  : "0%"}{" "}
                <span className="text-text-secondary">
                  R$ {machineMaint.toFixed(2).replace(".", ",")}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-positive" /> Mão de Obra
              </span>
              <span className="font-mono">
                {totalCost > 0
                  ? `${Math.round((laborCost / totalCost) * 100)}%`
                  : "0%"}{" "}
                <span className="text-text-secondary">
                  R$ {laborCost.toFixed(2).replace(".", ",")}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Primary Export / Download PDF + Quote Modal */}
        {/* F1 tour anchor `export` — step copy promises "salve seu cálculo no
            histórico ou exporte como PDF". "Salvar Projeto", "Copiar Link" and
            "Download Relatório PDF (Orçamento)" are all in this block, so the
            step's two promises both resolve inside the spotlight. */}
        <div
          data-tutorial="export"
          className="flex flex-col gap-2 pt-2 border-t border-border-subtle"
        >
          {/* 🌟 DOWNLOAD PDF BUTTON */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-accent to-accent hover:from-info hover:to-accent text-text-primary font-bold text-xs shadow-lg shadow-accent/50 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {isExportingPdf ? (
              <>
                <FileDown className="w-4 h-4 animate-bounce" />
                <span>Gerando Relatório PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Relatório PDF (Orçamento)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenQuoteModal}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-surface-overlay hover:bg-surface-overlay border border-accent/30 text-info font-semibold text-xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-info" />
            <span>Emitir Orçamento Comercial Formal</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSaveBudget}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary font-semibold text-xs transition-colors"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-positive" />
                  <span className="text-positive">Salvo!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Salvar Projeto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary font-semibold text-xs transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-positive" />
                  <span className="text-positive">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCopilot}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] text-text-secondary hover:text-accent hover:bg-accent-subtle transition-colors"
          >
            <Sparkles className="w-3 h-3 text-accent" />
            <span>Consultar IA Copilot para Otimização de Custos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
