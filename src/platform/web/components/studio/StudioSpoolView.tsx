import React, { useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  DollarSign,
  Scale,
  Check,
  X,
  Calculator,
  AlertTriangle,
  Sparkles,
  MinusCircle,
  Store,
  Droplet,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import {
  useSpoolStore,
  FilamentSpool,
  SpoolStatus,
  remainingPct,
  isLowStockSpool,
} from "@/shared/stores/spoolStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";

interface StudioSpoolViewProps {
  onTabChange?: (tab: Tab) => void;
}

const PRESET_PALETTE = [
  { name: "Preto Profundo", hex: "#111827" },
  { name: "Branco Puro", hex: "#f8fafc" },
  { name: "Cinza Espacial", hex: "#64748b" },
  { name: "Cinza Chumbo", hex: "#334155" },
  { name: "Vermelho Fogo", hex: "#ef4444" },
  { name: "Azul Real", hex: "#2563eb" },
  { name: "Azul Turquesa", hex: "#06b6d4" },
  { name: "Verde Esmeralda", hex: "#10b981" },
  { name: "Amarelo Ouro", hex: "#f59e0b" },
  { name: "Laranja Neon", hex: "#f97316" },
  { name: "Roxo Galaxy", hex: "#8b5cf6" },
  { name: "Rosa Magenta", hex: "#ec4899" },
  { name: "Dourado Silk", hex: "#d97706" },
  { name: "Prata Metálico", hex: "#94a3b8" },
  { name: "Cobre Fosco", hex: "#b45309" },
  { name: "Translúcido / Clear", hex: "#cbd5e1" },
];

export const StudioSpoolView: React.FC<StudioSpoolViewProps> = ({
  onTabChange,
}) => {
  const isDemoMode = useIsDemoMode();
  const spools = useSpoolStore((s) => s.spools);
  const addSpool = useSpoolStore((s) => s.addSpool);
  const updateSpool = useSpoolStore((s) => s.updateSpool);
  const removeSpool = useSpoolStore((s) => s.removeSpool);
  const calcStore = useCalculatorStore();

  const [categoryTab, setCategoryTab] = useState<"fdm" | "resin">("fdm");
  const isResin = (mat: string) =>
    mat.toLowerCase().includes("resina") || mat.toLowerCase().includes("resin");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("Todos");
  const [selectedStatus, setSelectedStatus] = useState<"all" | SpoolStatus>(
    "all",
  );

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpool, setEditingSpool] = useState<FilamentSpool | null>(null);

  // Form fields
  const [brand, setBrand] = useState("Bambu Lab");
  const [material, setMaterial] = useState("PLA Basic");
  const [color, setColor] = useState("Preto");
  const [colorHex, setColorHex] = useState("#111827");
  const [weightGrams, setWeightGrams] = useState(1000);
  const [originalWeightGrams, setOriginalWeightGrams] = useState(1000);
  const [tareGrams, setTareGrams] = useState(200);
  const [costPerKg, setCostPerKg] = useState(120);
  const [diameterMm, setDiameterMm] = useState(1.75);
  const [purchaseStore, setPurchaseStore] = useState("Shopee");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SpoolStatus>("in_stock");

  // Inline weight deduction state
  const [deductModalSpool, setDeductModalSpool] =
    useState<FilamentSpool | null>(null);
  const [gramsToDeduct, setGramsToDeduct] = useState(50);

  const materials =
    categoryTab === "resin"
      ? [
          "Todos",
          "Resina Standard",
          "Resina Tough",
          "Resina Lavável",
          "Resina Castable",
          "Outro",
        ]
      : ["Todos", "PLA", "PETG", "ABS", "ASA", "TPU", "SILK", "Nylon", "Outro"];

  const filteredSpools = spools.filter((s) => {
    const isMatResin = isResin(s.material);
    if (categoryTab === "fdm" && isMatResin) return false;
    if (categoryTab === "resin" && !isMatResin) return false;

    const matchesSearch =
      s.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMaterial =
      selectedMaterial === "Todos" ||
      s.material.toLowerCase().includes(selectedMaterial.toLowerCase());
    const matchesStatus =
      selectedStatus === "all" || s.status === selectedStatus;

    return matchesSearch && matchesMaterial && matchesStatus;
  });

  const categorySpools = spools.filter((s) =>
    categoryTab === "resin" ? isResin(s.material) : !isResin(s.material),
  );
  const totalGramsInStock = categorySpools.reduce(
    (acc, s) => acc + (s.status === "in_stock" ? s.weightGrams : 0),
    0,
  );
  const totalStockValue = categorySpools.reduce(
    (acc, s) =>
      acc +
      (s.status === "in_stock" ? (s.weightGrams / 1000) * s.costPerKg : 0),
    0,
  );
  const lowStockCount = categorySpools.filter((s) =>
    isLowStockSpool(s, 150),
  ).length;

  const handleUseSpoolInCalc = (spool: FilamentSpool) => {
    if (isResin(spool.material)) {
      calcStore.setActiveTab("resin");
      calcStore.setResinMaterial({
        ...calcStore.resinMaterial,
        type: spool.material,
        costPerLiter: spool.costPerKg,
      });
    } else {
      calcStore.setActiveTab("fdm");
      // Neither `setFilamentCostPerKg` nor a `costPerKg` on `fdmFilament`
      // exists. The FDM filament cost lives in `fdmMaterial`, and
      // `storeBridge.selectSpool` is the canonical way to push a spool into
      // the calculator — so mirror its shape instead of inventing an API.
      calcStore.setFdmMaterial({
        ...calcStore.fdmMaterial,
        type: spool.material,
        costPerKg: spool.costPerKg,
      });
    }
    onTabChange?.("calculator");
  };

  const openCreateModal = () => {
    setEditingSpool(null);
    if (categoryTab === "resin") {
      setBrand("Anycubic");
      setMaterial("Resina Standard");
      setColor("Cinza");
      setColorHex("#64748b");
      setWeightGrams(1000);
      setOriginalWeightGrams(1000);
      setTareGrams(120);
      setCostPerKg(150);
      setDiameterMm(1.12);
      setPurchaseStore("Shopee");
      setNotes("Exposição 2.5s base 30s");
    } else {
      setBrand("Bambu Lab");
      setMaterial("PLA Basic");
      setColor("Preto");
      setColorHex("#111827");
      setWeightGrams(1000);
      setOriginalWeightGrams(1000);
      setTareGrams(200);
      setCostPerKg(120);
      setDiameterMm(1.75);
      setPurchaseStore("Shopee");
      setNotes("210°C bico / 60°C mesa");
    }
    setStatus("in_stock");
    setIsModalOpen(true);
  };

  const openEditModal = (spool: FilamentSpool) => {
    setEditingSpool(spool);
    setBrand(spool.brand);
    setMaterial(spool.material);
    setColor(spool.color);
    setColorHex(spool.colorHex || "#3b82f6");
    setWeightGrams(spool.weightGrams);
    setOriginalWeightGrams(spool.originalWeightGrams || 1000);
    setTareGrams(spool.tareGrams || 200);
    setCostPerKg(spool.costPerKg);
    setDiameterMm(spool.diameterMm || 1.75);
    setPurchaseStore(spool.purchaseStore || "");
    setNotes(spool.notes || "");
    setStatus(spool.status || "in_stock");
    setIsModalOpen(true);
  };

  const handleSaveSpool = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSpool) {
      updateSpool(editingSpool.id, {
        brand,
        material,
        color,
        colorHex,
        weightGrams: Number(weightGrams),
        originalWeightGrams: Number(originalWeightGrams),
        tareGrams: Number(tareGrams),
        costPerKg: Number(costPerKg),
        diameterMm: Number(diameterMm),
        purchaseStore,
        notes,
        status,
      });
    } else {
      addSpool({
        brand,
        material,
        color,
        colorHex,
        weightGrams: Number(weightGrams),
        originalWeightGrams: Number(originalWeightGrams),
        tareGrams: Number(tareGrams),
        costPerKg: Number(costPerKg),
        diameterMm: Number(diameterMm),
        purchaseStore,
        notes,
        status,
      });
    }
    setIsModalOpen(false);
  };

  const handleConfirmDeduct = () => {
    if (!deductModalSpool) return;
    const newWeight = Math.max(0, deductModalSpool.weightGrams - gramsToDeduct);
    const newStatus = newWeight === 0 ? "empty" : deductModalSpool.status;
    updateSpool(deductModalSpool.id, {
      weightGrams: newWeight,
      status: newStatus,
    });
    setDeductModalSpool(null);
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 max-w-full pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0c111e] border border-[#1b253b] rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              ESTOQUE DE INSUMOS & RASTREABILIDADE
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Gestão de Insumos da Oficina
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Controle volumétrico separado de filamentos FDM e resinas líquidas
            (SLA / DLP)
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/40 self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {categoryTab === "resin"
              ? "Cadastrar Garrafa de Resina"
              : "Cadastrar Carretel"}
          </span>
        </button>
      </div>

      {/* Category Switcher: FDM Filaments vs SLA/DLP Resins */}
      <div className="flex items-center gap-2 bg-[#0c111e] border border-[#1b253b] p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => {
            setCategoryTab("fdm");
            setSelectedMaterial("Todos");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            categoryTab === "fdm"
              ? "bg-blue-600 text-white shadow-md shadow-blue-950/50"
              : "text-slate-400 hover:text-white hover:bg-[#121828]"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Carretéis de Filamento (FDM)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30">
            {spools.filter((s) => !isResin(s.material)).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryTab("resin");
            setSelectedMaterial("Todos");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            categoryTab === "resin"
              ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
              : "text-slate-400 hover:text-white hover:bg-[#121828]"
          }`}
        >
          <Droplet className="w-4 h-4" />
          <span>Garrafas de Resina (SLA / DLP)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30">
            {spools.filter((s) => isResin(s.material)).length}
          </span>
        </button>
      </div>

      {/* KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Bobinas */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TOTAL DE CARRETÉIS
            </span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              {spools.length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">cadastrados</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {spools.filter((s) => s.status === "in_stock").length} disponíveis
            para impressão
          </div>
        </div>

        {/* Peso Total */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              PESO TOTAL EM ESTOQUE
            </span>
            <Scale className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-emerald-400">
              {(totalGramsInStock / 1000).toFixed(2)} kg
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            {totalGramsInStock} gramas líquidas
          </div>
        </div>

        {/* Valor do Estoque */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              VALOR TOTAL DO ESTOQUE
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              R$ {totalStockValue.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-emerald-400/90 font-medium">
            Valor de reposição estimado
          </div>
        </div>

        {/* Alerta Estoque Baixo */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              ESTOQUE BAIXO (&lt;150g)
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${lowStockCount > 0 ? "text-amber-400" : "text-slate-500"}`}
            />
          </div>
          <div className="my-2">
            <span
              className={`text-2xl font-extrabold ${lowStockCount > 0 ? "text-amber-400" : "text-slate-400"}`}
            >
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">carretéis</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {lowStockCount > 0
              ? "Recomenda-se reposição de material"
              : "Nível seguro de abastecimento"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0c111e] border border-[#1b253b] rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar cor, marca, material ou anotações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Material selector */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {materials.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedMaterial(type)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedMaterial === type
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-[#121828]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) =>
              setSelectedStatus(e.target.value as "all" | SpoolStatus)
            }
            className="bg-[#111728] border border-[#1f2b45] rounded-lg px-2.5 py-1.5 text-slate-300 font-semibold outline-none cursor-pointer"
          >
            <option value="all">Todos os Status</option>
            <option value="in_stock">Em Estoque</option>
            <option value="on_the_way">A Caminho</option>
            <option value="empty">Vazio</option>
          </select>
        </div>
      </div>

      {/* Spools Grid */}
      {filteredSpools.length === 0 ? (
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Package className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {searchTerm
              ? "Nenhum carretel encontrado"
              : "Nenhum carretel cadastrado no estoque"}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            {searchTerm
              ? "Tente buscar com outros termos ou limpar os filtros de material."
              : "Cadastre suas bobinas para controlar custos por grama e peso restante com visualização de cores realistas."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Carretel</span>
            </button>
            {!isDemoMode && (
              <button
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14122b] hover:bg-[#1b1938] border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Carregar Estoque Demo</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpools.map((spool) => {
            const pct = remainingPct(spool);
            const hex = spool.colorHex || "#3b82f6";
            const spoolRemainingCost =
              (spool.costPerKg / 1000) * spool.weightGrams;
            const isLow = isLowStockSpool(spool, 150);

            return (
              <div
                key={spool.id}
                className="bg-[#0c111e] hover:bg-[#0f1526] border border-[#1b253b] hover:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all group relative overflow-hidden"
              >
                {/* Visual Spool Top Header */}
                <div>
                  <div className="flex items-start gap-3.5 mb-3">
                    {/* Visual Graphic: Resin Bottle for Resin, 3D Spool for Filament */}
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                      {isResin(spool.material) ? (
                        <svg
                          width="64"
                          height="64"
                          viewBox="0 0 64 64"
                          className="filter drop-shadow-md"
                        >
                          {/* Bottle Cap */}
                          <rect
                            x="26"
                            y="6"
                            width="12"
                            height="7"
                            rx="1.5"
                            fill="#1e293b"
                            stroke="#475569"
                            strokeWidth="1.5"
                          />
                          <rect
                            x="28"
                            y="13"
                            width="8"
                            height="4"
                            fill="#0f172a"
                          />
                          {/* Bottle Neck & Shoulder */}
                          <path
                            d="M22 22 L28 17 L36 17 L42 22 Z"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="1.5"
                          />
                          {/* Bottle Body */}
                          <rect
                            x="18"
                            y="22"
                            width="28"
                            height="36"
                            rx="4"
                            fill="#0f172a"
                            stroke="#334155"
                            strokeWidth="1.5"
                          />
                          {/* Resin Liquid Level Window */}
                          <rect
                            x="22"
                            y="32"
                            width="20"
                            height="22"
                            rx="2"
                            fill={hex}
                            opacity="0.85"
                          />
                          {/* Label */}
                          <rect
                            x="24"
                            y="24"
                            width="16"
                            height="5"
                            rx="1"
                            fill="#1e293b"
                            opacity="0.9"
                          />
                          <circle
                            cx="32"
                            cy="43"
                            r="3.5"
                            fill="rgba(255,255,255,0.4)"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="64"
                          height="64"
                          viewBox="0 0 64 64"
                          className="filter drop-shadow-md"
                        >
                          {/* Outer Flange */}
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="#1e293b"
                            stroke="#334155"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="#0f172a"
                            opacity="0.6"
                          />

                          {/* Filament Coil with Exact Color */}
                          <circle
                            cx="32"
                            cy="32"
                            r="22"
                            fill={hex}
                            opacity="0.95"
                            stroke={hex}
                            strokeWidth="1"
                          />
                          {/* Inner Windings Pattern */}
                          <circle
                            cx="32"
                            cy="32"
                            r="19"
                            fill="none"
                            stroke="rgba(255,255,255,0.25)"
                            strokeWidth="1"
                            strokeDasharray="3 2"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="16"
                            fill="none"
                            stroke="rgba(0,0,0,0.3)"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="13"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1"
                          />

                          {/* Spool Center Hub */}
                          <circle
                            cx="32"
                            cy="32"
                            r="9"
                            fill="#0f172a"
                            stroke="#475569"
                            strokeWidth="2"
                          />
                          <circle cx="32" cy="32" r="4.5" fill="#020617" />
                        </svg>
                      )}

                      {/* Small swatch badge */}
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0c111e] shadow-sm flex items-center justify-center text-[8px] font-bold"
                        style={{ backgroundColor: hex }}
                        title={`Cor Hex: ${hex}`}
                      />
                    </div>

                    {/* Spool Titles & Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400 truncate">
                          {spool.brand}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                            spool.status === "in_stock"
                              ? isLow
                                ? "bg-amber-950/60 text-amber-400 border border-amber-500/40"
                                : "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40"
                              : spool.status === "on_the_way"
                                ? "bg-blue-950/60 text-blue-400 border border-blue-500/40"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {spool.status === "in_stock"
                            ? isLow
                              ? "Estoque Baixo"
                              : "Em Estoque"
                            : spool.status === "on_the_way"
                              ? "A Caminho"
                              : "Vazio"}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {spool.material} • {spool.color}
                      </h3>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span className="font-semibold text-slate-200">
                          R$ {spool.costPerKg.toFixed(2).replace(".", ",")}/
                          {isResin(spool.material) ? "L" : "kg"}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">
                          {isResin(spool.material)
                            ? `${spool.diameterMm || 1.12} g/cm³`
                            : `${spool.diameterMm || 1.75}mm`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remaining Weight Gauge Bar */}
                  <div className="bg-[#090d18] rounded-xl p-2.5 border border-[#172238] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px] font-medium">
                        {isResin(spool.material)
                          ? "Volume restante:"
                          : "Restante no carretel:"}
                      </span>
                      <span className="font-mono font-bold text-white">
                        {spool.weightGrams}
                        {isResin(spool.material) ? "ml" : "g"}{" "}
                        <span className="text-slate-500 font-normal">
                          / {spool.originalWeightGrams}
                          {isResin(spool.material) ? "ml" : "g"}
                        </span>
                        <span className="ml-1 text-slate-400 font-semibold">
                          ({pct}%)
                        </span>
                      </span>
                    </div>

                    <div className="w-full bg-[#131b2e] h-2 rounded-full overflow-hidden border border-[#1f2b45]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct < 20 ? "#f97316" : hex,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>
                        Valor restante:{" "}
                        <strong className="text-emerald-400">
                          R$ {spoolRemainingCost.toFixed(2).replace(".", ",")}
                        </strong>
                      </span>
                      {spool.tareGrams && <span>Tara: {spool.tareGrams}g</span>}
                    </div>
                  </div>

                  {/* Notes & Purchase Store snippet */}
                  {(spool.notes || spool.purchaseStore) && (
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 truncate">
                      {spool.notes && (
                        <span className="truncate italic">"{spool.notes}"</span>
                      )}
                      {spool.purchaseStore && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500 shrink-0 font-medium">
                          <Store className="w-3 h-3 text-slate-500" />
                          <span>{spool.purchaseStore}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1b253b] text-xs">
                  <button
                    type="button"
                    onClick={() => handleUseSpoolInCalc(spool)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-[11px] transition-colors"
                    title="Definir na calculadora como material de trabalho"
                  >
                    <Calculator className="w-3 h-3" />
                    <span>Usar no Cálculo</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Quick deduct button */}
                    <button
                      type="button"
                      onClick={() => {
                        setDeductModalSpool(spool);
                        setGramsToDeduct(50);
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-[#151c2f] transition-colors"
                      title="Descontar peso impresso"
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(spool)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#151c2f] transition-colors"
                      title="Editar Carretel"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeSpool(spool.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-colors"
                      title="Excluir Carretel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Spool */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c111e] border border-[#1f2c47] rounded-2xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1b253b] pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">
                  {editingSpool
                    ? "Editar Carretel de Filamento"
                    : "Cadastrar Novo Carretel"}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveSpool}
              className="flex flex-col gap-4 text-xs"
            >
              {/* Row 1: Brand, Material, Color Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    FABRICANTE / MARCA *
                  </label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: Bambu Lab, eSun, Creality"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    MATERIAL *
                  </label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-2.5 py-2 text-white outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option>PLA Basic</option>
                    <option>PLA Silk</option>
                    <option>PLA Matte</option>
                    <option>PETG</option>
                    <option>ABS</option>
                    <option>ASA</option>
                    <option>TPU 95A</option>
                    <option>Nylon (PA)</option>
                    <option>Resina Standard</option>
                    <option>Outro</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    NOME DA COR *
                  </label>
                  <input
                    type="text"
                    required
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Ex: Laranja Neon, Azul Safira"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Palette Color Picker Grid */}
              <div className="bg-[#090d18] border border-[#18233a] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                    SELECIONAR COR DA PALETA DE FILAMENTOS:
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-600"
                      style={{ backgroundColor: colorHex }}
                    />
                    <span className="font-mono text-[10px] text-slate-300 uppercase">
                      {colorHex}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_PALETTE.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => {
                        setColorHex(p.hex);
                        setColor(p.name);
                      }}
                      className={`h-7 rounded-lg border flex items-center justify-center transition-all ${
                        colorHex.toLowerCase() === p.hex.toLowerCase()
                          ? "ring-2 ring-blue-500 scale-105 border-white"
                          : "border-slate-800 hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    >
                      {colorHex.toLowerCase() === p.hex.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-white filter drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    Personalizar Hexadecimal:
                  </span>
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-24 bg-[#111728] border border-[#1f2b45] rounded px-2 py-0.5 text-xs text-white font-mono uppercase"
                  />
                </div>
              </div>

              {/* Row 2: Weight, Tare, Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    PESO ATUAL (G) *
                  </label>
                  <input
                    type="number"
                    required
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(Number(e.target.value))}
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    PESO ORIGINAL (G)
                  </label>
                  <input
                    type="number"
                    value={originalWeightGrams}
                    onChange={(e) =>
                      setOriginalWeightGrams(Number(e.target.value))
                    }
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    CUSTO POR KG (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    value={costPerKg}
                    onChange={(e) => setCostPerKg(Number(e.target.value))}
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Row 3: Tare, Diameter, Store, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    TARA CARRETEL (G)
                  </label>
                  <input
                    type="number"
                    value={tareGrams}
                    onChange={(e) => setTareGrams(Number(e.target.value))}
                    placeholder="200"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    DIÂMETRO (MM)
                  </label>
                  <select
                    value={diameterMm}
                    onChange={(e) => setDiameterMm(Number(e.target.value))}
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-2.5 py-2 text-white outline-none cursor-pointer"
                  >
                    <option value={1.75}>1.75 mm</option>
                    <option value={2.85}>2.85 mm</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    FORNECEDOR / LOJA
                  </label>
                  <input
                    type="text"
                    value={purchaseStore}
                    onChange={(e) => setPurchaseStore(e.target.value)}
                    placeholder="Shopee, ML"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    STATUS DO ITEM
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SpoolStatus)}
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-2.5 py-2 text-white outline-none cursor-pointer"
                  >
                    <option value="in_stock">Em Estoque</option>
                    <option value="on_the_way">A Caminho</option>
                    <option value="empty">Vazio</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  NOTAS / PARÂMETROS DE IMPRESSÃO
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: 215°C bico, 60°C mesa, retração 0.8mm"
                  className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1b253b]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {editingSpool ? "Salvar Alterações" : "Cadastrar Carretel"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Deduct Grams Modal */}
      {deductModalSpool && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c111e] border border-[#1f2c47] rounded-2xl w-full max-w-sm shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#1b253b] pb-2">
              <div className="flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Descontar Gramas Impressas
                </h3>
              </div>
              <button
                onClick={() => setDeductModalSpool(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Carretel:{" "}
              <strong className="text-white">
                {deductModalSpool.brand} • {deductModalSpool.material} (
                {deductModalSpool.color})
              </strong>
            </p>
            <p className="text-xs text-slate-400">
              Peso atual:{" "}
              <strong className="text-emerald-400">
                {deductModalSpool.weightGrams}g
              </strong>
            </p>

            <div>
              <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                QUANTIDADE A DESCONTAR (G)
              </label>
              <input
                type="number"
                min="1"
                max={deductModalSpool.weightGrams}
                value={gramsToDeduct}
                onChange={(e) => setGramsToDeduct(Number(e.target.value))}
                className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white font-bold outline-none focus:border-amber-500"
              />
            </div>

            <div className="text-[11px] text-slate-400 bg-[#090d18] p-2 rounded-lg border border-[#18233a]">
              Novo saldo:{" "}
              <strong className="text-white">
                {Math.max(0, deductModalSpool.weightGrams - gramsToDeduct)}g
              </strong>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1b253b]">
              <button
                type="button"
                onClick={() => setDeductModalSpool(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeduct}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md"
              >
                Confirmar Desconto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
