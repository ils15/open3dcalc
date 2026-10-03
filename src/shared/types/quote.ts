export interface QuoteItem {
  historyEntryId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountPercent: number;
}

export interface Quote {
  id: string;
  number: number;
  title: string;
  customerId?: string;
  customerSnapshot?: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
  };
  items: QuoteItem[];
  globalDiscountPercent: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  status: "draft" | "sent" | "approved" | "rejected";
  validUntil: string;
  paymentTerms: string;
  deliveryEstimate: string;
  footerNote?: string;
  createdAt: number;
  updatedAt: number;
  exportedAt?: number;
}

/**
 * Transient input shape for `quoteStore.addQuote`. Never persisted.
 *
 * `Quote` above is the single authority for a stored quote, and this interface
 * deliberately does not widen it: customer identity travels as
 * `customerSnapshot` — the same field, the same shape, never a second
 * `customerName` — and a line carries `unitPrice` (never a `total` beside
 * `totalPrice`), so the store stays the only thing that computes money.
 *
 * The caller is the price authority (@athena, wave W1). A form knows the price
 * it just asked for; the store cannot invent one, and a hardcoded `0` is how
 * every new quote came to be born worth R$ 0,00.
 */
export interface QuoteFormData {
  title: string;
  customerId?: string;
  customerSnapshot?: Quote["customerSnapshot"];
  items: Array<{
    historyEntryId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
  }>;
  globalDiscountPercent: number;
  /** Defaults to `draft` when omitted. */
  status?: Quote["status"];
  validUntil: string;
  paymentTerms: string;
  deliveryEstimate: string;
  footerNote?: string;
}
