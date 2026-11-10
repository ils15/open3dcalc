import React, { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Send,
  Sparkles,
  Settings,
  Plus,
  Trash2,
  Phone,
  User,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import confetti from "canvas-confetti";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { useCustomerStore } from "@/shared/stores/customerStore";
import {
  useWorkshopProfileStore,
  renderWhatsAppMessage,
  type WhatsAppTemplateContext,
} from "@/shared/stores/workshopProfileStore";

export interface StudioWhatsAppModalInitialData {
  clientName?: string;
  clientPhone?: string;
  clientCompany?: string;
  projectName?: string;
  items?: string;
  totalValue?: number | string;
  leadTime?: string;
  paymentTerms?: string;
}

interface StudioWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: StudioWhatsAppModalInitialData;
}

interface StudioWhatsAppModalDialogProps {
  onClose: () => void;
  initialData?: StudioWhatsAppModalInitialData;
}

const StudioWhatsAppModalDialog: React.FC<StudioWhatsAppModalDialogProps> = ({
  onClose,
  initialData,
}) => {
  const customers = useCustomerStore((s) => s.customers);
  const {
    profile,
    templates,
    addTemplate,
    removeTemplate,
    resetTemplatesToDefault,
  } = useWorkshopProfileStore();

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>("quick_quote");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (!initialData?.clientName) return "";
    const found = customers.find(
      (c) => c.name.toLowerCase() === initialData.clientName?.toLowerCase(),
    );
    return found ? found.id : "";
  });

  const [clientName, setClientName] = useState(
    initialData?.clientName || "",
  );
  const [clientPhone, setClientPhone] = useState(
    initialData?.clientPhone || "",
  );
  const [clientCompany, setClientCompany] = useState(
    initialData?.clientCompany || "",
  );
  const [projectName, setProjectName] = useState(
    initialData?.projectName || "Projeto 3D",
  );
  const [itemsText, setItemsText] = useState(
    initialData?.items || initialData?.projectName || "Projeto 3D",
  );
  const [totalValue, setTotalValue] = useState(() => {
    if (typeof initialData?.totalValue === "number") {
      return initialData.totalValue.toFixed(2).replace(".", ",");
    }
    return initialData?.totalValue || "0,00";
  });
  const [leadTime, setLeadTime] = useState(
    initialData?.leadTime || profile.defaultLeadTime || "3 a 5 dias úteis",
  );
  const [paymentTerms, setPaymentTerms] = useState(
    initialData?.paymentTerms ||
      profile.defaultPaymentTerms ||
      "50% entrada e 50% entrega",
  );

  const [customMessageText, setCustomMessageText] = useState<string | null>(
    null,
  );
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");

  const currentTemplate = useMemo(() => {
    return (
      templates.find((t) => t.id === selectedTemplateId) || templates[0]
    );
  }, [templates, selectedTemplateId]);

  const context: WhatsAppTemplateContext = useMemo(
    () => ({
      cliente: clientName || "Cliente",
      empresa: clientCompany,
      projeto: projectName || "Peça 3D",
      itens: itemsText || projectName || "1x Peça Personalizada",
      valor_total: totalValue || "0,00",
      prazo: leadTime || profile.defaultLeadTime || "3 a 5 dias úteis",
      condicoes_pagamento:
        paymentTerms || profile.defaultPaymentTerms || "PIX / A combinar",
      validade: "10 dias",
      chave_pix: profile.pixKey || "",
      tipo_chave_pix: profile.pixType,
      nome_oficina: profile.workshopName || "Oficina 3D",
      telefone_oficina: profile.phone || "",
      responsavel: profile.ownerName || "",
    }),
    [
      clientName,
      clientCompany,
      projectName,
      itemsText,
      totalValue,
      leadTime,
      paymentTerms,
      profile,
    ],
  );

  const computedMessage = useMemo(() => {
    return currentTemplate
      ? renderWhatsAppMessage(currentTemplate.content, context)
      : "";
  }, [currentTemplate, context]);

  const messageText = customMessageText ?? computedMessage;


  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (found) {
      setClientName(found.name);
      setClientCompany(found.company || "");
      if (found.phone) setClientPhone(found.phone);
    }
  };

  const handleSendWhatsApp = () => {
    if (guardExport()) return;
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
    const cleanDigits = clientPhone.replace(/\D/g, "");
    const encoded = encodeURIComponent(messageText);

    // If phone has at least 8 digits and lacks 55 country code for Brazil, format gracefully
    let destinationUrl = "https://wa.me/?text=" + encoded;
    if (cleanDigits.length >= 8) {
      const fullNumber = cleanDigits.startsWith("55") ? cleanDigits : `55${cleanDigits}`;
      destinationUrl = `https://wa.me/${fullNumber}?text=${encoded}`;
    }

    window.open(destinationUrl, "_blank");
  };

  const handleCopy = async () => {
    if (guardExport()) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
    }
  };

  const handleAddCustomTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
    const newId = addTemplate({
      name: newTemplateName,
      category: "custom",
      content: newTemplateContent,
    });
    setSelectedTemplateId(newId);
    setNewTemplateName("");
    setNewTemplateContent("");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-modal-title"
    >
      <div className="bg-surface-overlay border border-border-subtle rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-text-primary">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-raised shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-positive-fill)] flex items-center justify-center text-[var(--color-positive-fill-fg)] shadow-sm">
              <BrandIcon brand="whatsapp" className="w-4 h-4" />
            </div>
            <div>
              <h2 id="whatsapp-modal-title" className="font-bold text-sm sm:text-base leading-tight">
                Mensagens & Propostas para WhatsApp
              </h2>
              <p className="text-[11px] text-text-secondary leading-tight">
                Modelos inteligentes com pré-visualização em tempo real e dados da sua oficina
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsManagingTemplates(!isManagingTemplates)}
              aria-label="Gerenciar Modelos"
              title="Gerenciar modelos e mensagens customizadas"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isManagingTemplates
                  ? "bg-accent-subtle border-border-accent text-accent"
                  : "bg-surface-sunken border-border-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modelos</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="min-h-9 min-w-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {/* Template Selector Ribbon */}
          {!isManagingTemplates && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {templates.map((tpl) => {
                const isActive = tpl.id === selectedTemplateId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setCustomMessageText(null);
                      setIsEditingMessage(false);
                    }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                        : "bg-surface-sunken border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                    }`}
                  >
                    <span>{tpl.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Manage Templates Drawer */}
          {isManagingTemplates ? (
            <div className="flex flex-col gap-4 p-4 rounded-xl bg-surface-sunken border border-border-subtle">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Gerenciamento de Modelos de Mensagem
                </span>
                <button
                  type="button"
                  onClick={resetTemplatesToDefault}
                  className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Padrões</span>
                </button>
              </div>

              {/* Existing Templates list */}
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface-overlay border border-border-subtle text-xs"
                  >
                    <div className="flex flex-col min-w-0 pr-3">
                      <span className="font-bold truncate text-text-primary">{tpl.name}</span>
                      <span className="text-[11px] text-text-muted truncate">{tpl.content}</span>
                    </div>
                    {templates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTemplate(tpl.id)}
                        className="text-text-muted hover:text-danger p-1 shrink-0"
                        title="Remover modelo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Template Form */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle">
                <span className="text-xs font-bold text-text-primary">Criar Novo Modelo</span>
                <input
                  type="text"
                  placeholder="Nome do Modelo (ex: Promoção Fim de Ano)"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-surface-overlay border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <textarea
                  rows={3}
                  placeholder="Texto da mensagem com placeholders como {cliente}, {projeto}, {valor_total}, {prazo}..."
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  className="p-2.5 rounded-lg bg-surface-overlay border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono resize-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTemplate}
                  disabled={!newTemplateName.trim() || !newTemplateContent.trim()}
                  className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] text-xs font-bold disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Salvar Novo Modelo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Main 2-Column Grid: Context Form (Left) & WhatsApp Live Chat Bubble (Right) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[380px]">
              {/* Left Column: Context Inputs */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  Dados do Destinatário & Peça
                </span>

                {/* Customer Selector */}
                {customers.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      Vincular Cliente Cadastrado
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    >
                      <option value="">Digitação manual / Selecionar...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ""} {c.phone ? `• ${c.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Client Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      Nome do Cliente
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-3.5 h-3.5 absolute left-2.5 text-text-muted" />
                      <input
                        type="text"
                        placeholder="Ex: Carlos Silva"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      WhatsApp do Cliente
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="w-3.5 h-3.5 absolute left-2.5 text-text-muted" />
                      <input
                        type="text"
                        placeholder="(DDD) 99999-9999"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full h-9 pl-8 pr-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Project & Total Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      Identificação do Projeto
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Suporte Articulado"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      Valor Total (R$)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 85,00"
                      value={totalValue}
                      onChange={(e) => setTotalValue(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-semibold text-positive"
                    />
                  </div>
                </div>

                {/* Description of Items */}
                <div>
                  <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                    Descrição dos Itens / Peças
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1x Suporte de fone em PETG preto"
                    value={itemsText}
                    onChange={(e) => setItemsText(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>

                {/* Lead time & Payment terms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      Prazo Estimado
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2 a 3 dias úteis"
                      value={leadTime}
                      onChange={(e) => setLeadTime(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-text-secondary mb-1 block">
                      Condições de Pagamento
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: PIX com 5% desc."
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                  </div>
                </div>

                {/* Oficina Quick Info Badge */}
                <div className="mt-1 p-2.5 rounded-xl bg-surface-sunken border border-border-subtle flex items-center justify-between text-xs">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-bold text-text-primary truncate">{profile.workshopName}</span>
                    <span className="text-[11px] text-text-muted truncate">
                      PIX ({profile.pixType.toUpperCase()}): {profile.pixKey || "Não cadastrada"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle text-text-secondary shrink-0">
                    Auto-preenchido
                  </span>
                </div>
              </div>

              {/* Right Column: Live WhatsApp Bubble & Editable Text */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span>Prévia da Mensagem (Estilo WhatsApp)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingMessage(!isEditingMessage)}
                    className="text-[11px] font-medium text-accent hover:underline"
                  >
                    {isEditingMessage ? "Voltar à Prévia Formatada" : "Editar Texto Livremente"}
                  </button>
                </div>

                {/* WhatsApp Chat Container Simulation */}
                <div className="flex-1 flex flex-col justify-end rounded-xl border border-border-subtle bg-[#0b141a]/95 p-3.5 sm:p-4 min-h-[290px] shadow-inner relative overflow-hidden">
                  {/* Subtle WhatsApp wallpaper doodle background effect */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#25d366_1px,transparent_1px)] [background-size:16px_16px]" />

                  {isEditingMessage ? (
                    <textarea
                      rows={12}
                      value={messageText}
                      onChange={(e) => setCustomMessageText(e.target.value)}
                      className="w-full flex-1 p-3 rounded-lg bg-[#1f2c34] border border-[#2a3942] text-xs text-[#e9edef] font-mono outline-none focus:ring-2 focus:ring-[#00a884] resize-none leading-relaxed"
                    />
                  ) : (
                    /* The Speech Bubble */
                    <div className="self-end max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tr-none bg-[#005c4b] text-[#e9edef] p-3.5 shadow-md flex flex-col gap-1.5 text-xs leading-relaxed break-words font-sans">
                      <div className="whitespace-pre-wrap">
                        {messageText.split("\n").map((line, idx) => (
                          <div key={idx} className="min-h-[1.1rem]">
                            {/* Render basic bold *...* inline */}
                            {line.split(/(\*[^*]+\*)/g).map((chunk, cIdx) => {
                              if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
                                return (
                                  <strong key={cIdx} className="font-bold text-white">
                                    {chunk.slice(1, -1)}
                                  </strong>
                                );
                              }
                              return chunk;
                            })}
                          </div>
                        ))}
                      </div>

                      {/* Bubble footer with time and double checkmark */}
                      <div className="self-end flex items-center gap-1 text-[10px] text-[#8696a0] select-none mt-1">
                        <span>
                          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[#53bdeb] font-bold">✓✓</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Placeholders hint */}
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted overflow-x-auto py-0.5">
                  <span className="shrink-0 font-medium">Placeholders:</span>
                  {["{cliente}", "{projeto}", "{valor_total}", "{prazo}", "{chave_pix}"].map((ph) => (
                    <span
                      key={ph}
                      className="shrink-0 px-1.5 py-0.5 rounded bg-surface-sunken border border-border-subtle font-mono text-[10px]"
                    >
                      {ph}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border-subtle bg-surface-raised flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-text-secondary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-positive)] inline-block animate-pulse" />
            <span>
              {clientPhone ? `Destino: ${clientPhone}` : "Sem telefone informado (abrirá seletor)"}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex min-h-11 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-sunken text-xs font-semibold text-text-primary hover:bg-surface-raised transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-positive" />
                  <span className="text-positive font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Copiar Mensagem</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex min-h-11 items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg border border-[var(--color-positive-fill)] bg-[var(--color-positive-fill)] text-xs font-bold text-[var(--color-positive-fill-fg)] shadow-sm hover:brightness-110 active:scale-[.98] transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar no WhatsApp</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StudioWhatsAppModal: React.FC<StudioWhatsAppModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  if (!isOpen) return null;

  return (
    <StudioWhatsAppModalDialog
      onClose={onClose}
      initialData={initialData}
    />
  );
};
