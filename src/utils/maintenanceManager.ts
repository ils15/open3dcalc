import { PrinterProfile } from "../types";

const STORAGE_KEY = "open3dcalc_printer_maintenance_cycles_v2";
export const MAINTENANCE_CHANGE_EVENT = "open3dcalc:maintenance_cycles_changed";

export interface MaintenanceChecklistItem {
  id: string;
  title: string;
  description: string;
  category:
    "nozzle" | "belts" | "lubrication" | "extruder" | "calibration" | "optical";
  recommendedTool?: string;
  isCompleted: boolean;
}

export interface PrinterMaintenanceTask {
  printerId: string;
  printerName: string;
  brand: string;
  technology: "fdm" | "resin";
  hoursSinceLastService: number;
  intervalHours: number;
  thresholdPercent: number;
  severity: "warning" | "critical" | "overdue";
  checklist: MaintenanceChecklistItem[];
  estimatedMinutes: number;
  lastServiceDate?: string;
}

const DEFAULT_HOURS: Record<string, number> = {
  "creality-k1": 235, // 235h / 250h = 94% -> CRITICAL >= 80%
  "ender-3-v3": 290, // 290h / 250h = 116% -> OVERDUE >= 80%
  "elegoo-saturn-3": 175, // 175h / 200h = 87.5% -> CRITICAL >= 80%
  "bambu-p1s": 180, // 180h / 300h = 60%
  "prusa-mk4": 95, // 95h / 350h = 27%
  "bambu-a1-mini": 65, // 65h / 300h = 21.6%
};

export function getMaintenanceInterval(printer: PrinterProfile): number {
  if (printer.technology === "resin") return 200;
  if (printer.brand === "Bambu Lab") return 300;
  if (printer.brand === "Prusa Research") return 350;
  return 250;
}

export function loadMaintenanceCycles(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return { ...DEFAULT_HOURS, ...parsed };
      }
    }
  } catch (e) {
    console.error("Failed to load maintenance cycles", e);
  }
  return { ...DEFAULT_HOURS };
}

export function saveMaintenanceCycles(cycles: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
    window.dispatchEvent(
      new CustomEvent(MAINTENANCE_CHANGE_EVENT, { detail: cycles }),
    );
  } catch (e) {
    console.error("Failed to save maintenance cycles", e);
  }
}

export function resetPrinterMaintenance(
  printerId: string,
): Record<string, number> {
  const current = loadMaintenanceCycles();
  const updated = {
    ...current,
    [printerId]: 0,
  };
  saveMaintenanceCycles(updated);
  return updated;
}

export function generateChecklistForPrinter(
  printer: PrinterProfile,
): MaintenanceChecklistItem[] {
  const isResin = printer.technology === "resin";

  if (isResin) {
    return [
      {
        id: "resin-fep",
        title: "Inspeção & Tensão do Filme FEP / Release Film",
        description:
          "Checar micro-furos, arranhões, turvação e reapertar parafusos de fixação do tanque.",
        category: "optical",
        recommendedTool: "Chave Allen 2.5mm + Álcool Isopropílico",
        isCompleted: false,
      },
      {
        id: "resin-z-screw",
        title: "Limpeza & Lubrificação do Fuso de Esferas Eixo Z",
        description:
          "Remover resíduos curados no fuso e aplicar graxa sintética PTFE de alta adesão.",
        category: "lubrication",
        recommendedTool: "Pano de microfibra + Graxa branca PTFE",
        isCompleted: false,
      },
      {
        id: "resin-screen",
        title: "Teste de Exposição UV & Limpeza da Tela LCD Monocromática",
        description:
          "Limpar manchas de resina com álcool isopropílico 99% e rodar teste de projeção de pixels.",
        category: "calibration",
        recommendedTool: "Papel óptico + IPA 99%",
        isCompleted: false,
      },
      {
        id: "resin-carbon",
        title: "Substituição do Refil do Filtro de Carvão Ativado",
        description:
          "Trocar refil purificador interno de vapores tóxicos (VOC) e limpar a ventoinha.",
        category: "extruder",
        recommendedTool: "Refil de carvão ativado novo",
        isCompleted: false,
      },
    ];
  }

  // FDM Checklist
  return [
    {
      id: "fdm-nozzle",
      title: "Limpeza e Descarbonização do Bico (Cold Pull & Nozzle Cleaning)",
      description:
        "Aquecer a 250°C, introduzir agulha de acupuntura e realizar Cold Pull para remover partículas carbonizadas.",
      category: "nozzle",
      recommendedTool: "Agulha 0.4mm + Filamento de Limpeza / Nylon",
      isCompleted: false,
    },
    {
      id: "fdm-belts",
      title:
        "Tensionamento & Alinhamento das Correias Dentadas GT2 (Belt Tensioning)",
      description:
        "Verificar deflexão das correias X e Y. Ajustar tensores até atingir a frequência acústica ideal (80Hz - 110Hz).",
      category: "belts",
      recommendedTool: "Chave Allen + App de Afinação de Correia / Frequência",
      isCompleted: false,
    },
    {
      id: "fdm-lubrication",
      title: "Higienização e Lubrificação dos Trilhos Lineares & Fusos Z",
      description:
        "Remover resíduos com álcool isopropílico e aplicar camada fina de graxa sintética SuperLube / PTFE nos rolamentos.",
      category: "lubrication",
      recommendedTool: "Pano sem fiapos + Graxa PTFE Sintética",
      isCompleted: false,
    },
    {
      id: "fdm-extruder",
      title: "Limpeza das Engrenagens Dual-Drive da Extrusora",
      description:
        "Abrir alavanca da extrusora e escovar pó de filamento acumulado nas engrenagens tracionadoras endurecidas.",
      category: "extruder",
      recommendedTool: "Escova de cerdas de latão ou nylon",
      isCompleted: false,
    },
    {
      id: "fdm-calibration",
      title:
        "Calibração da Malha de Nivelamento Automático (Auto-Bed Mesh) & Z-Offset",
      description:
        "Aquecer mesa a 60°C e executar rotina de sondagem completa para recalibrar compensação da primeira camada.",
      category: "calibration",
      recommendedTool: "Sonda integrada / Folha de papel calibrada 0.1mm",
      isCompleted: false,
    },
  ];
}
