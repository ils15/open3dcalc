import {
  PrintJobRecord,
  PrintFailureCause,
  PrinterSuccessMetric,
} from "../types";
import { DEFAULT_PRINTERS } from "./presets";

export const FAILURE_CAUSE_LABELS: Record<
  PrintFailureCause,
  { label: string; description: string; suggestion: string }
> = {
  adhesion_warp: {
    label: "Descolamento de Mesa (Warping)",
    description: "Cantos da peça se contraíram e descolaram do leito aquecido.",
    suggestion:
      "Aumente temperatura da mesa em +5°C ou aplique fixador líquido na chapa PEI.",
  },
  nozzle_clog: {
    label: "Entupimento de Bico / Subextrusão",
    description:
      "Filamento travado no heatbreak ou bico entupido parcialmente.",
    suggestion:
      "Faça cold pull, verifique se a retração está excessiva e revise temperatura de fusão.",
  },
  layer_shift: {
    label: "Deslocamento de Camada (Layer Shift)",
    description:
      "Polias de correia pularam dentes ou houve colisão de bico com infill Grid.",
    suggestion:
      "Tensione correias XY para 150Hz e mude padrão de preenchimento para Gyroid.",
  },
  filament_runout: {
    label: "Filamento Quebrado / Carretel Travado",
    description:
      "Carretel com espiras sobrepostas ou filamento quebradiço por umidade.",
    suggestion:
      "Use sensor de filamento ativo e seque o filamento antes de impressões longas.",
  },
  stringing_blobs: {
    label: "Stringing Severo / Blobs",
    description:
      "Respingos acumulados que geraram colisão ou acabamento inutilizável.",
    suggestion: "Ative Z-hop de 0.4mm e reduza umidade do filamento na estufa.",
  },
  support_failure: {
    label: "Colapso / Queda de Suportes",
    description: "Torres finas de suporte tombaram em balanços acentuados.",
    suggestion:
      "Altere para árvore orgânica e aumente a largura da base de contato do suporte.",
  },
  dimensional_defect: {
    label: "Fora de Tolerância Dimensional",
    description:
      "Peça mecânica não encaixou devido a encolhimento de plástico.",
    suggestion:
      "Calibre o fluxo de parede (XY Hole / Contour compensation) no fatiador.",
  },
  resin_delamination: {
    label: "Descolamento de Resina no FEP",
    description:
      "Sucção excessiva no tanque de resina soltou o modelo da mesa.",
    suggestion:
      "Aumente o tempo de exposição das camadas de base e aplique PTFE no filme FEP.",
  },
  power_outage: {
    label: "Interrupção Elétrica / Queda de Energia",
    description:
      "Oscilação na rede elétrica desligou a máquina no meio da execução.",
    suggestion: "Instale nobreak senoidal na bancada de impressão.",
  },
  user_aborted: {
    label: "Cancelamento Manual pelo Operador",
    description:
      "Operador detectou parâmetros incorretos nos primeiros minutos.",
    suggestion:
      "Confira pré-visualização das 3 primeiras camadas no slicer antes de iniciar.",
  },
};

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

export const INITIAL_PRINT_JOBS: PrintJobRecord[] = [
  {
    id: "pj-p1s-01",
    projectName: "Suporte Articulado para Tablet & Monitor",
    clientName: "Studio Design Alpha",
    printerId: "bambu-p1s",
    timestamp: NOW - 0.2 * DAY,
    outcome: "sucesso",
    printTimeHours: 5.5,
    weightGrams: 280,
    materialType: "PETG",
    notes: "Impressão limpa, excelente camada superficial sem fios.",
  },
  {
    id: "pj-p1s-02",
    projectName: "Gabinete Mini-ITX Compacto",
    clientName: "TechCustom PCs",
    printerId: "bambu-p1s",
    timestamp: NOW - 2.1 * DAY,
    outcome: "sucesso",
    printTimeHours: 11.2,
    weightGrams: 410,
    materialType: "PETG",
  },
  {
    id: "pj-p1s-03",
    projectName: "Protótipo Caixa Snap-Fit Eletrônica",
    clientName: "Inovação IoT",
    printerId: "bambu-p1s",
    timestamp: NOW - 5.0 * DAY,
    outcome: "sucesso",
    printTimeHours: 3.4,
    weightGrams: 115,
    materialType: "PLA",
  },
  {
    id: "pj-p1s-04",
    projectName: "Duto de Ventilação Turbina 5015",
    clientName: "Drone Racing SP",
    printerId: "bambu-p1s",
    timestamp: NOW - 8.3 * DAY,
    outcome: "falha",
    failureCause: "adhesion_warp",
    progressPercentBeforeFail: 65,
    printTimeHours: 2.2,
    weightGrams: 75,
    materialType: "ABS",
    estimatedLossCost: 24.5,
    notes: "Warping no canto direito do leito com ABS sem cola líquida.",
  },
  {
    id: "pj-p1s-05",
    projectName: "Suporte GoPro para Capacete",
    clientName: "AeroCâmeras",
    printerId: "bambu-p1s",
    timestamp: NOW - 12.0 * DAY,
    outcome: "sucesso",
    printTimeHours: 2.1,
    weightGrams: 55,
    materialType: "PETG",
  },
  {
    id: "pj-mk4-01",
    projectName: "Engrenagem Bi-Helicoidal para Prensa",
    clientName: "Metalúrgica Precision",
    printerId: "prusa-mk4",
    timestamp: NOW - 4.1 * DAY,
    outcome: "sucesso",
    printTimeHours: 8.3,
    weightGrams: 310,
    materialType: "Nylon (PA)",
    notes: "Adesão perfeita na chapa de pó texturizado com Magigoo PA.",
  },
  {
    id: "pj-mk4-02",
    projectName: "Flange Industrial de Conexão Rápida",
    clientName: "PetroVálvulas",
    printerId: "prusa-mk4",
    timestamp: NOW - 9.4 * DAY,
    outcome: "sucesso",
    printTimeHours: 12.0,
    weightGrams: 420,
    materialType: "Nylon (PA)",
  },
  {
    id: "pj-k1-01",
    projectName: "Lote 35x Troféus Hackathon Tech 2026",
    clientName: "Hub de Inovação SP",
    printerId: "creality-k1",
    timestamp: NOW - 1.2 * DAY,
    outcome: "sucesso",
    printTimeHours: 1.2,
    weightGrams: 42,
    materialType: "PLA Silk",
  },
  {
    id: "pj-k1-02",
    projectName: "Gabinete Modular Mini PC Raspberry Pi 5",
    clientName: "Eduardo Maker Labs",
    printerId: "creality-k1",
    timestamp: NOW - 6.8 * DAY,
    outcome: "sucesso",
    printTimeHours: 3.5,
    weightGrams: 165,
    materialType: "ABS",
  },
  {
    id: "pj-k1-03",
    projectName: "Bandeja Organizadora de Bancada 30x30cm",
    clientName: "Oficina Criativa",
    printerId: "creality-k1",
    timestamp: NOW - 11.0 * DAY,
    outcome: "falha",
    failureCause: "layer_shift",
    progressPercentBeforeFail: 55,
    printTimeHours: 2.8,
    weightGrams: 190,
    materialType: "PLA",
    estimatedLossCost: 28.0,
    notes: "Deslocamento no eixo Y a 500mm/s em aceleração rápida.",
  },
  {
    id: "pj-saturn-01",
    projectName: "Miniatura Dragão Ancião RPG 12K (MSLA)",
    clientName: "Mestre da Guilda RPG",
    printerId: "elegoo-saturn-3",
    timestamp: NOW - 2.5 * DAY,
    outcome: "sucesso",
    printTimeHours: 6.8,
    weightGrams: 140,
    materialType: "Resina Standard",
    notes: "Detalhes nítidos de 12K nos dentes e escamas.",
  },
  {
    id: "pj-saturn-02",
    projectName: "Modelo Anatômico Dentário de Estudo",
    clientName: "OdontoSmile Lab",
    printerId: "elegoo-saturn-3",
    timestamp: NOW - 18.0 * DAY,
    outcome: "falha",
    failureCause: "resin_delamination",
    progressPercentBeforeFail: 50,
    printTimeHours: 2.5,
    weightGrams: 65,
    materialType: "Resina Tough",
    estimatedLossCost: 35.0,
    notes: "Modelo descolou do suporte de resina e ficou colado no filme ACF.",
  },
];

export interface TrendDataPoint {
  periodLabel: string;
  timestamp: number;
  totalJobs: number;
  successJobs: number;
  failedJobs: number;
  successRate: number; // percentage
  wastedCost: number;
  wastedWeightGrams: number;
}

export function calculatePrintSuccessMetrics(
  jobs: PrintJobRecord[],
  daysHorizon: number = 90,
): {
  fleetSuccessRate: number;
  totalJobsCount: number;
  totalSuccessCount: number;
  totalFailedCount: number;
  totalWastedGrams: number;
  totalFinancialLoss: number;
  totalLostHours: number;
  printerMetrics: PrinterSuccessMetric[];
  trendSeries: TrendDataPoint[];
  failureCausesDistribution: Array<{
    cause: PrintFailureCause;
    label: string;
    count: number;
    percent: number;
    wastedCost: number;
    suggestion: string;
  }>;
} {
  const cutoff = NOW - daysHorizon * DAY;
  const filteredJobs = jobs.filter((j) => j.timestamp >= cutoff);

  // Group by printer
  const printerMap = new Map<
    string,
    {
      total: number;
      success: number;
      failed: number;
      wastedGrams: number;
      financialLoss: number;
      lostHours: number;
      causes: Record<string, number>;
      previousTotal: number;
      previousSuccess: number;
    }
  >();

  DEFAULT_PRINTERS.forEach((p) => {
    printerMap.set(p.id, {
      total: 0,
      success: 0,
      failed: 0,
      wastedGrams: 0,
      financialLoss: 0,
      lostHours: 0,
      causes: {},
      previousTotal: 0,
      previousSuccess: 0,
    });
  });

  const halfCutoff = NOW - (daysHorizon / 2) * DAY;
  let totalJobsCount = 0;
  let totalSuccessCount = 0;
  let totalFailedCount = 0;
  let totalWastedGrams = 0;
  let totalFinancialLoss = 0;
  let totalLostHours = 0;
  const globalCausesCount: Record<string, { count: number; loss: number }> = {};

  filteredJobs.forEach((job) => {
    const printer = printerMap.get(job.printerId) || {
      total: 0,
      success: 0,
      failed: 0,
      wastedGrams: 0,
      financialLoss: 0,
      lostHours: 0,
      causes: {},
      previousTotal: 0,
      previousSuccess: 0,
    };

    const isRecentHalf = job.timestamp >= halfCutoff;
    printer.total += 1;
    totalJobsCount += 1;

    if (job.outcome === "sucesso") {
      printer.success += 1;
      totalSuccessCount += 1;
      if (!isRecentHalf) {
        printer.previousSuccess += 1;
      }
    } else if (job.outcome === "falha") {
      printer.failed += 1;
      totalFailedCount += 1;
      const wasteGrams =
        job.weightGrams * ((job.progressPercentBeforeFail || 50) / 100);
      const lossCost =
        job.estimatedLossCost || wasteGrams * 0.12 + job.printTimeHours * 2.5;
      const hoursLost =
        job.printTimeHours * ((job.progressPercentBeforeFail || 50) / 100);

      printer.wastedGrams += wasteGrams;
      printer.financialLoss += lossCost;
      printer.lostHours += hoursLost;

      totalWastedGrams += wasteGrams;
      totalFinancialLoss += lossCost;
      totalLostHours += hoursLost;

      if (job.failureCause) {
        printer.causes[job.failureCause] =
          (printer.causes[job.failureCause] || 0) + 1;
        if (!globalCausesCount[job.failureCause]) {
          globalCausesCount[job.failureCause] = { count: 0, loss: 0 };
        }
        globalCausesCount[job.failureCause].count += 1;
        globalCausesCount[job.failureCause].loss += lossCost;
      }
    }

    if (!isRecentHalf) {
      printer.previousTotal += 1;
    }

    printerMap.set(job.printerId, printer);
  });

  const fleetSuccessRate =
    totalJobsCount > 0 ? (totalSuccessCount / totalJobsCount) * 100 : 100;

  const printerMetrics: PrinterSuccessMetric[] = DEFAULT_PRINTERS.map(
    (printerDef) => {
      const data = printerMap.get(printerDef.id) || {
        total: 0,
        success: 0,
        failed: 0,
        wastedGrams: 0,
        financialLoss: 0,
        lostHours: 0,
        causes: {},
        previousTotal: 0,
        previousSuccess: 0,
      };

      const successRatePercent =
        data.total > 0 ? (data.success / data.total) * 100 : 100;
      const prevRate =
        data.previousTotal > 0
          ? (data.previousSuccess / data.previousTotal) * 100
          : successRatePercent;
      const trendDelta = successRatePercent - prevRate;
      let trendDirection: "up" | "down" | "stable" = "stable";
      if (trendDelta > 1.0) trendDirection = "up";
      else if (trendDelta < -1.0) trendDirection = "down";

      let topCauseEntry:
        | {
            cause: PrintFailureCause;
            label: string;
            count: number;
            percent: number;
          }
        | undefined;
      const causeKeys = Object.keys(data.causes) as PrintFailureCause[];
      if (causeKeys.length > 0) {
        causeKeys.sort((a, b) => data.causes[b] - data.causes[a]);
        const topKey = causeKeys[0];
        const count = data.causes[topKey];
        const percent = data.failed > 0 ? (count / data.failed) * 100 : 0;
        topCauseEntry = {
          cause: topKey,
          label: FAILURE_CAUSE_LABELS[topKey]?.label || topKey,
          count,
          percent: Math.round(percent),
        };
      }

      const reliabilityScore = Math.min(
        100,
        Math.max(
          10,
          Math.round(
            successRatePercent * 0.95 +
              (trendDirection === "up"
                ? 3
                : trendDirection === "down"
                  ? -4
                  : 0),
          ),
        ),
      );

      return {
        printerId: printerDef.id,
        printerName: printerDef.name,
        brand: printerDef.brand,
        technology: printerDef.technology,
        totalJobs: data.total,
        successJobs: data.success,
        failedJobs: data.failed,
        successRatePercent: Math.round(successRatePercent * 10) / 10,
        previousPeriodSuccessRatePercent: Math.round(prevRate * 10) / 10,
        trendDeltaPercent: Math.round(trendDelta * 10) / 10,
        trendDirection,
        totalPrintHoursLogged: printerDef.totalPrintHoursLogged,
        lostHours: Math.round(data.lostHours * 10) / 10,
        wastedFilamentGrams: Math.round(data.wastedGrams),
        totalFinancialLoss: Math.round(data.financialLoss * 100) / 100,
        primaryFailureCause: topCauseEntry,
        reliabilityScore,
      };
    },
  );

  printerMetrics.sort((a, b) => b.totalJobs - a.totalJobs);

  const intervalsCount = 6;
  const intervalDuration = (daysHorizon * DAY) / intervalsCount;
  const trendSeries: TrendDataPoint[] = [];

  for (let i = 0; i < intervalsCount; i++) {
    const intervalStart = cutoff + i * intervalDuration;
    const intervalEnd = intervalStart + intervalDuration;
    const jobsInInterval = filteredJobs.filter(
      (j) => j.timestamp >= intervalStart && j.timestamp < intervalEnd,
    );
    const intTotal = jobsInInterval.length;
    const intSuccess = jobsInInterval.filter(
      (j) => j.outcome === "sucesso",
    ).length;
    const intFailed = jobsInInterval.filter(
      (j) => j.outcome === "falha",
    ).length;
    const rate = intTotal > 0 ? (intSuccess / intTotal) * 100 : 95.0;

    let wasteCost = 0;
    let wasteGrams = 0;
    jobsInInterval
      .filter((j) => j.outcome === "falha")
      .forEach((j) => {
        const g = j.weightGrams * ((j.progressPercentBeforeFail || 50) / 100);
        wasteGrams += g;
        wasteCost += j.estimatedLossCost || g * 0.12 + 5;
      });

    const d = new Date(intervalEnd);
    const dayStr = String(d.getDate()).padStart(2, "0");
    const monthStr = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ][d.getMonth()];

    trendSeries.push({
      periodLabel: `Sem ${i + 1} (${dayStr} ${monthStr})`,
      timestamp: intervalEnd,
      totalJobs: intTotal,
      successJobs: intSuccess,
      failedJobs: intFailed,
      successRate: Math.round(rate * 10) / 10,
      wastedCost: Math.round(wasteCost * 10) / 10,
      wastedWeightGrams: Math.round(wasteGrams),
    });
  }

  const failureCausesDistribution = (
    Object.keys(globalCausesCount) as PrintFailureCause[]
  )
    .map((cause) => {
      const data = globalCausesCount[cause];
      const info = FAILURE_CAUSE_LABELS[cause] || {
        label: cause,
        description: "Falha reportada",
        suggestion: "Inspecione a máquina e configurações de fatiamento.",
      };
      return {
        cause,
        label: info.label,
        count: data.count,
        percent:
          totalFailedCount > 0
            ? Math.round((data.count / totalFailedCount) * 100)
            : 0,
        wastedCost: Math.round(data.loss * 100) / 100,
        suggestion: info.suggestion,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    fleetSuccessRate: Math.round(fleetSuccessRate * 10) / 10,
    totalJobsCount,
    totalSuccessCount,
    totalFailedCount,
    totalWastedGrams: Math.round(totalWastedGrams),
    totalFinancialLoss: Math.round(totalFinancialLoss * 100) / 100,
    totalLostHours: Math.round(totalLostHours * 10) / 10,
    printerMetrics,
    trendSeries,
    failureCausesDistribution,
  };
}
