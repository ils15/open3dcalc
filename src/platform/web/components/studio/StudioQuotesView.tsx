import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  Check,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Eye,
  Download,
  MessageCircle,
  List,
  LayoutGrid,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { Quote, QuoteFormData } from "@/shared/types";
import { PiiWriteRefusalNotice } from "@/shared/components/Privacy/PiiWriteRefusalNotice";
import {
  PII_STORE_KEY,
  beginPiiSurfaceWrite,
} from "@/shared/lib/crypto/piiStoreHydration";
import { downloadBlob } from "@/shared/lib/download";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { jsPDF } from "jspdf";
import confetti from "canvas-confetti";

interface StudioQuotesViewProps {
  onTabChange?: (tab: Tab) => void;
  onOpenNewQuote?: () => void;
}

type FeedbackTone = "positive" | "warning" | "critical";

/** Status text and borders pair with theme-reactive semantic surfaces. */
const FEEDBACK_CLASS: Record<FeedbackTone, string> = {
  positive: "border-positive/40 text-positive",
  warning: "border-warning/40 text-warning",
  critical: "border-critical/40 text-critical",
};

const STATUS_CONFIG: Record<
  Quote["status"],
  { label: string; color: string; bg: string; border: string }
> = {
  draft: {
    label: "Rascunho",
    color: "text-text-secondary",
    bg: "bg-surface-sunken",
    border: "border-border-subtle",
  },
  sent: {
    label: "Enviado",
    color: "text-info",
    bg: "bg-accent-subtle",
    border: "border-accent/40",
  },
  approved: {
    label: "Aprovado",
    color: "text-positive",
    bg: "bg-positive-subtle",
    border: "border-positive/40",
  },
  rejected: {
    label: "Recusado",
    color: "text-critical",
    bg: "bg-critical-subtle",
    border: "border-critical/40",
  },
};

export const StudioQuotesView: React.FC<StudioQuotesViewProps> = () => {
  const { t } = useTranslation();
  const quotes = useQuoteStore((s) => s.quotes);
  const addQuote = useQuoteStore((s) => s.addQuote);
  const updateQuote = useQuoteStore((s) => s.updateQuote);
  const removeQuote = useQuoteStore((s) => s.removeQuote);
  const setQuoteStatus = useQuoteStore((s) => s.setQuoteStatus);
  const customers = useCustomerStore((s) => s.customers);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Quote["status"]>(
    "all",
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  // Consumes `quotes.saveSuccess` (pt-BR/en-US parity) via the same polite
  // status-banner pattern as ProductActionsCard, so a save is confirmed in the
  // user's language instead of only by a confetti burst.
  const [feedback, setFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  // Monotonic id source for typed (non-history) quote lines. A ref, not
  // `Date.now()`: identity must not come from an impure render-phase read.
  const itemSeq = useRef(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState<Quote["status"]>("draft");
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(
    "50% entrada + 50% na entrega",
  );
  const [notes, setNotes] = useState("");
  const [deliveryEstimate, setDeliveryEstimate] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [items, setItems] = useState<
    {
      name: string;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
    }[]
  >([]);

  // Filtered quotes
  const filteredQuotes = quotes.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const customer = customers.find((c) => c.id === q.customerId);
    // `customerSnapshot` is the single authority for the customer's name on a
    // stored quote. The live customer record wins when it is still around;
    // the snapshot is what keeps the quote readable after a customer is gone.
    const snapshotName = q.customerSnapshot?.name;
    return (
      q.title.toLowerCase().includes(query) ||
      String(q.number).includes(query) ||
      (snapshotName && snapshotName.toLowerCase().includes(query)) ||
      (customer && customer.name.toLowerCase().includes(query))
    );
  });

  // KPI calculations
  const totalQuotesCount = quotes.length;
  const approvedQuotes = quotes.filter((q) => q.status === "approved");
  const approvedTotal = approvedQuotes.reduce(
    (acc, q) => acc + (q.total || 0),
    0,
  );
  const pendingQuotes = quotes.filter(
    (q) => q.status === "sent" || q.status === "draft",
  );
  const pendingTotal = pendingQuotes.reduce(
    (acc, q) => acc + (q.total || 0),
    0,
  );
  const avgTicket =
    totalQuotesCount > 0
      ? quotes.reduce((acc, q) => acc + (q.total || 0), 0) / totalQuotesCount
      : 0;

  const openCreateModal = () => {
    setEditingQuote(null);
    setTitle("Orçamento de Impressão 3D");
    setCustomerId(customers[0]?.id || "");
    setCustomerName(customers[0]?.name || "");
    setStatus("draft");
    // Default validity: 15 days ahead
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setValidUntil(d.toISOString().slice(0, 10));
    setPaymentTerms("50% sinal + 50% entrega (PIX)");
    setNotes("Peças produzidas em alta resolução com tolerância de encaixe.");
    setGlobalDiscount(0);
    setItems([
      {
        name: "Peça Impressa Sob Demanda",
        quantity: 1,
        unitPrice: 65.0,
        discountPercent: 0,
      },
    ]);
    setIsFormOpen(true);
  };

  const openEditModal = (q: Quote) => {
    setEditingQuote(q);
    setTitle(q.title);
    setCustomerId(q.customerId || "");
    setCustomerName(q.customerSnapshot?.name || "");
    setStatus(q.status);
    setValidUntil(q.validUntil || "");
    setPaymentTerms(q.paymentTerms || "");
    setNotes(q.footerNote || "");
    setDeliveryEstimate(q.deliveryEstimate || "");
    setGlobalDiscount(q.globalDiscountPercent || 0);
    setItems(
      q.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent || 0,
      })),
    );
    setIsFormOpen(true);
  };

  const addItemToForm = () => {
    setItems((prev) => [
      ...prev,
      {
        name: "Novo Item 3D",
        quantity: 1,
        unitPrice: 30.0,
        discountPercent: 0,
      },
    ]);
  };

  const removeItemFromForm = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemInForm = (
    idx: number,
    field: "name" | "quantity" | "unitPrice" | "discountPercent",
    value: string | number,
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        [field]: field === "name" ? value : Number(value) || 0,
      };
      return copy;
    });
  };

  const formSubtotal = items.reduce(
    (acc, it) => acc + it.quantity * it.unitPrice,
    0,
  );
  const formDiscountVal = formSubtotal * (globalDiscount / 100);
  const formTotal = Math.max(0, formSubtotal - formDiscountVal);

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || items.length === 0) return;

    // H-4: refuse BEFORE the quote enters memory. With a locked vault the store
    // mutates in memory, the UI would say "saved", the vault would reject the
    // write, and the quote would evaporate on reload with no message at all.
    if (beginPiiSurfaceWrite(PII_STORE_KEY.quotes) !== null) return;

    const payload: QuoteFormData = {
      title,
      customerId: customerId || undefined,
      customerSnapshot: customerName.trim()
        ? { name: customerName.trim() }
        : undefined,
      status,
      validUntil,
      paymentTerms,
      footerNote: notes || undefined,
      globalDiscountPercent: globalDiscount,
      // The caller owns the price: this form is where the unit price was
      // typed, so it travels with the line instead of the store guessing 0.
      items: items.map((it) => ({
        historyEntryId: `quote_item_${itemSeq.current++}`,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
      })),
      deliveryEstimate,
    };

    if (editingQuote) {
      // `updateQuote` takes a `Partial<Quote>`, so the edit path must hand it
      // real `QuoteItem`s — including `totalPrice`, which only the store is
      // allowed to derive. Deriving it here with the same formula keeps the
      // persisted shape identical to the `addQuote` path.
      updateQuote(editingQuote.id, {
        title: payload.title,
        customerId: payload.customerId,
        customerSnapshot: payload.customerSnapshot,
        status: payload.status,
        validUntil: payload.validUntil,
        paymentTerms: payload.paymentTerms,
        deliveryEstimate: payload.deliveryEstimate,
        footerNote: payload.footerNote,
        globalDiscountPercent: payload.globalDiscountPercent,
        items: payload.items.map((item, idx) => ({
          historyEntryId:
            editingQuote.items[idx]?.historyEntryId ?? item.historyEntryId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice:
            item.quantity * item.unitPrice * (1 - item.discountPercent / 100),
          discountPercent: item.discountPercent,
        })),
        subtotal: formSubtotal,
        discountAmount: formDiscountVal,
        total: formTotal,
        // `updatedAt` is the store's to set — `updateQuote` stamps it itself,
        // so the view never has to read the clock.
      });
      setFeedback({ tone: "positive", message: t("quotes.updatedSuccess") });
    } else {
      addQuote(payload);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      setFeedback({ tone: "positive", message: t("quotes.saveSuccess") });
    }

    setIsFormOpen(false);
  };

  // Export Quote to Professional PDF using jsPDF
  const exportQuoteToPdf = (quote: Quote) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const customer = customers.find((c) => c.id === quote.customerId);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;

    // Header Dark Banner
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.roundedRect(margin, margin, contentWidth, 24, 3, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("OPEN3DCALC STUDIO", margin + 8, margin + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(190, 210, 245);
    doc.text(
      "Proposta Comercial & Orçamento de Impressão 3D",
      margin + 8,
      margin + 17,
    );

    // Number & Date on right
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(
      `ORÇAMENTO #${String(quote.number).padStart(3, "0")}`,
      pageWidth - margin - 8,
      margin + 10,
      { align: "right" },
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(200, 220, 255);
    doc.text(
      `Data: ${new Date(quote.createdAt).toLocaleDateString("pt-BR")}`,
      pageWidth - margin - 8,
      margin + 17,
      { align: "right" },
    );

    let y = margin + 30;

    // Customer & Proposal Info
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `CLIENTE: ${customer?.name || quote.customerSnapshot?.name || "Cliente sem cadastro nominal"}`,
      margin + 6,
      y + 7,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (customer?.email || customer?.phone) {
      doc.text(
        `Contato: ${customer.email || ""} ${customer.phone ? `• Tel: ${customer.phone}` : ""}`,
        margin + 6,
        y + 13,
      );
    }
    if (quote.validUntil) {
      doc.text(
        `Validade da Proposta: até ${new Date(quote.validUntil).toLocaleDateString("pt-BR")}`,
        pageWidth - margin - 6,
        y + 7,
        { align: "right" },
      );
    }

    y += 26;

    // Table Header
    doc.setFillColor(37, 99, 235); // Blue 600
    doc.rect(margin, y, contentWidth, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("ITEM / DESCRIÇÃO DA PEÇA", margin + 4, y + 5);
    doc.text("QTD", margin + 110, y + 5, { align: "center" });
    doc.text("UNITÁRIO", margin + 135, y + 5, { align: "right" });
    doc.text("TOTAL", pageWidth - margin - 4, y + 5, { align: "right" });

    y += 7;

    // Items rows
    quote.items.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      doc.setFillColor(
        isEven ? 255 : 248,
        isEven ? 255 : 250,
        isEven ? 255 : 252,
      );
      doc.rect(margin, y, contentWidth, 7, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.name, margin + 4, y + 5);
      doc.text(String(item.quantity), margin + 110, y + 5, { align: "center" });
      doc.text(
        `R$ ${item.unitPrice.toFixed(2).replace(".", ",")}`,
        margin + 135,
        y + 5,
        { align: "right" },
      );
      const itemTot =
        item.quantity *
        item.unitPrice *
        (1 - (item.discountPercent || 0) / 100);
      doc.setFont("helvetica", "bold");
      doc.text(
        `R$ ${itemTot.toFixed(2).replace(".", ",")}`,
        pageWidth - margin - 4,
        y + 5,
        { align: "right" },
      );

      y += 7;
    });

    y += 4;

    // Totals Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.5);
    doc.roundedRect(pageWidth - margin - 75, y, 75, 24, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Subtotal:", pageWidth - margin - 70, y + 6);
    doc.text(
      `R$ ${(quote.subtotal || quote.total).toFixed(2).replace(".", ",")}`,
      pageWidth - margin - 5,
      y + 6,
      { align: "right" },
    );

    if (quote.globalDiscountPercent > 0) {
      doc.text(
        `Desconto (-${quote.globalDiscountPercent}%):`,
        pageWidth - margin - 70,
        y + 12,
      );
      doc.text(
        `R$ ${(quote.discountAmount || 0).toFixed(2).replace(".", ",")}`,
        pageWidth - margin - 5,
        y + 12,
        { align: "right" },
      );
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(5, 150, 105);
    doc.text("TOTAL:", pageWidth - margin - 70, y + 19);
    doc.text(
      `R$ ${quote.total.toFixed(2).replace(".", ",")}`,
      pageWidth - margin - 5,
      y + 19,
      { align: "right" },
    );

    y += 30;

    // Conditions and Notes
    if (quote.paymentTerms || quote.footerNote) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("CONDIÇÕES DE FORNECIMENTO:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      if (quote.paymentTerms) {
        doc.text(
          `• Condições de Pagamento: ${quote.paymentTerms}`,
          margin,
          y + 5,
        );
      }
      if (quote.footerNote) {
        doc.text(`• Observações: ${quote.footerNote}`, margin, y + 10);
      }
    }

    // Funnel through the single choke point. `doc.save()` would reach the disk
    // by itself, bypassing `downloadBlob` and with it the demo-export guard —
    // a parallel funnel by construction.
    downloadBlob(
      doc.output("blob"),
      `Orcamento_${String(quote.number).padStart(3, "0")}.pdf`,
    );
  };

  // WhatsApp Share helper
  const shareWhatsApp = (q: Quote): void => {
    if (guardExport()) return;
    const customer = customers.find((c) => c.id === q.customerId);
    const text = encodeURIComponent(
      `Olá ${customer ? customer.name : ""}! Segue a proposta comercial de impressão 3D:\n` +
        `📋 *Orçamento #${String(q.number).padStart(3, "0")} - ${q.title}*\n` +
        `📦 Itens: ${q.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}\n` +
        `💰 *Valor Total: R$ ${q.total.toFixed(2).replace(".", ",")}*\n` +
        `💳 Pagamento: ${q.paymentTerms || "A combinar"}\n` +
        `Ficamos à disposição para iniciar a produção!`,
    );
    const phone = customer?.phone ? customer.phone.replace(/\D/g, "") : "";
    const url = phone
      ? `https://wa.me/55${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col gap-6 text-text-primary max-w-full pb-20">
      {/* H-4: a locked vault refuses the write at the persistence layer. Without
          this the store mutates in memory, the list shows the new quote, and it
          evaporates on reload with no message. */}
      {!isFormOpen && !viewingQuote && confirmDeleteId === null && (
        <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.quotes} />
      )}
      {feedback !== null && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border bg-surface-raised px-4 py-2.5 text-xs font-semibold ${FEEDBACK_CLASS[feedback.tone]}`}
        >
          {feedback.message}
        </div>
      )}
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-positive animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-positive font-bold">
              CENTRAL DE ORÇAMENTOS & PROPOSTAS COMERCIAIS
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
            Gestão de Propostas Comerciais
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Crie, envie e gerencie orçamentos profissionais em PDF com
            rastreamento de status e clientes
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex min-h-11 items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md shadow-accent/40 self-start md:self-auto hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {/* KPI Bento Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Quotes */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TOTAL DE ORÇAMENTOS
            </span>
            <FileText className="w-4 h-4 text-info" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-text-primary">
              {totalQuotesCount}
            </span>
            <span className="text-xs text-text-secondary ml-1.5">emitidos</span>
          </div>
          <div className="text-[10px] text-text-muted">
            {pendingQuotes.length} em negociação / rascunho
          </div>
        </div>

        {/* Total Aprovado */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              VALOR TOTAL APROVADO
            </span>
            <Check className="w-4 h-4 text-positive" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-positive">
              R$ {approvedTotal.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-positive font-medium">
            {approvedQuotes.length} pedidos fechados
          </div>
        </div>

        {/* Em Aberto */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              VALOR EM ABERTO
            </span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-warning">
              R$ {pendingTotal.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Potencial de fechamento imediato
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] font-mono uppercase font-semibold">
              TICKET MÉDIO
            </span>
            <DollarSign className="w-4 h-4 text-accent" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-accent">
              R$ {avgTicket.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Média por pedido gerado
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-raised border border-border-subtle rounded-2xl p-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, título ou cliente..."
            className="w-full bg-surface-raised border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controls: Status Pills and View Switcher */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(["all", "draft", "sent", "approved", "rejected"] as const).map(
              (st) => {
                const count =
                  st === "all"
                    ? quotes.length
                    : quotes.filter((q) => q.status === st).length;
                const label = st === "all" ? "Todos" : STATUS_CONFIG[st].label;
                const isActive = statusFilter === st;

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                        : "bg-surface-raised text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isActive ? "bg-surface-sunken" : "bg-surface-sunken"}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              },
            )}
          </div>

          {/* View Mode Toggle: Lista vs Cards */}
          <div className="flex items-center bg-surface-raised border border-border-subtle rounded-xl p-0.5 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex min-h-11 items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                viewMode === "list"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Visualização em Lista / Tabela"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex min-h-11 items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                viewMode === "grid"
                  ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Visualização em Grade de Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quote List or Cards (Modern Studio Views) */}
      {filteredQuotes.length === 0 ? (
        <div className="bg-surface-raised border border-border-subtle rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-subtle border border-accent/20 flex items-center justify-center text-info mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">
            Nenhum orçamento encontrado
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mb-4">
            {search || statusFilter !== "all"
              ? "Nenhum orçamento corresponde aos filtros aplicados."
              : "Gere orçamentos formais com cálculo de peças, prazos e download de PDF comercial."}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] text-xs font-bold transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Primeiro Orçamento</span>
          </button>
        </div>
      ) : viewMode === "list" ? (
        /* Modern Studio List / Table View */
        <div className="bg-surface-raised border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken text-[10px] font-mono uppercase tracking-wider text-text-secondary">
                  <th className="py-3.5 px-4 font-bold">CÓDIGO</th>
                  <th className="py-3.5 px-4 font-bold">CLIENTE</th>
                  <th className="py-3.5 px-4 font-bold">PROPOSTA & PEÇAS</th>
                  <th className="py-3.5 px-4 font-bold">DATA / EMISSÃO</th>
                  <th className="py-3.5 px-4 font-bold text-center">STATUS</th>
                  <th className="py-3.5 px-4 font-bold text-right">
                    VALOR TOTAL
                  </th>
                  <th className="py-3.5 px-4 font-bold text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredQuotes.map((quote) => {
                  const customer = customers.find(
                    (c) => c.id === quote.customerId,
                  );
                  const statusCfg = STATUS_CONFIG[quote.status];
                  const customerDisplayName = customer
                    ? customer.name
                    : quote.customerSnapshot?.name ||
                      "Cliente sem cadastro nominal";
                  const dateStr = new Date(quote.createdAt).toLocaleDateString(
                    "pt-BR",
                  );

                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-surface-raised transition-colors group"
                    >
                      {/* Código */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs font-mono font-bold text-info px-2 py-1 rounded bg-accent-subtle border border-accent/20">
                          #{String(quote.number).padStart(3, "0")}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-surface-sunken border border-border-subtle flex items-center justify-center text-[10px] font-bold text-text-secondary">
                            {customerDisplayName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-text-primary block">
                              {customerDisplayName}
                            </span>
                            {customer?.company && (
                              <span className="text-[10px] text-text-secondary">
                                {customer.company}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Proposta & Peças */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-xs md:max-w-md">
                          <span className="font-bold text-text-secondary block truncate group-hover:text-info transition-colors">
                            {quote.title}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-secondary truncate">
                            <span className="px-1.5 py-0.2 rounded bg-surface-sunken text-[10px] text-text-secondary font-mono">
                              {quote.items.length}{" "}
                              {quote.items.length === 1 ? "item" : "itens"}
                            </span>
                            <span className="truncate">
                              {quote.items
                                .map((it) => `${it.quantity}x ${it.name}`)
                                .join(", ")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-text-secondary font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-text-muted" />
                          <span>{dateStr}</span>
                        </div>
                        {quote.validUntil && (
                          <span className="text-[10px] text-text-muted block">
                            Até{" "}
                            {new Date(quote.validUntil).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-block text-[10px] font-mono uppercase px-2.5 py-1 rounded-full font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Valor Total */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <span className="text-sm font-extrabold text-positive font-mono">
                          R$ {quote.total.toFixed(2).replace(".", ",")}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingQuote(quote)}
                            className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-accent-subtle hover:bg-accent-subtle text-info border border-accent/30 transition-colors"
                            title="Visualizar Proposta"
                            aria-label={`Visualizar proposta #${String(quote.number).padStart(3, "0")} para ${customerDisplayName}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => exportQuoteToPdf(quote)}
                            className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle transition-colors"
                            title="Download em PDF Comercial"
                            aria-label={`Baixar orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName} em PDF`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => shareWhatsApp(quote)}
                            className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-positive-subtle hover:bg-positive-subtle text-positive border border-positive/30 transition-colors"
                            title="Enviar no WhatsApp"
                            aria-label={`Enviar orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName} no WhatsApp`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(quote)}
                            className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle transition-colors"
                            title="Editar Orçamento"
                            aria-label={`Editar orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!isBetaChannel && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(quote.id)}
                              className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-surface-sunken hover:bg-critical-subtle text-text-secondary hover:text-critical border border-border-subtle hover:border-critical/30 transition-colors"
                              title="Excluir Orçamento"
                              aria-label={`Excluir orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Modern Studio Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => {
            const customer = customers.find((c) => c.id === quote.customerId);
            const customerDisplayName = customer
              ? customer.name
              : quote.customerSnapshot?.name || "Cliente sem cadastro nominal";
            const statusCfg = STATUS_CONFIG[quote.status];

            return (
              <div
                key={quote.id}
                className="bg-surface-raised hover:bg-surface-raised border border-border-subtle hover:border-border-subtle rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all group relative"
              >
                {/* Header: Number, Status, Date */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-info px-2 py-0.5 rounded bg-accent-subtle border border-accent/20">
                      #{String(quote.number).padStart(3, "0")}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-text-primary group-hover:text-info transition-colors line-clamp-1">
                    {quote.title}
                  </h3>

                  {/* Customer row */}
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1 truncate">
                    <Users className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="truncate text-text-secondary font-medium">
                      {customer
                        ? customer.name
                        : quote.customerSnapshot?.name ||
                          "Cliente sem cadastro nominal"}
                    </span>
                  </div>

                  {/* Items summary */}
                  <div className="bg-surface-sunken border border-border-subtle rounded-xl p-2.5 mt-3 flex flex-col gap-1.5">
                    <div className="text-[11px] text-text-secondary flex items-center justify-between">
                      <span>
                        {quote.items.length}{" "}
                        {quote.items.length === 1 ? "item" : "itens"} no pedido
                      </span>
                      <span className="font-mono text-text-muted">
                        {new Date(quote.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {quote.items.slice(0, 2).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs text-text-secondary truncate"
                        >
                          <span className="truncate text-[11px]">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-mono text-text-secondary text-[10px] ml-2">
                            R${" "}
                            {(item.quantity * item.unitPrice)
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                        </div>
                      ))}
                      {quote.items.length > 2 && (
                        <span className="text-[10px] text-text-muted italic block">
                          +{quote.items.length - 2} outro(s) item(ns)...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total and Action Buttons */}
                <div className="pt-2 border-t border-border-subtle flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-text-muted">
                      VALOR TOTAL:
                    </span>
                    <span className="text-base font-extrabold text-positive font-mono">
                      R$ {quote.total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewingQuote(quote)}
                      className="flex-1 flex min-h-11 items-center justify-center gap-1 py-1.5 rounded-lg bg-accent-subtle hover:bg-accent-subtle text-info font-semibold text-xs border border-accent/30 transition-colors"
                      title="Visualizar detalhes da proposta"
                      aria-label={`Visualizar proposta #${String(quote.number).padStart(3, "0")} para ${customerDisplayName}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportQuoteToPdf(quote)}
                      className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary transition-colors border border-border-subtle"
                      title="Download em PDF"
                      aria-label={`Baixar orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName} em PDF`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => shareWhatsApp(quote)}
                      className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-positive-subtle hover:bg-positive-subtle text-positive transition-colors border border-positive/30"
                      title="Compartilhar no WhatsApp"
                      aria-label={`Enviar orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName} no WhatsApp`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(quote)}
                      className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken text-text-secondary hover:text-text-primary transition-colors border border-border-subtle"
                      title="Editar Orçamento"
                      aria-label={`Editar orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {!isBetaChannel && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(quote.id)}
                        className="flex min-h-11 min-w-11 items-center justify-center p-1.5 rounded-lg bg-surface-sunken hover:bg-critical-subtle text-text-secondary hover:text-critical transition-colors border border-border-subtle hover:border-critical/30"
                        title="Excluir Orçamento"
                        aria-label={`Excluir orçamento #${String(quote.number).padStart(3, "0")} de ${customerDisplayName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Quote Modal in Studio Dark Theme */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-quote-form-title"
            className="bg-surface-raised border border-border-subtle rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 text-text-secondary animate-scale-in max-h-[90vh] overflow-y-auto"
          >
            <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.quotes} />
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <h3
                  id="studio-quote-form-title"
                  className="text-base font-bold text-text-primary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-info" />
                  {editingQuote
                    ? `Editar Orçamento #${String(editingQuote.number).padStart(3, "0")}`
                    : "Novo Orçamento Comercial"}
                </h3>
                <span className="text-xs text-text-secondary">
                  Preencha os itens e condições de fornecimento
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1"
                aria-label="Fechar proposta"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuote} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    TÍTULO DA PROPOSTA
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Lote de suportes para robótica"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    CLIENTE VINCULADO
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      const c = customers.find(
                        (cust) => cust.id === e.target.value,
                      );
                      if (c) setCustomerName(c.name);
                    }}
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                  >
                    <option value="">Selecione um cliente cadastrado...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status and Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    STATUS
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Quote["status"])
                    }
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="sent">Enviado</option>
                    <option value="approved">Aprovado</option>
                    <option value="rejected">Recusado</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    VALIDADE DA PROPOSTA
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    DESCONTO GLOBAL (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-border-subtle">
                  <span className="font-bold text-text-primary">
                    ITENS DO ORÇAMENTO
                  </span>
                  <button
                    type="button"
                    onClick={addItemToForm}
                    className="flex items-center gap-1 text-info hover:text-info font-bold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Peça</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-raised border border-border-subtle p-2.5 rounded-xl grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          value={it.name}
                          onChange={(e) =>
                            updateItemInForm(idx, "name", e.target.value)
                          }
                          placeholder="Nome da peça 3D..."
                          className="w-full bg-transparent border-b border-border-subtle px-1 py-1 text-xs text-text-primary outline-none focus:border-info"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-muted">
                            Qtd:
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) =>
                              updateItemInForm(idx, "quantity", e.target.value)
                            }
                            className="w-full bg-surface-raised border border-border-subtle rounded px-1.5 py-1 text-xs text-text-primary text-center outline-none"
                          />
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-muted">
                            R$:
                          </span>
                          <input
                            type="number"
                            step="0.5"
                            value={it.unitPrice}
                            onChange={(e) =>
                              updateItemInForm(idx, "unitPrice", e.target.value)
                            }
                            className="w-full bg-surface-raised border border-border-subtle rounded px-1.5 py-1 text-xs text-text-primary text-right outline-none"
                          />
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className="font-mono text-positive text-xs font-bold">
                          R${" "}
                          {(it.quantity * it.unitPrice)
                            .toFixed(2)
                            .replace(".", ",")}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItemFromForm(idx)}
                          className="text-text-muted hover:text-critical p-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase font-mono block mb-1">
                    CONDIÇÕES DE PAGAMENTO
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Ex: 50% entrada + 50% na entrega"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="studio-quote-delivery"
                    className="text-[10px] text-text-secondary uppercase font-mono block mb-1"
                  >
                    {t("quotes.deliveryEstimate")}
                  </label>
                  <input
                    id="studio-quote-delivery"
                    type="text"
                    value={deliveryEstimate}
                    onChange={(e) => setDeliveryEstimate(e.target.value)}
                    placeholder="Ex: 10 dias úteis"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="studio-quote-notes"
                    className="text-[10px] text-text-secondary uppercase font-mono block mb-1"
                  >
                    {t("quotes.footerNote")}
                  </label>
                  <input
                    id="studio-quote-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Frete por conta do estúdio"
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none"
                  />
                </div>
              </div>

              {/* Total Summary Footer */}
              <div className="bg-surface-sunken border border-border-subtle p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                  Subtotal:{" "}
                  <strong className="text-text-secondary">
                    R$ {formSubtotal.toFixed(2).replace(".", ",")}
                  </strong>
                  {globalDiscount > 0 && ` (-${globalDiscount}% desc)`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-secondary">
                    Total Final:
                  </span>
                  <span className="text-lg font-extrabold text-positive font-mono">
                    R$ {formTotal.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface-sunken hover:bg-surface-sunken transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-[var(--color-accent-fill-fg)] bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 transition-colors shadow-md"
                >
                  {editingQuote ? "Salvar Alterações" : "Criar Orçamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Quote Modal in Studio Dark Theme */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-quote-view-title"
            className="bg-surface-raised border border-border-subtle rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 text-text-secondary animate-scale-in"
          >
            <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.quotes} />
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <span className="text-[10px] font-mono text-info font-bold uppercase">
                  ORÇAMENTO #{String(viewingQuote.number).padStart(3, "0")}
                </span>
                <h3
                  id="studio-quote-view-title"
                  className="text-base font-bold text-text-primary"
                >
                  {viewingQuote.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingQuote(null)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                ✕
              </button>
            </div>

            {/* Status Switcher Quick Bar */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-surface-sunken border border-border-subtle text-xs">
              <span className="text-text-secondary text-[11px] font-medium">
                Alterar Status:
              </span>
              <div className="flex items-center gap-1">
                {(["draft", "sent", "approved", "rejected"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => {
                        if (
                          beginPiiSurfaceWrite(PII_STORE_KEY.quotes) !== null
                        ) {
                          return;
                        }
                        setQuoteStatus(viewingQuote.id, st);
                        setViewingQuote({ ...viewingQuote, status: st });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        viewingQuote.status === st
                          ? `${STATUS_CONFIG[st].bg} ${STATUS_CONFIG[st].color} border ${STATUS_CONFIG[st].border}`
                          : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {STATUS_CONFIG[st].label}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Items table */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase text-text-secondary font-bold">
                PEÇAS & PRODUTOS:
              </span>
              <div className="bg-surface-sunken border border-border-subtle rounded-xl p-3 space-y-2">
                {viewingQuote.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs border-b border-border-subtle pb-1.5 last:border-none last:pb-0"
                  >
                    <span className="text-text-secondary">
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-mono text-positive font-bold">
                      R${" "}
                      {(it.quantity * it.unitPrice)
                        .toFixed(2)
                        .replace(".", ",")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total and Notes */}
            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono block">
                  CONDIÇÕES:
                </span>
                <span className="text-xs text-text-secondary">
                  {viewingQuote.paymentTerms || "A combinar"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted uppercase font-mono block">
                  TOTAL DA PROPOSTA:
                </span>
                <span className="text-xl font-extrabold text-positive font-mono">
                  R$ {viewingQuote.total.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => shareWhatsApp(viewingQuote)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-positive bg-positive-subtle hover:bg-positive-subtle border border-positive/30 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => exportQuoteToPdf(viewingQuote)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[var(--color-accent-fill-fg)] bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 transition-colors shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && !isBetaChannel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="studio-quote-delete-title"
            aria-describedby="studio-quote-delete-description"
            className="bg-surface-raised border border-border-subtle rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-3 text-text-secondary"
          >
            <PiiWriteRefusalNotice storeKey={PII_STORE_KEY.quotes} />
            <h4
              id="studio-quote-delete-title"
              className="text-sm font-bold text-text-primary"
            >
              Excluir Orçamento?
            </h4>
            <p
              id="studio-quote-delete-description"
              className="text-xs text-text-secondary"
            >
              Esta ação removerá permanentemente este orçamento. Deseja
              prosseguir?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    isBetaChannel ||
                    beginPiiSurfaceWrite(PII_STORE_KEY.quotes) !== null
                  ) {
                    return;
                  }
                  removeQuote(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-critical hover:ring-2 hover:ring-critical/40 text-text-inverse"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
