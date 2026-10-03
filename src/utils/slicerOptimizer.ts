import { InfillPattern, MaterialType, PrintCalculationData } from "../types";

export interface SlicerOptimizationProfile {
  id: string;
  name: string;
  category:
    | "miniatures"
    | "functional"
    | "rapid_proto"
    | "decor"
    | "enclosure"
    | "flexible";
  badge: string;
  badgeColor: string;
  description: string;
  recommendedMaterial: MaterialType[];
  layerHeightMm: number;
  infillPercent: number;
  infillPattern: InfillPattern;
  wallLoops: number;
  topBottomLayers: number;
  speedMultiplier: number;
  timeSavingPercent: number;
  materialSavingPercent: number;
  failureRiskReductionPercent: number;
  historicalSuccessRate: number;
  strengthRating: number; // 1 to 5 stars
  speedRating: number; // 1 to 5 stars
  surfaceQualityRating: number; // 1 to 5 stars
  keyAdvantages: string[];
}

export const SLICER_OPTIMIZATION_PROFILES: SlicerOptimizationProfile[] = [
  {
    id: "miniatures-detail",
    name: "Miniaturas & Alta Definição",
    category: "miniatures",
    badge: "Ultra Detalhe",
    badgeColor: "text-purple-300 bg-purple-950/60 border-purple-500/40",
    description:
      "Camadas ultra-finas e preenchimento giroide leve para sumir com linhas de camadas e preservar micro-relevos.",
    recommendedMaterial: ["Resina Standard", "Resina Tough", "PLA", "PLA Silk"],
    layerHeightMm: 0.1,
    infillPercent: 15,
    infillPattern: "gyroid",
    wallLoops: 3,
    topBottomLayers: 5,
    speedMultiplier: 0.75,
    timeSavingPercent: -15, // Prioritizes surface finish over speed
    materialSavingPercent: 18,
    failureRiskReductionPercent: 25,
    historicalSuccessRate: 97.4,
    strengthRating: 3,
    speedRating: 2,
    surfaceQualityRating: 5,
    keyAdvantages: [
      "Costuras quase invisíveis e sem efeito escada",
      "Remoção de suportes arborescentes sem marcas",
      "Excelente resposta em tintas e primers",
    ],
  },
  {
    id: "functional-heavy",
    name: "Peças Mecânicas & Alta Carga",
    category: "functional",
    badge: "Resistência Máxima",
    badgeColor: "text-amber-300 bg-amber-950/60 border-amber-500/40",
    description:
      "Parede reforçada (4 perímetros) combinada com Infill Honeycomb 45% para tração e resistência multidirecional.",
    recommendedMaterial: ["PETG", "ABS", "Nylon (PA)", "ASA"],
    layerHeightMm: 0.2,
    infillPercent: 45,
    infillPattern: "honeycomb",
    wallLoops: 4,
    topBottomLayers: 5,
    speedMultiplier: 0.9,
    timeSavingPercent: 12,
    materialSavingPercent: 8,
    failureRiskReductionPercent: 35,
    historicalSuccessRate: 98.8,
    strengthRating: 5,
    speedRating: 3,
    surfaceQualityRating: 4,
    keyAdvantages: [
      "4 paredes garantem absorção de torque e roscas",
      "Padrão hexagonal dissipa tensões mecânicas",
      "Resistência superior a impacto e fadiga térmica",
    ],
  },
  {
    id: "rapid-draft",
    name: "Protótipo Rápido & Validação",
    category: "rapid_proto",
    badge: "Super Rápido",
    badgeColor: "text-emerald-300 bg-emerald-950/60 border-emerald-500/40",
    description:
      "Camada de 0.28mm e Infill Grid 12% para cortar o tempo pela metade em validações dimensionais e de encaixe.",
    recommendedMaterial: ["PLA", "PETG", "ABS"],
    layerHeightMm: 0.28,
    infillPercent: 12,
    infillPattern: "grid",
    wallLoops: 2,
    topBottomLayers: 3,
    speedMultiplier: 1.45,
    timeSavingPercent: 48,
    materialSavingPercent: 32,
    failureRiskReductionPercent: 20,
    historicalSuccessRate: 99.2,
    strengthRating: 2,
    speedRating: 5,
    surfaceQualityRating: 3,
    keyAdvantages: [
      "Redução de até 50% nas horas de extrusão",
      "Consumo mínimo de filamento para teste de encaixe",
      "Liberação rápida da impressora para a fila de produção",
    ],
  },
  {
    id: "decor-vase",
    name: "Decorativo & Modo Vaso / Luminária",
    category: "decor",
    badge: "Elegância & Fluidez",
    badgeColor: "text-cyan-300 bg-cyan-950/60 border-cyan-500/40",
    description:
      "Camada de 0.16mm com padrão cúbico balanceado ou extrusão espiralizada contínua sem retração.",
    recommendedMaterial: ["PLA Silk", "PLA", "PETG"],
    layerHeightMm: 0.16,
    infillPercent: 18,
    infillPattern: "cubic",
    wallLoops: 3,
    topBottomLayers: 4,
    speedMultiplier: 1.1,
    timeSavingPercent: 22,
    materialSavingPercent: 25,
    failureRiskReductionPercent: 28,
    historicalSuccessRate: 98.1,
    strengthRating: 3,
    speedRating: 4,
    surfaceQualityRating: 5,
    keyAdvantages: [
      "Efeito sedoso e reflexivo brilhante em PLA Silk",
      "Sem linhas de costura visíveis (Z-Seam oculta)",
      "Perfeita estanqueidade para vasos e cachepôs",
    ],
  },
  {
    id: "enclosure-box",
    name: "Gabinete & Caixas Eletrônicas IP",
    category: "enclosure",
    badge: "Dimensional Preciso",
    badgeColor: "text-blue-300 bg-blue-950/60 border-blue-500/40",
    description:
      "Camada de 0.20mm com 3 paredes e infill Giroide 25% para ancoragem sólida de insertos de latão roscados.",
    recommendedMaterial: ["PETG", "ABS", "ASA"],
    layerHeightMm: 0.2,
    infillPercent: 25,
    infillPattern: "gyroid",
    wallLoops: 3,
    topBottomLayers: 4,
    speedMultiplier: 1.0,
    timeSavingPercent: 18,
    materialSavingPercent: 15,
    failureRiskReductionPercent: 30,
    historicalSuccessRate: 99.0,
    strengthRating: 4,
    speedRating: 4,
    surfaceQualityRating: 4,
    keyAdvantages: [
      "Tolerância milimétrica perfeita para encaixes Snap-Fit",
      "Suporte para inserção a quente de buchas M3/M4",
      "Boa dissipação térmica para placas PCB e fontes",
    ],
  },
  {
    id: "tpu-flex",
    name: "Flexível & Absorção de Choque",
    category: "flexible",
    badge: "Flexível 95A",
    badgeColor: "text-orange-300 bg-orange-950/60 border-orange-500/40",
    description:
      "Velocidade reduzida para filamentos flexíveis com infill concêntrico para memória elástica uniforme.",
    recommendedMaterial: ["TPU"],
    layerHeightMm: 0.2,
    infillPercent: 25,
    infillPattern: "concentric",
    wallLoops: 3,
    topBottomLayers: 4,
    speedMultiplier: 0.65,
    timeSavingPercent: 5,
    materialSavingPercent: 10,
    failureRiskReductionPercent: 40,
    historicalSuccessRate: 96.5,
    strengthRating: 4,
    speedRating: 2,
    surfaceQualityRating: 4,
    keyAdvantages: [
      "Fluxo constante sem entupimento na garganta",
      "Propriedades elásticas isotrópicas",
      "Não delamina mesmo sob torção contínua",
    ],
  },
];

export interface SlicerOptimizationAnalysis {
  efficiencyScore: number;
  identifiedCategory: string;
  matchedProfile: SlicerOptimizationProfile;
  recommendations: Array<{
    type: "layer" | "infill" | "pattern" | "speed" | "risk";
    title: string;
    description: string;
    action: string;
    potentialSaving: string;
  }>;
  savingsSummary: {
    timeEstimateMinutes: number;
    weightEstimateGrams: number;
    costSavingEstimated: number;
  };
}

export function analyzeSlicerParameters(
  currentData: PrintCalculationData,
): SlicerOptimizationAnalysis {
  const currentLayer = currentData.layerHeightMm || 0.2;
  const currentInfill = currentData.infillPercent || 20;
  const currentPattern = currentData.infillPattern || "gyroid";
  const mat = currentData.materialType;
  const name = (currentData.projectName || "").toLowerCase();

  // Deduce model category
  let matchedProfile = SLICER_OPTIMIZATION_PROFILES[1]; // default functional
  if (mat === "TPU" || name.includes("tpu") || name.includes("flex")) {
    matchedProfile = SLICER_OPTIMIZATION_PROFILES.find(
      (p) => p.id === "tpu-flex",
    )!;
  } else if (
    mat.includes("Resina") ||
    name.includes("miniatura") ||
    name.includes("dragon") ||
    name.includes("rpg") ||
    name.includes("trofeu")
  ) {
    matchedProfile = SLICER_OPTIMIZATION_PROFILES.find(
      (p) => p.id === "miniatures-detail",
    )!;
  } else if (
    name.includes("vaso") ||
    name.includes("luminaria") ||
    name.includes("decor") ||
    mat === "PLA Silk"
  ) {
    matchedProfile = SLICER_OPTIMIZATION_PROFILES.find(
      (p) => p.id === "decor-vase",
    )!;
  } else if (
    name.includes("case") ||
    name.includes("gabinete") ||
    name.includes("caixa") ||
    name.includes("ip65")
  ) {
    matchedProfile = SLICER_OPTIMIZATION_PROFILES.find(
      (p) => p.id === "enclosure-box",
    )!;
  } else if (
    name.includes("prototipo") ||
    name.includes("teste") ||
    name.includes("rascunho") ||
    name.includes("draft")
  ) {
    matchedProfile = SLICER_OPTIMIZATION_PROFILES.find(
      (p) => p.id === "rapid-draft",
    )!;
  }

  // Calculate efficiency score (100 is optimal)
  let score = 100;
  const recommendations: SlicerOptimizationAnalysis["recommendations"] = [];

  // Infill check
  if (currentInfill > matchedProfile.infillPercent + 15) {
    score -= 18;
    const diff = currentInfill - matchedProfile.infillPercent;
    recommendations.push({
      type: "infill",
      title: "Densidade de Preenchimento Redundante",
      description: `Seu preenchimento atual é ${currentInfill}%. Para a categoria "${matchedProfile.name}", ${matchedProfile.infillPercent}% é comprovadamente suficiente mantendo 95% da rigidez.`,
      action: `Reduzir preenchimento para ${matchedProfile.infillPercent}%`,
      potentialSaving: `Economia estimada de ~${Math.round(diff * 0.8)}g de material`,
    });
  } else if (
    currentInfill < matchedProfile.infillPercent - 15 &&
    matchedProfile.category === "functional"
  ) {
    score -= 15;
    recommendations.push({
      type: "infill",
      title: "Preenchimento Baixo para Peça Funcional",
      description: `Peças mecânicas sofrem delaminação se impressas com menos de 30% de infill.`,
      action: `Aumentar preenchimento para ${matchedProfile.infillPercent}%`,
      potentialSaving: "Previne quebras e retrabalho na oficina",
    });
  }

  // Infill pattern check
  if (
    currentPattern === "grid" &&
    (matchedProfile.category === "functional" ||
      matchedProfile.category === "enclosure")
  ) {
    score -= 12;
    recommendations.push({
      type: "pattern",
      title: "Padrão Grid Apresenta Cruzamento de Bico",
      description:
        "O padrão Grid força o bico a passar por cima da mesma linha no mesmo plano, aumentando vibrações e ruídos. O padrão Giroide elimina colisões.",
      action: "Mudar padrão para Giroide (Gyroid)",
      potentialSaving: "Reduz risco de descolamento de mesa em 25%",
    });
  }

  // Layer height check
  if (matchedProfile.category === "miniatures" && currentLayer > 0.16) {
    score -= 20;
    recommendations.push({
      type: "layer",
      title: "Altura de Camada Muito Grossa para Miniaturas",
      description: `Camada atual de ${currentLayer}mm deixará degraus visíveis. O perfil otimizado usa ${matchedProfile.layerHeightMm}mm.`,
      action: `Ajustar altura de camada para ${matchedProfile.layerHeightMm}mm`,
      potentialSaving: "Acabamento fotográfico sem lixamento",
    });
  } else if (matchedProfile.category === "rapid_proto" && currentLayer < 0.24) {
    score -= 15;
    recommendations.push({
      type: "layer",
      title: "Oportunidade de Ganho de Velocidade",
      description: `Para protótipo rápido, aumentar a camada para ${matchedProfile.layerHeightMm}mm reduz o tempo quase pela metade.`,
      action: `Aumentar camada para ${matchedProfile.layerHeightMm}mm`,
      potentialSaving: "Economiza até 40% das horas de máquina",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "risk",
      title: "Parâmetros Já Estão em Harmonia Ideal",
      description:
        "Sua configuração de fatiador coincide com os melhores padrões históricos de sucesso da oficina.",
      action:
        "Perfil altamente recomendado para envio imediato à fila de impressão",
      potentialSaving: "Máxima eficiência assegurada",
    });
  }

  const currentTotalHours =
    (currentData.printTimeHours || 0) +
    (currentData.printTimeMinutes || 0) / 60;
  const timeEstimateMinutes = Math.max(
    0,
    Math.round(
      currentTotalHours * (matchedProfile.timeSavingPercent / 100) * 60,
    ),
  );
  const weightEstimateGrams = Math.max(
    0,
    Math.round(
      (currentData.printWeightGrams || 50) *
        (matchedProfile.materialSavingPercent / 100),
    ),
  );
  const costSavingEstimated =
    weightEstimateGrams * 0.12 + (timeEstimateMinutes / 60) * 1.5;

  return {
    efficiencyScore: Math.max(20, Math.min(100, score)),
    identifiedCategory: matchedProfile.name,
    matchedProfile,
    recommendations,
    savingsSummary: {
      timeEstimateMinutes,
      weightEstimateGrams,
      costSavingEstimated,
    },
  };
}
