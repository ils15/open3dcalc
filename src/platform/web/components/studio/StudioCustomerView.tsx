import React, { useMemo, useRef, useState } from "react";
import {
  Users,
  Plus,
  Mail,
  Phone,
  Building,
  FileText,
  Edit2,
  Trash2,
  Calendar,
  Check,
  X,
  Sparkles,
  MapPin,
  FileCheck,
  Upload,
  Eye,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { Customer, CustomerFormData, Quote } from "@/shared/types";
import { PiiWriteRefusalNotice } from "@/shared/components/Privacy/PiiWriteRefusalNotice";
import { importData } from "@/shared/lib/dataSync";
import {
  beginPiiSurfaceWrite,
  PII_STORE_KEY,
} from "@/shared/lib/localPiiPersistence";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { useWorkspaceContainerClass } from "./workspaceWidth";
import { StudioKpiStrip, type StudioKpiItem } from "./StudioKpiStrip";
import { StudioViewToolbar } from "./StudioViewToolbar";
import { StudioSplitInspector } from "./StudioSplitInspector";
import type { StudioQuoteModalSeed } from "./StudioQuoteModal";

interface StudioCustomerViewProps {
  onTabChange: (tab: Tab) => void;
  onOpenQuoteModal: (seed?: StudioQuoteModalSeed) => void;
}

const QUOTE_STATUS_LABEL: Record<Quote["status"], string> = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
};

export const StudioCustomerView: React.FC<StudioCustomerViewProps> = ({
  onTabChange,
  onOpenQuoteModal,
}) => {
  const containerClass = useWorkspaceContainerClass();
  const { format: formatCurrency } = useCurrency();
  const isDemoMode = useIsDemoMode();
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const removeCustomer = useCustomerStore((s) => s.removeCustomer);
  const quotes = useQuoteStore((s) => s.quotes);

  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const quotesByCustomer = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const quote of quotes) {
      if (!quote.customerId) continue;
      const list = map.get(quote.customerId) ?? [];
      list.push(quote);
      map.set(quote.customerId, list);
    }
    return map;
  }, [quotes]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importData(file, { mode: "merge" });
      setFeedbackMsg(`${res.imported} categoria(s) importada(s) com sucesso!`);
    } catch (err) {
      setFeedbackMsg(
        err instanceof Error ? err.message : "Falha ao importar clientes.",
      );
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setCompany(c.company || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setNotes(c.notes || "");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setErrorMsg("O nome do cliente deve ter pelo menos 2 caracteres.");
      return;
    }

    const payload: CustomerFormData = {
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };

    if (beginPiiSurfaceWrite(PII_STORE_KEY.customers) !== null) return;

    try {
      if (editingCustomer) {
        updateCustomer(editingCustomer.id, payload);
      } else {
        addCustomer(payload);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao salvar cliente.";
      setErrorMsg(msg);
    }
  };

  const handleDeleteCustomer = (customerId: string): void => {
    if (beginPiiSurfaceWrite(PII_STORE_KEY.customers) !== null) return;
    removeCustomer(customerId);
    if (selectedCustomerId === customerId) {
      setSelectedCustomerId(null);
    }
  };

  // Filter
  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q))
        );
      }),
    [customers, search],
  );

  const selectedCustomer = useMemo(
    () => filteredCustomers.find((c) => c.id === selectedCustomerId) ?? null,
    [filteredCustomers, selectedCustomerId],
  );

  const selectedCustomerQuotes = selectedCustomer
    ? (quotesByCustomer.get(selectedCustomer.id) ?? [])
    : [];
  const selectedCustomerApprovedTotal = selectedCustomerQuotes
    .filter((q) => q.status === "approved")
    .reduce((acc, q) => acc + (q.total || 0), 0);

  const totalQuotes = customers.reduce((acc, c) => {
    const linked = quotesByCustomer.get(c.id)?.length ?? 0;
    return acc + Math.max(c.quoteCount || 0, linked);
  }, 0);
  const activeClients = customers.filter(
    (c) =>
      (c.quoteCount || 0) > 0 || (quotesByCustomer.get(c.id)?.length ?? 0) > 0,
  ).length;

  const kpiItems: StudioKpiItem[] = [
    {
      id: "total-customers",
      label: "TOTAL DE CLIENTES",
      value: customers.length,
      unit: "cadastrados",
      subtitle: isDemoMode
        ? "Clientes modelo do Estúdio"
        : "Armazenamento local seguro (LGPD)",
      icon: <Users className="w-4 h-4 text-positive" />,
    },
    {
      id: "active-customers",
      label: "CLIENTES ATIVOS",
      value: activeClients,
      unit: "com pedidos",
      subtitle:
        customers.length > 0
          ? `${Math.round((activeClients / customers.length) * 100)}% de taxa de conversão`
          : "0% conversão",
      icon: <FileCheck className="w-4 h-4 text-info" />,
      tone: "info",
    },
    {
      id: "linked-quotes",
      label: "PROPOSTAS VINCULADAS",
      value: totalQuotes,
      unit: "orçamentos",
      subtitle: "Propostas nominais geradas",
      icon: <FileText className="w-4 h-4 text-accent" />,
      tone: "accent",
    },
    {
      id: "quick-action",
      label: "AÇÃO RÁPIDA",
      value: "Envio Direto",
      subtitle: "Envie propostas com 1 clique",
      icon: <Sparkles className="w-4 h-4 text-warning" />,
      actionLabel: "Calcular nova peça →",
      onAction: () => onTabChange("calculator"),
    },
  ];

  const handleWhatsApp = (customer: Customer): void => {
    if (guardExport()) return;
    const cleanPhone = (customer.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(
      `Olá, ${customer.name}! Tudo bem?\n` +
        `Estou entrando em contato através do Open3DCalc Studio para falar sobre seus orçamentos de impressão 3D.`,
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
  };

  return (
    <div
      className={`flex flex-col gap-6 text-text-primary ${containerClass} pb-20`}
    >
      {!isModalOpen && (
        <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />
      )}
      {feedbackMsg !== null && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-positive/40 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-positive"
        >
          {feedbackMsg}
        </div>
      )}

      <StudioKpiStrip items={kpiItems} />

      <StudioViewToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, empresa, e-mail ou telefone..."
        filters={
          <span className="text-text-secondary text-xs font-semibold hidden md:inline">
            {filteredCustomers.length} de {customers.length} clientes
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => onOpenQuoteModal()}
              className="flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-semibold transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-info" />
              <span>Nova Proposta</span>
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept=".open3dcalc,.json,application/json"
              onChange={handleImportFile}
              className="sr-only"
              aria-label="Importar clientes ou backup"
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              title="Importar clientes (.json ou .open3dcalc)"
              className="flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-semibold transition-all shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importar</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-positive-fill)] hover:brightness-110 text-[var(--color-positive-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Cliente</span>
            </button>
          </>
        }
      />

      {/* Customers Grid + Split Inspector */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Users className="w-12 h-12 text-text-disabled mb-3" />
          <h3 className="text-base font-bold text-text-primary mb-1">
            {search
              ? "Nenhum cliente encontrado"
              : "Nenhum cliente cadastrado ainda"}
          </h3>
          <p className="text-xs text-text-secondary max-w-md mb-6 leading-relaxed">
            {search
              ? "Tente buscar por outro termo ou limpe a pesquisa."
              : "Cadastre seus primeiros contatos para emitir orçamentos nominais em PDF e gerenciar propostas no WhatsApp."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-positive-fill)] hover:brightness-110 text-[var(--color-positive-fill-fg)] text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Cliente</span>
            </button>
            {!isDemoMode && (
              <button
                type="button"
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-accent/40 text-accent text-xs font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Carregar Dados de Demonstração</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <StudioSplitInspector
          isOpen={selectedCustomer !== null}
          onClose={() => setSelectedCustomerId(null)}
          title={selectedCustomer?.name || "Detalhes do Cliente"}
          subtitle={
            selectedCustomer?.company ||
            (selectedCustomer ? "Pessoa Física" : undefined)
          }
          inspectorContent={
            selectedCustomer ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 bg-surface-sunken border border-border-subtle rounded-xl p-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-text-muted block">
                      Orçamentos
                    </span>
                    <span className="text-base font-extrabold text-text-primary">
                      {Math.max(
                        selectedCustomer.quoteCount || 0,
                        selectedCustomerQuotes.length,
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase text-text-muted block">
                      LTV Aprovado
                    </span>
                    <span className="text-base font-extrabold text-positive font-mono">
                      {formatCurrency(selectedCustomerApprovedTotal)}
                    </span>
                  </div>
                </div>

                <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3 space-y-1.5 text-[11px] text-text-secondary">
                  {selectedCustomer.phone ? (
                    <div className="flex justify-between">
                      <span>Telefone</span>
                      <strong className="text-text-primary">
                        {selectedCustomer.phone}
                      </strong>
                    </div>
                  ) : null}
                  {selectedCustomer.email ? (
                    <div className="flex justify-between gap-2">
                      <span>E-mail</span>
                      <strong className="text-text-primary truncate">
                        {selectedCustomer.email}
                      </strong>
                    </div>
                  ) : null}
                  {selectedCustomer.address ? (
                    <div className="flex justify-between gap-2">
                      <span>Endereço</span>
                      <strong className="text-text-primary truncate">
                        {selectedCustomer.address}
                      </strong>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-text-secondary">
                      Propostas Vinculadas ({selectedCustomerQuotes.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => onTabChange("quotes")}
                      className="text-[11px] font-semibold text-accent hover:underline"
                    >
                      Abrir Orçamentos →
                    </button>
                  </div>
                  {selectedCustomerQuotes.length === 0 ? (
                    <p className="text-[11px] text-text-muted bg-surface-sunken border border-border-subtle rounded-xl p-3">
                      Nenhuma proposta vinculada a este cliente ainda.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {selectedCustomerQuotes.map((quote) => (
                        <div
                          key={quote.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-sunken px-3 py-2"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-text-primary block truncate">
                              #{String(quote.number).padStart(3, "0")} ·{" "}
                              {quote.title}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {QUOTE_STATUS_LABEL[quote.status]}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-positive shrink-0">
                            {formatCurrency(quote.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null
          }
          footer={
            selectedCustomer ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onOpenQuoteModal({ initialCustomerId: selectedCustomer.id })
                  }
                  className="flex-1 flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:brightness-110 text-[var(--color-accent-fill-fg)] font-bold text-xs transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Criar Orçamento</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(selectedCustomer)}
                  className="flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-sunken hover:bg-surface-overlay border border-border-subtle text-text-primary font-semibold text-xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </>
            ) : null
          }
        >
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${
              selectedCustomer
                ? "xl:grid-cols-2 2xl:grid-cols-3"
                : "xl:grid-cols-3 2xl:grid-cols-4"
            } gap-4`}
          >
            {filteredCustomers.map((customer) => {
              const initials = customer.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              const dateFormatted = new Date(
                customer.createdAt,
              ).toLocaleDateString("pt-BR");

              const linkedQuotes = quotesByCustomer.get(customer.id) ?? [];
              const liveQuoteCount = Math.max(
                customer.quoteCount || 0,
                linkedQuotes.length,
              );
              const customerLtv = linkedQuotes
                .filter((q) => q.status === "approved")
                .reduce((acc, q) => acc + (q.total || 0), 0);
              const isSelected = selectedCustomer?.id === customer.id;

              return (
                <div
                  key={customer.id}
                  onClick={() =>
                    setSelectedCustomerId((prev) =>
                      prev === customer.id ? null : customer.id,
                    )
                  }
                  className={`cursor-pointer bg-surface-raised hover:bg-surface-overlay/50 border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all group ${
                    isSelected
                      ? "border-accent ring-1 ring-accent/30"
                      : "border-border-subtle hover:border-border"
                  }`}
                >
                  {/* Top card info */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--color-positive-fill)] text-[var(--color-positive-fill-fg)] font-bold flex items-center justify-center text-sm shadow-sm">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-text-primary group-hover:text-positive transition-colors truncate">
                            {customer.name}
                          </h3>
                          {customer.company ? (
                            <span className="text-[11px] text-text-secondary flex items-center gap-1 truncate">
                              <Building className="w-3 h-3 text-text-muted shrink-0" />
                              <span className="truncate">
                                {customer.company}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted font-mono">
                              Pessoa Física
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-overlay border border-border-subtle text-text-secondary font-semibold">
                          {liveQuoteCount} orçamentos
                        </span>
                        {customerLtv > 0 ? (
                          <span className="text-[10px] font-mono font-bold text-positive">
                            {formatCurrency(customerLtv)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Contact channels */}
                    <div className="flex flex-col gap-1.5 text-xs text-text-secondary bg-surface-sunken rounded-xl p-2.5 border border-border-subtle">
                      {customer.phone ? (
                        <div
                          className="flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="flex items-center gap-1.5 text-text-secondary text-[11px] truncate">
                            <Phone className="w-3 h-3 text-positive shrink-0" />
                            <span className="truncate">{customer.phone}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleWhatsApp(customer)}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-positive/30 bg-positive-subtle px-2.5 text-[11px] font-semibold text-positive transition-colors hover:border-[var(--positive-fill)] hover:bg-[var(--positive-fill)] hover:text-[var(--positive-fill-fg)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
                            aria-label={`Enviar mensagem para ${customer.name} no WhatsApp`}
                          >
                            <BrandIcon
                              brand="whatsapp"
                              className="h-3.5 w-3.5"
                            />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      ) : null}

                      {customer.email ? (
                        <div
                          className="flex items-center gap-1.5 text-text-secondary text-[11px] truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="w-3 h-3 text-info shrink-0" />
                          {isDemoMode ? (
                            <button
                              type="button"
                              onClick={() => guardExport()}
                              aria-label={`Enviar e-mail para ${customer.name}`}
                              className="hover:text-info truncate transition-colors"
                            >
                              {customer.email}
                            </button>
                          ) : (
                            <a
                              href={`mailto:${customer.email}`}
                              className="hover:text-info truncate transition-colors"
                            >
                              {customer.email}
                            </a>
                          )}
                        </div>
                      ) : null}

                      {customer.address ? (
                        <div className="flex items-center gap-1.5 text-text-muted text-[11px] truncate">
                          <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                          <span className="truncate">{customer.address}</span>
                        </div>
                      ) : null}

                      {customer.notes ? (
                        <div className="mt-1 pt-1.5 border-t border-border-subtle text-[11px] text-text-secondary italic line-clamp-2">
                          "{customer.notes}"
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Footer with date and actions */}
                  <div
                    className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Desde {dateFormatted}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCustomerId((prev) =>
                            prev === customer.id ? null : customer.id,
                          )
                        }
                        className="flex min-h-11 min-w-11 items-center justify-center p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-overlay transition-colors"
                        title="Inspecionar cliente"
                        aria-label={`Inspecionar ${customer.name}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(customer)}
                        className="flex min-h-11 min-w-11 items-center justify-center p-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-overlay transition-colors"
                        title="Editar Cliente"
                        aria-label={`Editar ${customer.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="flex min-h-11 min-w-11 items-center justify-center p-1.5 text-text-secondary hover:text-critical rounded-lg hover:bg-critical-subtle transition-colors"
                        title="Excluir Cliente"
                        aria-label={`Excluir ${customer.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </StudioSplitInspector>
      )}

      {/* Modal: Create / Edit Customer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--color-overlay-scrim)] backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-customer-dialog-title"
            className="bg-surface-raised border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col gap-4"
          >
            <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-positive" />
                <h2
                  id="studio-customer-dialog-title"
                  className="text-sm font-bold text-text-primary"
                >
                  {editingCustomer
                    ? "Editar Dados do Cliente"
                    : "Cadastrar Novo Cliente"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-sunken transition-colors"
                aria-label="Fechar formulário de cliente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-critical-subtle border border-critical/40 text-critical text-xs"
              >
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-text-secondary block mb-1">
                    NOME COMPLETO *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-positive"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-text-secondary block mb-1">
                    EMPRESA / PROJETO
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: Studio Design Ltda"
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-positive"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-text-secondary block mb-1">
                    WHATSAPP / TELEFONE
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-positive"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-text-secondary block mb-1">
                    E-MAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: joao@empresa.com"
                    className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-positive"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-text-secondary block mb-1">
                  ENDEREÇO / ENTREGA
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP"
                  className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-positive"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-text-secondary block mb-1">
                  OBSERVAÇÕES / PREFERÊNCIAS
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Cliente prefere PETG e entrega expressa."
                  className="w-full bg-surface-raised border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-positive resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 px-3.5 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-positive-fill)] hover:brightness-110 text-[var(--color-positive-fill-fg)] font-bold transition-all shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {editingCustomer ? "Salvar Alterações" : "Cadastrar"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
