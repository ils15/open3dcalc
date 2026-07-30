import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Quote, Customer } from '@/shared/types'

// ── Color palette ────────────────────────────────────────────
const INDIGO = '#6366f1'
const EMERALD = '#059669'
const GRAY_100 = '#f3f4f6'
const GRAY_200 = '#e5e7eb'
const GRAY_400 = '#9ca3af'
const GRAY_500 = '#6b7280'
const GRAY_600 = '#4b5563'
const GRAY_800 = '#1f2937'
const WHITE = '#ffffff'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: WHITE,
  },
  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2 solid ${INDIGO}`,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoImage: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  headerTitles: {
    flexDirection: 'column',
  },
  quoteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: INDIGO,
    letterSpacing: 1,
  },
  companyName: {
    fontSize: 10,
    color: GRAY_500,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: GRAY_400,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerValue: {
    fontSize: 10,
    color: GRAY_800,
    fontWeight: 'bold',
    marginTop: 2,
  },
  // ── Client Section ────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: GRAY_600,
    borderBottom: `1 solid ${GRAY_200}`,
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  clientCol: {
    width: '50%',
    marginBottom: 4,
  },
  clientLabel: {
    fontSize: 7,
    color: GRAY_400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  clientValue: {
    fontSize: 10,
    color: GRAY_800,
  },
  // ── Table ─────────────────────────────────────────────────────
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: INDIGO,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 'bold',
    color: WHITE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1 solid ${GRAY_200}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: GRAY_100,
  },
  tableCell: {
    fontSize: 9,
    color: GRAY_800,
  },
  tableCellRight: {
    fontSize: 9,
    color: GRAY_800,
    textAlign: 'right',
  },
  // ── Totals ────────────────────────────────────────────────────
  totalsSection: {
    marginTop: 12,
    marginLeft: 'auto',
    width: '45%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontSize: 9,
    color: GRAY_500,
  },
  totalValue: {
    fontSize: 9,
    color: GRAY_800,
    textAlign: 'right',
  },
  totalRowHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: EMERALD,
    borderRadius: 4,
    marginTop: 4,
  },
  totalLabelHighlight: {
    fontSize: 10,
    fontWeight: 'bold',
    color: WHITE,
  },
  totalValueHighlight: {
    fontSize: 12,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'right',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#fef2f2',
  },
  discountLabel: {
    fontSize: 9,
    color: '#dc2626',
  },
  discountValue: {
    fontSize: 9,
    color: '#dc2626',
    textAlign: 'right',
  },
  // ── Footer ────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    borderTop: `1 solid ${GRAY_200}`,
    paddingTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  footerBlock: {
    width: '48%',
  },
  footerLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: GRAY_400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 9,
    color: GRAY_600,
  },
  privacyNote: {
    fontSize: 7,
    color: GRAY_400,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // ── Empty state ───────────────────────────────────────────────
  emptyItems: {
    textAlign: 'center',
    color: GRAY_400,
    fontSize: 10,
    paddingVertical: 20,
  },
})

// ── Column widths ────────────────────────────────────────────
const COL_QTY = '10%'
const COL_DESC = '40%'
const COL_UNIT = '22%'
const COL_TOTAL = '28%'

interface QuoteDocProps {
  quote: Quote
  customer?: Customer
  currencySymbol: string
  logoBase64?: string
  locale?: string
}

function formatPrice(value: number, symbol: string, locale: string): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${symbol} ${formatted}`
}

function formatDate(dateStr: string, locale: string): string {
  if (!dateStr) return '---'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString(locale)
}

export function QuoteDoc({
  quote,
  customer,
  currencySymbol,
  logoBase64,
  locale = 'pt-BR',
}: QuoteDocProps) {
  const formattedDate = quote.createdAt
    ? new Date(quote.createdAt).toLocaleDateString(locale)
    : '---'

  const displayCustomer = customer
    ? {
        name: customer.name,
        company: customer.company,
        email: customer.email,
        phone: customer.phone,
      }
    : quote.customerSnapshot
      ? quote.customerSnapshot
      : null

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoBase64 && (
              <Image style={styles.logoImage} src={logoBase64} />
            )}
            <View style={styles.headerTitles}>
              <Text style={styles.quoteTitle}>
                ORÇAMENTO #{String(quote.number).padStart(3, '0')}
              </Text>
              <Text style={styles.companyName}>
                {quote.title}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>Data</Text>
            <Text style={styles.headerValue}>{formattedDate}</Text>
            <Text style={[styles.headerLabel, { marginTop: 4 }]}>
              Validade
            </Text>
            <Text style={styles.headerValue}>
              {quote.validUntil ? formatDate(quote.validUntil, locale) : '---'}
            </Text>
          </View>
        </View>

        {/* ── Client ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          {displayCustomer ? (
            <View style={styles.clientGrid}>
              <View style={styles.clientCol}>
                <Text style={styles.clientLabel}>Nome</Text>
                <Text style={styles.clientValue}>
                  {displayCustomer.name}
                </Text>
              </View>
              {displayCustomer.company && (
                <View style={styles.clientCol}>
                  <Text style={styles.clientLabel}>Empresa</Text>
                  <Text style={styles.clientValue}>
                    {displayCustomer.company}
                  </Text>
                </View>
              )}
              {displayCustomer.email && (
                <View style={styles.clientCol}>
                  <Text style={styles.clientLabel}>Email</Text>
                  <Text style={styles.clientValue}>
                    {displayCustomer.email}
                  </Text>
                </View>
              )}
              {displayCustomer.phone && (
                <View style={styles.clientCol}>
                  <Text style={styles.clientLabel}>Telefone</Text>
                  <Text style={styles.clientValue}>
                    {displayCustomer.phone}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ fontSize: 10, color: GRAY_400, fontStyle: 'italic' }}>
              Cliente não informado
            </Text>
          )}
        </View>

        {/* ── Items Table ────────────────────────────────────── */}
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Itens</Text>

          {quote.items.length === 0 ? (
            <Text style={styles.emptyItems}>
              Nenhum item adicionado ao orçamento
            </Text>
          ) : (
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: COL_QTY }]}>
                  Qtd
                </Text>
                <Text style={[styles.tableHeaderCell, { width: COL_DESC }]}>
                  Descrição
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: COL_UNIT, textAlign: 'right' },
                  ]}
                >
                  V. Unit.
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: COL_TOTAL, textAlign: 'right' },
                  ]}
                >
                  Total
                </Text>
              </View>

              {/* Table Rows */}
              {quote.items.map((item, idx) => {
                const lineTotal = item.quantity * item.unitPrice
                const discountedTotal =
                  item.discountPercent > 0
                    ? lineTotal * (1 - item.discountPercent / 100)
                    : lineTotal
                return (
                  <View
                    key={item.historyEntryId + idx}
                    style={[
                      styles.tableRow,
                      (idx % 2 === 1 ? styles.tableRowAlt : {}),
                    ]}
                  >
                    <Text style={[styles.tableCell, { width: COL_QTY }]}>
                      {item.quantity}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: COL_DESC },
                      ]}
                    >
                      {item.name}
                      {item.discountPercent > 0 && (
                        <Text style={{ color: '#dc2626', fontSize: 7 }}>
                          {' '}
                          (desc. {item.discountPercent}%)
                        </Text>
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellRight,
                        { width: COL_UNIT },
                      ]}
                    >
                      {formatPrice(item.unitPrice, currencySymbol, locale)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellRight,
                        { width: COL_TOTAL },
                      ]}
                    >
                      {formatPrice(discountedTotal, currencySymbol, locale)}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* ── Totals ─────────────────────────────────────── */}
          {quote.items.length > 0 && (
            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>
                  {formatPrice(quote.subtotal, currencySymbol, locale)}
                </Text>
              </View>
              {quote.globalDiscountPercent > 0 && (
                <View style={styles.discountRow}>
                  <Text style={styles.discountLabel}>
                    Desc. {quote.globalDiscountPercent}%
                  </Text>
                  <Text style={styles.discountValue}>
                    -{formatPrice(quote.discountAmount, currencySymbol, locale)}
                  </Text>
                </View>
              )}
              <View style={styles.totalRowHighlight}>
                <Text style={styles.totalLabelHighlight}>TOTAL</Text>
                <Text style={styles.totalValueHighlight}>
                  {formatPrice(quote.total, currencySymbol, locale)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Footer (Conditions + Privacy) ──────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            {quote.deliveryEstimate && (
              <View style={styles.footerBlock}>
                <Text style={styles.footerLabel}>Prazo de Entrega</Text>
                <Text style={styles.footerValue}>
                  {quote.deliveryEstimate}
                </Text>
              </View>
            )}
            {quote.paymentTerms && (
              <View style={styles.footerBlock}>
                <Text style={styles.footerLabel}>
                  Condições de Pagamento
                </Text>
                <Text style={styles.footerValue}>
                  {quote.paymentTerms}
                </Text>
              </View>
            )}
          </View>
          {quote.footerNote && (
            <Text
              style={[
                styles.footerValue,
                { marginBottom: 4, fontStyle: 'italic' },
              ]}
            >
              {quote.footerNote}
            </Text>
          )}
          <Text style={styles.privacyNote}>
            Documento gerado localmente no navegador — seus dados não saem do
            seu dispositivo.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
