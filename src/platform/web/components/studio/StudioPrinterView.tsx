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
    <div className="flex flex-col gap-6 text-text-primary mx-auto w-full max-w-7xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-accent" />
            Frota de Impressoras 3D
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            <span className="font-semibold text-text-secondary">
              {printers.length} máquinas cadastradas
            </span>{" "}
            •{" "}
            <span className="text-positive font-semibold">
              {activeCount} ativas agora
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5 text-xs font-medium">
            <button className="px-3 py-1 rounded-md bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold">
              Grade de Máquinas
            </button>
            <button className="px-3 py-1 rounded-md text-text-secondary hover:text-text-primary">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-colors shadow-sm"
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
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar modelo ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-raised border border-border-subtle rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Technology & Status filter pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {/* Tech pills */}
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5">
            {(["Todas", "FDM", "Resina"] as const).map((tech) => (
              <button
                key={tech}
                onClick={() => setSelectedTech(tech)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedTech === tech
                    ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold"
                    : "text-text-secondary hover:text-text-primary"
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

          <span className="text-text-disabled hidden md:inline">|</span>

          {/* Status pills */}
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-lg p-0.5">
            {(["Todos", "Disponível", "Imprimindo", "Manutenção"] as const).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedStatus === st
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] font-bold"
                      : "text-text-secondary hover:text-text-primary"
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
              className={`bg-surface-raised rounded-xl p-4 flex flex-col justify-between transition-all group border ${
                isActive
                  ? "border-accent shadow-md shadow-accent/40 ring-1 ring-accent/40"
                  : "border-border-subtle hover:border-border-subtle"
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-surface-overlay text-text-secondary">
                      <Printer className="w-4 h-4 text-info" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-text-primary group-hover:text-info transition-colors">
                        {printer.name}
                      </h3>
                      <p className="text-[11px] text-text-secondary">
                        {printer.brand} • {printer.technology.toUpperCase()} •
                        0.4mm
                      </p>
                    </div>
                  </div>

                  {printer.status === "imprimindo" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-positive-subtle text-positive border border-positive/30">
                      Imprimindo
                    </span>
                  ) : printer.status === "manutencao" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning-subtle text-warning border border-warning/30">
                      Manutenção
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-sunken text-text-secondary border border-border-default">
                      Disponível
                    </span>
                  )}
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-2 gap-3 text-xs py-2 border-y border-border-subtle mb-3">
                  <div>
                    <span className="text-[10px] text-text-muted block uppercase font-mono">
                      Volume útil
                    </span>
                    <span className="font-bold text-text-secondary">
                      {printer.volume}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted block uppercase font-mono">
                      Potência
                    </span>
                    <span className="font-bold text-text-secondary">
                      {printer.powerWatts} W
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted block uppercase font-mono">
                      Depreciação/h
                    </span>
                    <span className="font-bold text-text-secondary">
                      R${" "}
                      {printer.depreciationPerHour.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted block uppercase font-mono">
                      Manutenção/h
                    </span>
                    <span className="font-bold text-text-secondary">
                      R${" "}
                      {printer.maintenancePerHour.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                {/* Hours logged progress bar */}
                <div className="flex flex-col gap-1.5 mb-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary font-medium">
                      Horas logged: {printer.hoursLogged}h / {printer.maxHours}h
                    </span>
                    <span className="text-text-secondary font-bold font-mono text-[11px]">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 90 ? "bg-warning" : "bg-accent"
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => handleSelectPrinter(printer)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition-all ${
                    isActive
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                      : "bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {isActive ? <Check className="w-3 h-3" /> : null}
                  <span>
                    {isActive ? "✓ Ativa no Cálculo" : "Vincular ao Cálculo"}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-text-muted hover:text-text-secondary transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setPrinters(printers.filter((p) => p.id !== printer.id))
                    }
                    className="p-1 text-text-muted hover:text-critical transition-colors"
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
