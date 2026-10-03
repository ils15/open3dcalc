import React, { useState } from "react";
import { Plus, Search, Edit2, Trash2, Printer, Check } from "lucide-react";
import { StudioPrinter, INITIAL_PRINTERS } from "./studioData";
import { Tab } from "@/shared/components/AppShell/tabs";

interface StudioPrinterViewProps {
  onSelectPrinterForCalc?: (printer: StudioPrinter) => void;
  onTabChange?: (tab: Tab) => void;
}

export const StudioPrinterView: React.FC<StudioPrinterViewProps> = ({
  onSelectPrinterForCalc,
  onTabChange,
}) => {
  const [printers, setPrinters] = useState<StudioPrinter[]>(INITIAL_PRINTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTech, setSelectedTech] = useState<"Todas" | "FDM" | "Resina">(
    "Todas",
  );
  const [selectedStatus, setSelectedStatus] = useState<
    "Todos" | "Disponível" | "Imprimindo" | "Manutenção"
  >("Todos");

  const filteredPrinters = printers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTech =
      selectedTech === "Todas" ||
      (selectedTech === "FDM" && p.technology === "fdm") ||
      (selectedTech === "Resina" && p.technology === "resin");

    const matchesStatus =
      selectedStatus === "Todos" ||
      (selectedStatus === "Disponível" && p.status === "disponivel") ||
      (selectedStatus === "Imprimindo" && p.status === "imprimindo") ||
      (selectedStatus === "Manutenção" && p.status === "manutencao");

    return matchesSearch && matchesTech && matchesStatus;
  });

  const activeCount = printers.filter((p) => p.status === "imprimindo").length;

  const handleSelectPrinter = (printer: StudioPrinter) => {
    setPrinters(
      printers.map((p) => ({
        ...p,
        activeInCalculation: p.id === printer.id,
      })),
    );
    if (onSelectPrinterForCalc) onSelectPrinterForCalc(printer);
    if (onTabChange) onTabChange("calculator");
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 max-w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            Frota de Impressoras 3D
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            <span className="font-semibold text-slate-300">
              {printers.length} máquinas cadastradas
            </span>{" "}
            •{" "}
            <span className="text-emerald-400 font-semibold">
              {activeCount} ativas agora
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#111728] border border-[#212c45] rounded-lg p-0.5 text-xs font-medium">
            <button className="px-3 py-1 rounded-md bg-blue-600 text-white font-bold">
              Grade de Máquinas
            </button>
            <button className="px-3 py-1 rounded-md text-slate-400 hover:text-white">
              Sucesso & Confiabilidade
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const newPrinter: StudioPrinter = {
                id: `printer-${Date.now()}`,
                name: "Nova Impressora 3D",
                brand: "Custom",
                technology: "fdm",
                volume: "220×220×250 mm",
                powerWatts: 150,
                depreciationPerHour: 1.0,
                maintenancePerHour: 0.6,
                hoursLogged: 0,
                maxHours: 3000,
                status: "disponivel",
              };
              setPrinters([newPrinter, ...printers]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Impressora</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar modelo ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0c111e] border border-[#1e2a44] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Technology & Status filter pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {/* Tech pills */}
          <div className="flex items-center bg-[#101726] border border-[#1e2a44] rounded-lg p-0.5">
            {(["Todas", "FDM", "Resina"] as const).map((tech) => (
              <button
                key={tech}
                onClick={() => setSelectedTech(tech)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedTech === tech
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tech === "FDM"
                  ? "FDM (Filamento)"
                  : tech === "Resina"
                    ? "Resina (MSLA)"
                    : "Todas"}
              </button>
            ))}
          </div>

          <span className="text-slate-600 hidden md:inline">|</span>

          {/* Status pills */}
          <div className="flex items-center bg-[#101726] border border-[#1e2a44] rounded-lg p-0.5">
            {(["Todos", "Disponível", "Imprimindo", "Manutenção"] as const).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedStatus === st
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {st === "Todos" ? "Todos os status" : st}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Grid of Printer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredPrinters.map((printer) => {
          const pct = Math.min(
            100,
            Math.round((printer.hoursLogged / printer.maxHours) * 100),
          );
          const isActive = !!printer.activeInCalculation;

          return (
            <div
              key={printer.id}
              className={`bg-[#0c111e] rounded-xl p-4 flex flex-col justify-between transition-all group border ${
                isActive
                  ? "border-blue-500 shadow-md shadow-blue-950/40 ring-1 ring-blue-500/40"
                  : "border-[#1b253b] hover:border-slate-700"
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#141d30] text-slate-300">
                      <Printer className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-white group-hover:text-blue-400 transition-colors">
                        {printer.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {printer.brand} • {printer.technology.toUpperCase()} •
                        0.4mm
                      </p>
                    </div>
                  </div>

                  {printer.status === "imprimindo" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Imprimindo
                    </span>
                  ) : printer.status === "manutencao" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Manutenção
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700/60 text-slate-300 border border-slate-600/40">
                      Disponível
                    </span>
                  )}
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-2 gap-3 text-xs py-2 border-y border-[#182138] mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">
                      Volume útil
                    </span>
                    <span className="font-bold text-slate-200">
                      {printer.volume}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">
                      Potência
                    </span>
                    <span className="font-bold text-slate-200">
                      {printer.powerWatts} W
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">
                      Depreciação/h
                    </span>
                    <span className="font-bold text-slate-200">
                      R${" "}
                      {printer.depreciationPerHour.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">
                      Manutenção/h
                    </span>
                    <span className="font-bold text-slate-200">
                      R${" "}
                      {printer.maintenancePerHour.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                {/* Hours logged progress bar */}
                <div className="flex flex-col gap-1.5 mb-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">
                      Horas logged: {printer.hoursLogged}h / {printer.maxHours}h
                    </span>
                    <span className="text-slate-300 font-bold font-mono text-[11px]">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 90 ? "bg-amber-400" : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#182138]">
                <button
                  type="button"
                  onClick={() => handleSelectPrinter(printer)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-[#111828] hover:bg-[#192338] border border-[#212d47] text-slate-300 hover:text-white"
                  }`}
                >
                  {isActive ? <Check className="w-3 h-3" /> : null}
                  <span>
                    {isActive ? "✓ Ativa no Cálculo" : "Vincular ao Cálculo"}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setPrinters(printers.filter((p) => p.id !== printer.id))
                    }
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
