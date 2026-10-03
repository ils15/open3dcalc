import React, { useState } from "react";
import {
  Users,
  Search,
  Plus,
  MessageCircle,
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
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useIsDemoMode } from "@/shared/hooks/useDemoMode";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { Customer, CustomerFormData } from "@/shared/types";
import { PiiWriteRefusalNotice } from "@/shared/components/Privacy/PiiWriteRefusalNotice";
import {
  beginPiiSurfaceWrite,
  PII_STORE_KEY,
} from "@/shared/lib/crypto/piiStoreHydration";
import { guardExport } from "@/shared/lib/demoExportGuard";

interface StudioCustomerViewProps {
  onTabChange: (tab: Tab) => void;
  onOpenQuoteModal: () => void;
}

export const StudioCustomerView: React.FC<StudioCustomerViewProps> = ({
  onTabChange,
  onOpenQuoteModal,
}) => {
  const isDemoMode = useIsDemoMode();
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const removeCustomer = useCustomerStore((s) => s.removeCustomer);

  const [search, setSearch] = useState("");
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
  };

  // Filter
  const filteredCustomers = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const totalQuotes = customers.reduce(
    (acc, c) => acc + (c.quoteCount || 0),
    0,
  );
  const activeClients = customers.filter((c) => (c.quoteCount || 0) > 0).length;

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
    <div className="flex flex-col gap-6 text-slate-100 max-w-full pb-20">
      {!isModalOpen && (
        <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0c111e] border border-[#1b253b] rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              CRM & RELACIONAMENTO COM CLIENTES
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Carteira de Clientes da Oficina
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie contatos, empresas parceiras e acompanhe o histórico de
            propostas emitidas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuoteModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131b2e] hover:bg-[#1a253e] border border-[#212d47] text-slate-200 text-xs font-semibold transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Nova Proposta Comercial</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:ring-2 hover:ring-emerald-500/40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Customers */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TOTAL DE CLIENTES
            </span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              {customers.length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">cadastrados</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {isDemoMode
              ? "Clientes modelo do Estúdio"
              : "Armazenamento local seguro (LGPD)"}
          </div>
        </div>

        {/* Active Customers */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              CLIENTES ATIVOS
            </span>
            <FileCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-white">
              {activeClients}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">com pedidos</span>
          </div>
          <div className="text-[10px] text-blue-400">
            {customers.length > 0
              ? `${Math.round((activeClients / customers.length) * 100)}% de taxa de conversão`
              : "0% conversão"}
          </div>
        </div>

        {/* Quotes generated */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              PROPOSTAS VINCULADAS
            </span>
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-purple-400">
              {totalQuotes}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">orçamentos</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Propostas nominais geradas
          </div>
        </div>

        {/* Quick action card */}
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-semibold">
              AÇÃO RÁPIDA
            </span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-sm font-bold text-white block">
              Envio Direto WhatsApp
            </span>
            <span className="text-[11px] text-slate-400">
              Envie propostas com 1 clique
            </span>
          </div>
          <button
            onClick={() => onTabChange("calculator")}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-bold text-left"
          >
            Calcular nova peça →
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0c111e] border border-[#1b253b] rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, e-mail ou telefone..."
            className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="text-slate-400 text-xs font-semibold">
          Exibindo {filteredCustomers.length} de {customers.length} clientes
        </div>
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Users className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {search
              ? "Nenhum cliente encontrado"
              : "Nenhum cliente cadastrado ainda"}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            {search
              ? "Tente buscar por outro termo ou limpe a pesquisa."
              : "Cadastre seus primeiros contatos para emitir orçamentos nominais em PDF e gerenciar propostas no WhatsApp."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:ring-2 hover:ring-emerald-500/40 text-white text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Cliente</span>
            </button>
            {!isDemoMode && (
              <button
                onClick={() => useDemoModeStore.getState().enter()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14122b] hover:bg-[#1b1938] border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Carregar Dados de Demonstração</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            return (
              <div
                key={customer.id}
                className="bg-[#0c111e] hover:bg-[#0f1526] border border-[#1b253b] hover:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all group"
              >
                {/* Top card info */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {customer.name}
                        </h3>
                        {customer.company ? (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-500" />
                            <span>{customer.company}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Pessoa Física
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#141b2c] border border-[#212d48] text-slate-300 font-semibold">
                      {customer.quoteCount || 0} orçamentos
                    </span>
                  </div>

                  {/* Contact channels */}
                  <div className="flex flex-col gap-1.5 text-xs text-slate-300 bg-[#080d18] rounded-xl p-2.5 border border-[#172238]">
                    {customer.phone && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{customer.phone}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleWhatsApp(customer)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                          aria-label={`Enviar mensagem para ${customer.name} no WhatsApp`}
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    )}

                    {customer.email && (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                        <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                        {isDemoMode ? (
                          <button
                            type="button"
                            onClick={() => guardExport()}
                            aria-label={`Enviar e-mail para ${customer.name}`}
                            className="hover:text-blue-300 truncate transition-colors"
                          >
                            {customer.email}
                          </button>
                        ) : (
                          <a
                            href={`mailto:${customer.email}`}
                            className="hover:text-blue-300 truncate transition-colors"
                          >
                            {customer.email}
                          </a>
                        )}
                      </div>
                    )}

                    {customer.address && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    )}

                    {customer.notes && (
                      <div className="mt-1 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400 italic line-clamp-2">
                        "{customer.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with date and actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1b253b] text-xs">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Desde {dateFormatted}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(customer)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#151c2f] transition-colors"
                      title="Editar Cliente"
                      aria-label={`Editar ${customer.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-colors"
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
      )}

      {/* Modal: Create / Edit Customer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-customer-dialog-title"
            className="bg-[#0c111e] border border-[#1f2c47] rounded-2xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col gap-4"
          >
            <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.customers} />
            <div className="flex items-center justify-between border-b border-[#1b253b] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 id="studio-customer-dialog-title" className="text-sm font-bold text-white">
                  {editingCustomer
                    ? "Editar Dados do Cliente"
                    : "Cadastrar Novo Cliente"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Fechar formulário de cliente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs"
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
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    NOME COMPLETO *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    EMPRESA / PROJETO
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: Studio Design Ltda"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    WHATSAPP / TELEFONE
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                    E-MAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: joao@empresa.com"
                    className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  ENDEREÇO / ENTREGA
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP"
                  className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                  OBSERVAÇÕES / PREFERÊNCIAS
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Cliente prefere PETG e entrega expressa."
                  className="w-full bg-[#111728] border border-[#1f2b45] rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1b253b] mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:ring-2 hover:ring-emerald-500/40 text-white font-bold transition-all shadow-md"
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
