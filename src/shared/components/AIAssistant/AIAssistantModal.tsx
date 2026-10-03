import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Lightbulb,
  MessageCircle,
  Sliders,
  TrendingUp,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { guardExport } from "@/shared/lib/demoExportGuard";
import {
  LocalRecommendationsPanel,
  MarginPanel,
  SalesPitchPanel,
  type MaterialProfile,
} from "./AIAssistantPanels";

interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

type AssistantTab = "tech" | "pitch" | "finance";

export function AIAssistantModal({ open, onClose }: AIAssistantModalProps) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const calcStore = useCalculatorStore();
  const results = calcStore.results;
  const [activeTab, setActiveTab] = useState<AssistantTab>("tech");
  const [copiedPitch, setCopiedPitch] = useState(false);

  const suggestedPriceFormatted = results
    ? format(results.sellPrice)
    : "R$ 42,27";
  const costFormatted = results ? format(results.totalCost) : "R$ 18,18";
  const materialType =
    (calcStore.activeTab === "fdm"
      ? calcStore.fdmMaterial?.type
      : calcStore.resinMaterial?.type) || "pla";
  const printHours = calcStore.fdmPrintParams?.printTimeHours ?? 0;
  const printMinutes = Math.round(printHours * 60) % 60;
  const printWeight = calcStore.fdmMaterial?.weightUsed ?? 50;
  const targetMargin = calcStore.fdmSales?.profitMarginPercent ?? 100;
  const productName = calcStore.productName || "Peça 3D";

  const materialProfile = useMemo<MaterialProfile>(() => {
    const material = materialType.toLowerCase();
    if (material.includes("petg")) {
      return {
        name: "PETG",
        nozzleTemp: "230°C - 245°C",
        bedTemp: "70°C - 80°C",
        infillOptimal: "15% - 25% Gyroid",
        warpingRisk: "Médio",
        warpingColor: "text-amber-400",
        tips: "Evite resfriamento excessivo para máxima adesão intercamadas. Use spray adesivo ou PEI texturizado.",
      };
    }
    if (material.includes("abs") || material.includes("asa")) {
      return {
        name: "ABS / ASA",
        nozzleTemp: "240°C - 260°C",
        bedTemp: "95°C - 110°C",
        infillOptimal: "20% - 30% Honeycomb",
        warpingRisk: "Alto (Crítico)",
        warpingColor: "text-red-400",
        tips: "Gabinete fechado recomendado. Pré-aqueça a câmara antes de iniciar.",
      };
    }
    if (material.includes("tpu")) {
      return {
        name: "TPU Flexível",
        nozzleTemp: "215°C - 230°C",
        bedTemp: "40°C - 55°C",
        infillOptimal: "10% - 18% Concêntrico",
        warpingRisk: "Baixo",
        warpingColor: "text-emerald-400",
        tips: "Imprima em baixa velocidade. Reduza a retração para evitar entupimento.",
      };
    }
    if (material.includes("silk") || material.includes("pla")) {
      return {
        name: "PLA / Silk",
        nozzleTemp: "200°C - 215°C",
        bedTemp: "50°C - 60°C",
        infillOptimal: "12% - 20% Gyroid",
        warpingRisk: "Muito Baixo",
        warpingColor: "text-emerald-400",
        tips: "Boa estabilidade dimensional. Garanta ventilação de peça após as primeiras camadas.",
      };
    }
    return {
      name: materialType.toUpperCase(),
      nozzleTemp: "210°C - 230°C",
      bedTemp: "60°C",
      infillOptimal: "15% - 20%",
      warpingRisk: "Moderado",
      warpingColor: "text-blue-400",
      tips: "Calibre uma torre de temperatura para este filamento técnico.",
    };
  }, [materialType]);

  const hourlyProfit =
    printHours > 0 && results ? results.profit / printHours : 0;
  const breakEvenUnits =
    results && results.profit > 0 ? Math.ceil(2500 / results.profit) : 0;
  const commercialPitch = useMemo(
    () =>
      `Olá! Segue a proposta detalhada para produção da peça *${productName}*:\n\n` +
      `• *Tecnologia & Material:* Manufatura Aditiva FDM em ${materialProfile.name} de alta performance\n` +
      `• *Peso Estimado:* ${printWeight}g com preenchimento estrutural reforçado\n` +
      `• *Tempo de Produção Dedicado:* ${printHours}h ${printMinutes}m de impressão de alta precisão\n` +
      `• *Investimento Total:* *${suggestedPriceFormatted}*\n\n` +
      `✓ Inclui acabamento técnico, remoção de suportes e garantia de tolerância dimensional.\n` +
      `Podemos aprovar o início da produção agora?`,
    [
      materialProfile.name,
      printHours,
      printMinutes,
      printWeight,
      productName,
      suggestedPriceFormatted,
    ],
  );

  const handleCopyPitch = () => {
    if (guardExport()) return;
    void navigator.clipboard.writeText(commercialPitch);
    setCopiedPitch(true);
    window.setTimeout(() => setCopiedPitch(false), 2500);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const tabs: AssistantTab[] = ["tech", "pitch", "finance"];
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextTabIndex =
      (tabs.indexOf(activeTab) + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextTabIndex];
    setActiveTab(nextTab);
    document.getElementById(`copilot-tab-${nextTab}`)?.focus();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-md sm:p-5">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-modal-title"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="my-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0b1120] text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#1e293b] bg-[#080d19] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30">
              <Lightbulb
                className="h-4 w-4 text-amber-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="copilot-modal-title"
                  className="text-sm font-bold tracking-tight text-white"
                >
                  {t("copilot.title")}
                </h2>
                <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-200">
                  {t("copilot.localBadge")}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                {t("copilot.project")} {productName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("copilot.close")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label={t("copilot.tabsLabel")}
          className="no-scrollbar flex items-center overflow-x-auto border-b border-[#1e293b] bg-[#070b14] px-4 text-xs"
        >
          <button
            type="button"
            id="copilot-tab-tech"
            role="tab"
            aria-selected={activeTab === "tech"}
            aria-controls="copilot-panel-tech"
            tabIndex={activeTab === "tech" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setActiveTab("tech")}
            className={`flex whitespace-nowrap items-center gap-1.5 border-b-2 px-3 py-3 font-semibold transition-colors ${activeTab === "tech" ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <Sliders className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
            {t("copilot.technicalTab")}
          </button>
          <button
            type="button"
            id="copilot-tab-pitch"
            role="tab"
            aria-selected={activeTab === "pitch"}
            aria-controls="copilot-panel-pitch"
            tabIndex={activeTab === "pitch" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setActiveTab("pitch")}
            className={`flex whitespace-nowrap items-center gap-1.5 border-b-2 px-3 py-3 font-semibold transition-colors ${activeTab === "pitch" ? "border-emerald-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <MessageCircle
              className="h-3.5 w-3.5 text-emerald-400"
              aria-hidden="true"
            />
            {t("copilot.pitchTab")}
          </button>
          <button
            type="button"
            id="copilot-tab-finance"
            role="tab"
            aria-selected={activeTab === "finance"}
            aria-controls="copilot-panel-finance"
            tabIndex={activeTab === "finance" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setActiveTab("finance")}
            className={`flex whitespace-nowrap items-center gap-1.5 border-b-2 px-3 py-3 font-semibold transition-colors ${activeTab === "finance" ? "border-amber-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            <TrendingUp
              className="h-3.5 w-3.5 text-amber-400"
              aria-hidden="true"
            />
            {t("copilot.financeTab")}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-xs leading-relaxed">
          {activeTab === "tech" && (
            <LocalRecommendationsPanel profile={materialProfile} />
          )}
          {activeTab === "pitch" && (
            <SalesPitchPanel
              pitch={commercialPitch}
              price={suggestedPriceFormatted}
              copied={copiedPitch}
              onCopy={handleCopyPitch}
            />
          )}
          {activeTab === "finance" && (
            <MarginPanel
              cost={costFormatted}
              margin={targetMargin}
              price={suggestedPriceFormatted}
              hourlyProfit={hourlyProfit}
              breakEvenUnits={breakEvenUnits}
              format={format}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#1e293b] bg-[#080d19] px-5 py-3 text-xs text-slate-300">
          <p className="flex items-center gap-1.5">
            <Activity
              className="h-3.5 w-3.5 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span>{t("copilot.localDisclosure")}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("copilot.closeButton")}
            className="shrink-0 rounded-lg bg-slate-800 px-4 py-1.5 font-medium text-white hover:bg-slate-700"
          >
            {t("copilot.closeButton")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
