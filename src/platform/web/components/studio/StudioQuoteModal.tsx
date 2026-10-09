import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  MessageSquare,
  FileText,
  Printer,
  Table,
} from "lucide-react";
import confetti from "canvas-confetti";
import { downloadBlob } from "@/shared/lib/download";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { serializeCsvRows } from "@/shared/lib/csvExport";

interface StudioQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  material?: string;
  weightGrams?: number;
  hours?: number;
  minutes?: number;
  totalCost?: number;
  sellPrice?: number;
  profit?: number;
}

export const StudioQuoteModal: React.FC<StudioQuoteModalProps> = ({
  isOpen,
  onClose,
  projectName = "Suporte de Impressão 3D",
  material = "PLA Basic",
  weightGrams = 120,
  hours = 3,
  minutes = 45,
  totalCost = 18.5,
  sellPrice = 45.0,
  profit = 26.5,
}) => {
  const customers = useCustomerStore((s) => s.customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [clientName, setClientName] = useState("Cliente Especial");
  const [clientCompany, setClientCompany] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(
    "50% entrada + 50% entrega (PIX ou Cartão)",
  );
  const [deliveryDays, setDeliveryDays] = useState("2 a 3 dias úteis");
  const [proposalValidity, setProposalValidity] = useState("10 dias corridos");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  if (!isOpen) return null;

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (found) {
      setClientName(found.name);
      setClientCompany(found.company || "");
    }
  };

  const formattedSellPrice = (sellPrice || 45.0).toFixed(2).replace(".", ",");
  const formattedCost = (totalCost || 18.5).toFixed(2).replace(".", ",");
  const formattedProfit = (profit || 26.5).toFixed(2).replace(".", ",");
  const marginPercent =
    totalCost > 0 ? Math.round(((profit || 0) / totalCost) * 100) : 100;

  const quoteText =
    `*PROPOSTA COMERCIAL & ORÇAMENTO DE FABRICAÇÃO 3D*\n` +
    `===============================================\n` +
    `Projeto: *${projectName}*\n` +
    `Cliente: *${clientName}*${clientCompany ? ` (${clientCompany})` : ""}\n` +
    `Data de Emissão: ${new Date().toLocaleDateString("pt-BR")}\n` +
    `Validade da Proposta: ${proposalValidity}\n` +
    `-----------------------------------------------\n` +
    `ESPECIFICAÇÕES TÉCNICAS DA PEÇA:\n` +
    `• Material: ${material}\n` +
    `• Peso Estimado: ${weightGrams}g\n` +
    `• Tempo de Máquina: ${hours}h ${minutes}min\n` +
    `• Acabamento: Remoção de suportes & inspeção dimensional\n` +
    `-----------------------------------------------\n` +
    `CONDIÇÕES COMERCIAIS:\n` +
    `• Investimento Total: *R$ ${formattedSellPrice}*\n` +
    `• Prazo de Fabricação: ${deliveryDays}\n` +
    `• Condição de Pagamento: ${paymentTerms}\n` +
    `===============================================\n` +
    `Open3DCalc Studio • Oficina de Manufatura Digital`;

  const handleCopy = async (): Promise<void> => {
    if (guardExport()) return;
    if (!navigator.clipboard) {
      setCopied(false);
      setCopyError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopyError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  const handlePrint = (): void => {
    if (guardExport()) return;
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    window.print();
  };

  const handleDownloadCsv = (): void => {
    const csvContent = serializeCsvRows([
      {
        Projeto: projectName,
        Cliente: clientName,
        Material: material,
        Peso_g: weightGrams,
        Tempo_h: (hours + minutes / 60).toFixed(2),
        Custo_Fabricacao_BRL: totalCost.toFixed(2),
        Preco_Venda_BRL: sellPrice.toFixed(2),
        Lucro_BRL: profit.toFixed(2),
        Margem_Pct: `${marginPercent}%`,
        Data: new Date().toISOString(),
      },
    ]);

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    // Single funnel: `downloadBlob` is the only place a Blob reaches the disk,
    // and it is what refuses the write while the demo session is active.
    downloadBlob(
      blob,
      `Relatorio_${projectName.replace(/\s+/g, "_")}_${Date.now()}.csv`,
    );
  };

  const handleWhatsApp = (): void => {
    if (guardExport()) return;
    const text = encodeURIComponent(quoteText);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-quote-modal-title"
        className="bg-surface-overlay border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl p-6 flex flex-col gap-4 text-text-primary max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-positive-subtle border border-positive/30 flex items-center justify-center text-positive">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="studio-quote-modal-title"
                className="font-bold text-sm text-text-primary"
              >
                Gerador de Proposta Comercial & Relatório
              </h3>
              <p className="text-[11px] text-text-secondary">
                Emissão de orçamentos e relatórios técnicos de impressão 3D
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
            aria-label="Fechar proposta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {copyError && (
          <p role="alert" className="text-xs text-critical">
            Não foi possível copiar a proposta. Verifique as permissões do
            navegador.
          </p>
        )}

        {/* Customer Select Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-surface-sunken border border-border-subtle rounded-xl p-3">
          <div>
            <label className="text-[10px] font-mono uppercase text-text-secondary font-bold block mb-1">
              VINCULAR CLIENTE CADASTRADO
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Novo Cliente / Não cadastrado</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-text-secondary font-bold block mb-1">
              NOME DO CLIENTE NA PROPOSTA
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-positive font-medium"
            />
          </div>
        </div>

        {/* Commercial Terms Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-mono uppercase text-text-secondary font-bold block mb-1">
              PRAZO DE FABRICAÇÃO
            </label>
            <input
              type="text"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
              className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-text-secondary font-bold block mb-1">
              CONDIÇÃO PAGAMENTO
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-text-secondary font-bold block mb-1">
              VALIDADE PROPOSTA
            </label>
            <input
              type="text"
              value={proposalValidity}
              onChange={(e) => setProposalValidity(e.target.value)}
              className="w-full bg-surface-raised border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
            />
          </div>
        </div>

        {/* Live Proposal Preview */}
        <div className="border border-border-subtle bg-surface-sunken rounded-xl p-4 flex flex-col gap-3 font-sans">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-[10px] font-mono uppercase text-positive font-bold tracking-wider">
              PRÉVIA DO ORÇAMENTO COMERCIAL
            </span>
            <span className="text-[11px] font-mono text-text-secondary">
              Emitido em {new Date().toLocaleDateString("pt-BR")}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-sm font-bold text-text-primary block">
                {projectName}
              </span>
              <span className="text-xs text-text-secondary">
                Cliente:{" "}
                <strong className="text-text-secondary">{clientName}</strong>
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-text-secondary uppercase font-mono block">
                VALOR SUGERIDO
              </span>
              <span className="text-xl font-extrabold text-positive">
                R$ {formattedSellPrice}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-surface-raised p-2.5 rounded-lg border border-border-subtle">
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-mono block">
                Material
              </span>
              <span className="font-semibold text-text-primary truncate block">
                {material}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-mono block">
                Peso
              </span>
              <span className="font-semibold text-text-primary">
                {weightGrams}g
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-mono block">
                Tempo
              </span>
              <span className="font-semibold text-text-primary">
                {hours}h {minutes}m
              </span>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-mono block">
                Custo
              </span>
              <span className="font-semibold text-text-secondary">
                R$ {formattedCost}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-positive uppercase font-mono block font-bold">
                Lucro (+{marginPercent}%)
              </span>
              <span className="font-bold text-positive">
                R$ {formattedProfit}
              </span>
            </div>
          </div>

          {/* Formatted Text Box */}
          <div className="bg-surface-sunken border border-border-subtle rounded-lg p-2.5 text-[11px] font-mono text-text-secondary whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
            {quoteText}
          </div>
        </div>

        {/* Action Buttons: 4 export methods */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary font-semibold transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-positive" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-subtle text-text-secondary font-semibold transition-colors"
              title="Exportar planilha CSV para Excel / Sheets"
            >
              <Table className="w-3.5 h-3.5 text-accent" />
              <span>Exportar CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-accent/40 text-info font-bold transition-all shadow-sm"
              title="Imprimir ou salvar como PDF no navegador"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-positive hover:ring-2 hover:ring-positive/40 text-text-inverse font-bold transition-all shadow-md shadow-positive/50"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Enviar no WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
