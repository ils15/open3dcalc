import { useState, useMemo } from "react";
import {
  Sparkles,
  X,
  Key,
  Check,
  AlertTriangle,
  Copy,
  ExternalLink,
  Sliders,
  TrendingUp,
  MessageCircle,
  Eye,
  EyeOff,
  Flame,
  Activity,
  RefreshCw,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";

export const GEMINI_API_KEY_STORAGE = "open3dcalc_gemini_api_key";

interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

export function AIAssistantModal({ open, onClose }: AIAssistantModalProps) {
  const { format } = useCurrency();
  const calcStore = useCalculatorStore();
  const results = calcStore.results;

  // Stored API key. Read lazily at mount instead of in an effect: the modal
  // returns null while closed, so the stored value is already current by the
  // time anything renders, and this keeps setState out of the effect body.
  const readStoredKey = (): string =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem(GEMINI_API_KEY_STORAGE) || "";
  const [apiKey, setApiKey] = useState<string>(readStoredKey);
  const [keyInput, setKeyInput] = useState<string>(readStoredKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [keySavedToast, setKeySavedToast] = useState<boolean>(false);
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);

  // Active tab inside modal
  const [activeTab, setActiveTab] = useState<
    "tech" | "pitch" | "finance" | "config"
  >("tech");

  // Gemini loading and generated state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Key testing state
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const hasApiKey = Boolean(apiKey && apiKey.trim().length > 10);

  // Financial values
  const suggestedPriceFormatted = results
    ? format(results.sellPrice)
    : "R$ 42,27";
  const costFormatted = results ? format(results.totalCost) : "R$ 18,18";
  const profitFormatted = results ? format(results.profit) : "R$ 24,09";
  const materialType =
    (calcStore?.activeTab === "fdm"
      ? calcStore?.fdmMaterial?.type
      : calcStore?.resinMaterial?.type) || "pla";
  // The store keeps print time as decimal hours and weight as `weightUsed`.
  const printHours = calcStore?.fdmPrintParams?.printTimeHours ?? 0;
  const printMinutes = Math.round(printHours * 60) % 60;
  const printWeight = calcStore?.fdmMaterial?.weightUsed ?? 50;
  const targetMargin = calcStore?.fdmSales?.profitMarginPercent ?? 100;
  const productName = calcStore?.productName || "Peça 3D";

  // Material thermal profiles (heuristic)
  const materialProfile = useMemo(() => {
    const mat = materialType.toLowerCase();
    if (mat.includes("petg")) {
      return {
        name: "PETG",
        nozzleTemp: "230°C - 245°C",
        bedTemp: "70°C - 80°C",
        fanSpeed: "30% - 50%",
        printSpeed: "40 - 60 mm/s",
        retraction: "2.5 - 4.5 mm (Direct: 0.8 - 1.2 mm)",
        infillOptimal: "15% - 25% Gyroid",
        warpingRisk: "Médio",
        warpingColor: "text-amber-400",
        tips: "Evite resfriamento excessivo para máxima adesão intercamadas. Use spray adesivo ou PEI texturizado.",
      };
    } else if (mat.includes("abs") || mat.includes("asa")) {
      return {
        name: "ABS / ASA",
        nozzleTemp: "240°C - 260°C",
        bedTemp: "95°C - 110°C",
        fanSpeed: "0% - 15%",
        printSpeed: "40 - 55 mm/s",
        retraction: "2.0 - 3.5 mm",
        infillOptimal: "20% - 30% Honeycomb",
        warpingRisk: "Alto (Crítico)",
        warpingColor: "text-red-400",
        tips: "Chamber (gabinete fechado) obrigatório. Pré-aqueça a câmara por 15 minutos antes de iniciar.",
      };
    } else if (mat.includes("tpu")) {
      return {
        name: "TPU Flexível",
        nozzleTemp: "215°C - 230°C",
        bedTemp: "40°C - 55°C",
        fanSpeed: "50% - 100%",
        printSpeed: "20 - 35 mm/s",
        retraction: "Desativar ou máx 1.0 mm lenta",
        infillOptimal: "10% - 18% Concéntrico",
        warpingRisk: "Baixo",
        warpingColor: "text-emerald-400",
        tips: "Imprima em baixa velocidade. Desative a retração para evitar entupimento na engrenagem do tracionador.",
      };
    } else if (mat.includes("silk") || mat.includes("pla")) {
      return {
        name: "PLA / Silk",
        nozzleTemp: "200°C - 215°C",
        bedTemp: "50°C - 60°C",
        fanSpeed: "100%",
        printSpeed: "50 - 100 mm/s",
        retraction: "4.0 - 6.0 mm (Bowden) / 0.8 - 1.2 mm (Direct)",
        infillOptimal: "12% - 20% Gyroid",
        warpingRisk: "Muito Baixo",
        warpingColor: "text-emerald-400",
        tips: "Excelente estabilidade dimensional. Garanta ventilação máxima de peça após as 3 primeiras camadas.",
      };
    }
    return {
      name: materialType.toUpperCase(),
      nozzleTemp: "210°C - 230°C",
      bedTemp: "60°C",
      fanSpeed: "80%",
      printSpeed: "50 mm/s",
      retraction: "3.0 mm",
      infillOptimal: "15% - 20%",
      warpingRisk: "Moderado",
      warpingColor: "text-blue-400",
      tips: "Realize calibração de torre de temperatura prévia para este filamento técnico.",
    };
  }, [materialType]);

  // Hourly profit & Break-Even calculation
  const totalHours = printHours + printMinutes / 60;
  const hourlyProfit =
    totalHours > 0 && results ? results.profit / totalHours : 0;
  const breakEvenUnits =
    results && results.profit > 0 ? Math.ceil(2500 / results.profit) : 0;

  // Commercial Pitch Text
  const commercialPitch = useMemo(() => {
    const item = productName || "Peça Sob Medida 3D";
    return (
      `Olá! Segue a proposta detalhada para produção da peça *${item}*:\n\n` +
      `• *Tecnologia & Material:* Manufatura Aditiva FDM em ${materialProfile.name} de alta performance\n` +
      `• *Peso Estimado:* ${printWeight}g com preenchimento estrutural reforçado\n` +
      `• *Tempo de Produção Dedicado:* ${printHours}h ${printMinutes}m de impressão de alta precisão\n` +
      `• *Investimento Total:* *${suggestedPriceFormatted}*\n\n` +
      `✓ Inclui acabamento técnico, remoção de suportes e garantia de tolerância dimensional.\n` +
      `Podemos aprovar o início da produção agora?`
    );
  }, [
    productName,
    materialProfile.name,
    printWeight,
    printHours,
    printMinutes,
    suggestedPriceFormatted,
  ]);

  // Save / Clear Key Handlers
  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (trimmed) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, trimmed);
      setApiKey(trimmed);
      setKeySavedToast(true);
      setTestResult(null);
      setTimeout(() => setKeySavedToast(false), 3000);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    setApiKey("");
    setKeyInput("");
    setGeminiResponse(null);
    setTestResult(null);
  };

  // Test Gemini Key Connection
  const handleTestKey = async () => {
    const keyToTest = keyInput.trim() || apiKey.trim();
    if (!keyToTest) {
      setTestResult({
        success: false,
        message: "Insira uma chave antes de testar.",
      });
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keyToTest}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: "Teste de conexão. Responda apenas: OK" }] },
            ],
            generationConfig: { maxOutputTokens: 10 },
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Erro HTTP ${res.status}`);
      }

      setTestResult({
        success: true,
        message:
          "Chave válida! Conexão com o Google Gemini 2.5 Flash estabelecida com sucesso.",
      });
      // Auto-save if working
      localStorage.setItem(GEMINI_API_KEY_STORAGE, keyToTest);
      setApiKey(keyToTest);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Falha ao validar chave.";
      setTestResult({
        success: false,
        message: `Falha na conexão: ${msg}`,
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Call Gemini API if Key is present
  const handleGenerateGemini = async () => {
    if (!hasApiKey) {
      setActiveTab("config");
      return;
    }

    setIsGenerating(true);
    setGeminiError(null);
    setGeminiResponse(null);

    const prompt = `Você é um Engenheiro Sênior especialista em Manufatura Aditiva e Impressão 3D industrial.
Analise os seguintes dados do projeto atual:
- Nome da Peça: ${productName || "Peça 3D Técnica"}
- Material: ${materialType}
- Peso: ${printWeight}g
- Tempo de Impressão: ${printHours}h ${printMinutes}min
- Custo Fabril: ${costFormatted}
- Preço de Venda Sugerido: ${suggestedPriceFormatted}
- Lucro Estimado: ${profitFormatted}
- Margem Alvo: ${targetMargin}%

Forneça uma análise prática dividida estritamente nestes 3 pontos:
1. RECOMENDAÇÃO DE FATIAMENTO: Velocidade, temperatura, orientação de camada e padrão de preenchimento (infill) para máxima resistência e menor tempo.
2. ANÁLISE DE CUSTOS & MARGEM: Avaliação se o preço está competitivo e se a margem de lucro por hora de máquina é saudável.
3. ARGUMENTO DE VENDA PARA O CLIENTE: Como valorizar a tecnologia 3D perante o cliente para fechar a proposta sem dar descontos.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 1000,
            },
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setGeminiResponse(text);
      } else {
        throw new Error("Resposta da IA vazia.");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Falha ao conectar à API do Gemini.";
      setGeminiError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(commercialPitch);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md select-none overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0b1120] border border-[#1e293b] rounded-2xl w-full max-w-2xl text-slate-100 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e293b] bg-[#080d19]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-900/30">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Copilot IA • Engenharia & Negócios 3D
                </h3>
                {hasApiKey ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold">
                    Gemini 2.5 Flash
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                    Modo Local (Chave Opcional)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Projeto:{" "}
                <span className="text-slate-200 font-semibold">
                  {productName}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#1e293b] bg-[#070b14] px-4 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("tech")}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === "tech"
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            Análise Técnica & Fatiamento
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pitch")}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === "pitch"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            Pitch de Vendas & WhatsApp
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("finance")}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === "finance"
                ? "border-amber-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            Diagnóstico de Margem
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ml-auto ${
              activeTab === "config"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            Chave Gemini {hasApiKey && "✓"}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {/* TAB 1: TECHNICAL SLICER & PRINT ANALYSIS */}
          {activeTab === "tech" && (
            <div className="space-y-4">
              {/* Optional Gemini Real-Time Generator Banner */}
              <div className="p-3.5 rounded-xl border border-blue-900/40 bg-blue-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-blue-300">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Análise com Inteligência Artificial Gemini</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {hasApiKey
                      ? "Chave Gemini conectada. Clique para gerar análise profunda da peça."
                      : "A chave Gemini é opcional. Configure na aba 'Chave Gemini' para análises generativas personalizadas."}
                  </p>
                </div>
                {hasApiKey ? (
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleGenerateGemini}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`}
                    />
                    {isGenerating ? "Analisando..." : "Gerar com IA"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab("config")}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-900/30 font-semibold"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Adicionar Chave (Opcional)
                  </button>
                )}
              </div>

              {/* Error display if any */}
              {geminiError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
                  {geminiError}
                </div>
              )}

              {/* Gemini Generated Output if available */}
              {geminiResponse && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-[#070b14] space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    Diagnóstico Gerado pelo Google Gemini
                  </div>
                  <div className="whitespace-pre-wrap text-slate-200 text-xs leading-relaxed font-sans bg-[#0c1322] p-3 rounded-lg border border-slate-800">
                    {geminiResponse}
                  </div>
                </div>
              )}

              {/* Slicing & Engineering Presets Card */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-400">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Parâmetros Térmicos & Fatiamento Recomendados (
                  {materialProfile.name})
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#080d19] border border-[#1e293b]">
                    <span className="text-slate-500 text-[10px] block uppercase font-mono">
                      Bico / Nozzle
                    </span>
                    <strong className="text-white font-bold text-xs">
                      {materialProfile.nozzleTemp}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#080d19] border border-[#1e293b]">
                    <span className="text-slate-500 text-[10px] block uppercase font-mono">
                      Mesa / Bed
                    </span>
                    <strong className="text-white font-bold text-xs">
                      {materialProfile.bedTemp}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#080d19] border border-[#1e293b]">
                    <span className="text-slate-500 text-[10px] block uppercase font-mono">
                      Preenchimento
                    </span>
                    <strong className="text-emerald-400 font-bold text-xs">
                      {materialProfile.infillOptimal}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#080d19] border border-[#1e293b]">
                    <span className="text-slate-500 text-[10px] block uppercase font-mono">
                      Risco de Warping
                    </span>
                    <strong
                      className={`font-bold text-xs ${materialProfile.warpingColor}`}
                    >
                      {materialProfile.warpingRisk}
                    </strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#080d19] border border-[#1e293b] space-y-1">
                  <strong className="text-slate-300 font-semibold block text-[11px]">
                    Dica de Processo:
                  </strong>
                  <p className="text-slate-400 text-xs">
                    {materialProfile.tips}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMERCIAL PITCH & WHATSAPP */}
          {activeTab === "pitch" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-400">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Proposta Pronta para WhatsApp & Negociação
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Texto estratégico formatado com argumentos de valor, tempo de
                  máquina e garantia:
                </p>
              </div>

              <div className="relative">
                <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl text-xs font-mono whitespace-pre-wrap text-emerald-300 leading-relaxed max-h-56 overflow-y-auto">
                  {commercialPitch}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPitch}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 shadow"
                >
                  {copiedPitch ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedPitch ? "Copiado!" : "Copiar"}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Valor orçado:{" "}
                  <strong className="text-white">
                    {suggestedPriceFormatted}
                  </strong>
                </span>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(commercialPitch)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  Abrir no WhatsApp
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL DIAGNOSTIC */}
          {activeTab === "finance" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-1">
                <strong className="text-blue-300 font-semibold flex items-center gap-1 text-xs">
                  <Activity className="w-4 h-4" />
                  Diagnóstico de Viabilidade Econômica
                </strong>
                <p className="text-slate-300 text-xs">
                  Para cobrir o custo de produção de{" "}
                  <strong className="text-white">{costFormatted}</strong> com
                  margem de{" "}
                  <strong className="text-emerald-400">{targetMargin}%</strong>,
                  o preço sugerido é{" "}
                  <strong className="text-white">
                    {suggestedPriceFormatted}
                  </strong>
                  .
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#080d19] border border-[#1e293b] space-y-1">
                  <span className="text-slate-400 text-[11px]">
                    Retorno por Hora de Máquina:
                  </span>
                  <div className="text-lg font-bold text-emerald-400">
                    {format(hourlyProfit)}/h
                  </div>
                  <p className="text-slate-500 text-[10px]">
                    {hourlyProfit >= 15
                      ? "✓ Margem horária saudável acima da média de mercado (R$ 15/h)."
                      : "Atenção: Margem horária apertada para peças longas."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#080d19] border border-[#1e293b] space-y-1">
                  <span className="text-slate-400 text-[11px]">
                    Break-Even da Impressora:
                  </span>
                  <div className="text-lg font-bold text-blue-400">
                    {breakEvenUnits > 0 ? `${breakEvenUnits} peças` : "N/A"}
                  </div>
                  <p className="text-slate-500 text-[10px]">
                    Quantidade deste projeto necessária para pagar o valor de
                    aquisição da máquina.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPTIONAL GEMINI CONFIGURATION (BYOK) */}
          {activeTab === "config" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#080d19] border border-[#1e293b] space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                  <Key className="w-4 h-4" />
                  Configuração da Chave Google Gemini (Opcional)
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  A chave de API é <strong>100% opcional</strong>. O Open3DCalc
                  funciona perfeitamente sem ela, calculando custos, fatiamento
                  e propostas com o motor local.
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Ao inserir sua chave do Google AI Studio, a análise ganha
                  inteligência generativa profunda, adaptada ao seu nicho. Sua
                  chave fica salva exclusivamente no seu próprio navegador
                  (localStorage).
                </p>
              </div>

              {keySavedToast && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  Chave salva com sucesso no navegador!
                </div>
              )}

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-start gap-1.5 ${
                    testResult.success
                      ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                      : "bg-red-950/80 border-red-800 text-red-300"
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Chave de API Gemini (Google AI Studio)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? "text" : "password"}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20 font-mono"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1 text-slate-400 hover:text-white"
                      title={showKey ? "Ocultar" : "Mostrar"}
                    >
                      {showKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 text-[11px] font-medium"
                >
                  Obter chave gratuita no Google AI Studio
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      isTestingKey || (!keyInput.trim() && !apiKey.trim())
                    }
                    onClick={handleTestKey}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-indigo-300 hover:bg-indigo-950/40 border border-indigo-700/50 disabled:opacity-40 flex items-center gap-1"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isTestingKey ? "animate-spin" : ""}`}
                    />
                    {isTestingKey ? "Testando..." : "Testar Conexão"}
                  </button>

                  {hasApiKey && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/30 border border-red-800/40"
                    >
                      Remover Chave
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow"
                  >
                    Salvar Chave
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#1e293b] bg-[#080d19] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Chave opcional • Dados mantidos em segurança no seu dispositivo
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
