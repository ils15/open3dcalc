import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

// ── Color palette ────────────────────────────────────────────
const INDIGO = '#6366f1'
const EMERALD = '#059669'
const RED_500 = '#ef4444'
const GRAY_100 = '#f3f4f6'
const GRAY_200 = '#e5e7eb'
const GRAY_300 = '#d1d5db'
const GRAY_400 = '#9ca3af'
const GRAY_500 = '#6b7280'
const GRAY_600 = '#4b5563'
const GRAY_800 = '#1f2937'
const WHITE = '#ffffff'

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: WHITE,
  },
  // ── Header ────────────────────────────────────────────────────
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2 solid ${INDIGO}`,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: INDIGO,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 9,
    color: GRAY_500,
    marginTop: 4,
  },
  // ── Sections ──────────────────────────────────────────────────
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: GRAY_600,
    borderBottom: `1 solid ${GRAY_200}`,
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── KPI Grid ──────────────────────────────────────────────────
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  kpiCard: {
    width: '23%',
    padding: 8,
    backgroundColor: GRAY_100,
    borderRadius: 4,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 7,
    color: GRAY_500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: GRAY_800,
  },
  kpiValuePositive: {
    fontSize: 12,
    fontWeight: 'bold',
    color: EMERALD,
  },
  kpiValueNegative: {
    fontSize: 12,
    fontWeight: 'bold',
    color: RED_500,
  },
  // ── Comparison Table ──────────────────────────────────────────
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: INDIGO,
    paddingVertical: 5,
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
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: GRAY_100,
  },
  tableCell: {
    fontSize: 8,
    color: GRAY_800,
  },
  tableCellRight: {
    fontSize: 8,
    color: GRAY_800,
    textAlign: 'right',
  },
  tableCellPositive: {
    fontSize: 8,
    color: EMERALD,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  tableCellNegative: {
    fontSize: 8,
    color: RED_500,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  // ── Chart ─────────────────────────────────────────────────────
  chartImage: {
    width: '100%',
    height: 200,
    marginTop: 8,
    marginBottom: 8,
  },
  // ── Inline lists (top printers / top materials) ──────────────
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottom: `0.5 solid ${GRAY_300}`,
    fontSize: 8,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottom: `1 solid ${GRAY_500}`,
    fontSize: 7,
    fontWeight: 'bold',
    color: GRAY_600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Footer ────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 30,
    right: 30,
    borderTop: `1 solid ${GRAY_200}`,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: GRAY_400,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})

// ── Column widths for comparison table ──────────────────────
const COL_METRIC = '30%'
const COL_CURRENT = '25%'
const COL_PREVIOUS = '25%'
const COL_CHANGE = '20%'

// ── Helpers ──────────────────────────────────────────────────
function formatMoney(value: number, locale: string, currency: string): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

function formatChange(value: number | null): string {
  if (value === null || value === undefined) return '---'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

// ── Types ────────────────────────────────────────────────────
export interface ComparisonMetric {
  current: number
  previous: number
  change: number | null
}

export interface ExecutiveReportData {
  period: { from: string; to: string }
  entryCount: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  avgMargin: number
  topPrinters: Array<{ name: string; profit: number; count: number }>
  topMaterials: Array<{ name: string; count: number }>
  comparison: {
    revenue: ComparisonMetric
    cost: ComparisonMetric
    profit: ComparisonMetric
  }
  chartImage?: string
  locale?: string
  currency?: string
}

export function ExecutiveReportDoc(data: ExecutiveReportData) {
  const {
    period,
    entryCount,
    totalRevenue,
    totalCost,
    totalProfit,
    avgMargin,
    topPrinters,
    topMaterials,
    comparison,
    chartImage,
    locale = 'pt-BR',
    currency = 'R$',
  } = data

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Executive Report</Text>
          <Text style={styles.headerSubtitle}>
            Period: {period.from} — {period.to} | {entryCount} entries
          </Text>
        </View>

        {/* ── KPI Summary ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KPI Summary</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Revenue</Text>
              <Text style={styles.kpiValue}>
                {formatMoney(totalRevenue, locale, currency)}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Cost</Text>
              <Text style={styles.kpiValue}>
                {formatMoney(totalCost, locale, currency)}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Profit</Text>
              <Text
                style={
                  totalProfit >= 0
                    ? styles.kpiValuePositive
                    : styles.kpiValueNegative
                }
              >
                {formatMoney(totalProfit, locale, currency)}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Avg. Margin</Text>
              <Text
                style={
                  avgMargin >= 0
                    ? styles.kpiValuePositive
                    : styles.kpiValueNegative
                }
              >
                {avgMargin.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ── Period Comparison ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Period Comparison</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: COL_METRIC }]}>
                Metric
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: COL_CURRENT, textAlign: 'right' },
                ]}
              >
                Current Period
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: COL_PREVIOUS, textAlign: 'right' },
                ]}
              >
                Previous Period
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: COL_CHANGE, textAlign: 'right' },
                ]}
              >
                Change
              </Text>
            </View>

            {/* Revenue Row */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: COL_METRIC }]}>
                Revenue
              </Text>
              <Text
                style={[styles.tableCellRight, { width: COL_CURRENT }]}
              >
                {formatMoney(comparison.revenue.current, locale, currency)}
              </Text>
              <Text
                style={[styles.tableCellRight, { width: COL_PREVIOUS }]}
              >
                {formatMoney(comparison.revenue.previous, locale, currency)}
              </Text>
              <Text
                style={[
                  comparison.revenue.change !== null &&
                    comparison.revenue.change >= 0
                    ? styles.tableCellPositive
                    : styles.tableCellNegative,
                  { width: COL_CHANGE },
                ]}
              >
                {formatChange(comparison.revenue.change)}
              </Text>
            </View>

            {/* Cost Row */}
            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={[styles.tableCell, { width: COL_METRIC }]}>
                Cost
              </Text>
              <Text
                style={[styles.tableCellRight, { width: COL_CURRENT }]}
              >
                {formatMoney(comparison.cost.current, locale, currency)}
              </Text>
              <Text
                style={[styles.tableCellRight, { width: COL_PREVIOUS }]}
              >
                {formatMoney(comparison.cost.previous, locale, currency)}
              </Text>
              <Text
                style={[
                  comparison.cost.change !== null &&
                    comparison.cost.change <= 0
                    ? styles.tableCellPositive
                    : styles.tableCellNegative,
                  { width: COL_CHANGE },
                ]}
              >
                {formatChange(comparison.cost.change)}
              </Text>
            </View>

            {/* Profit Row */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: COL_METRIC }]}>
                Profit
              </Text>
              <Text
                style={[styles.tableCellRight, { width: COL_CURRENT }]}
              >
                {formatMoney(comparison.profit.current, locale, currency)}
              </Text>
              <Text
                style={[styles.tableCellRight, { width: COL_PREVIOUS }]}
              >
                {formatMoney(comparison.profit.previous, locale, currency)}
              </Text>
              <Text
                style={[
                  comparison.profit.change !== null &&
                    comparison.profit.change >= 0
                    ? styles.tableCellPositive
                    : styles.tableCellNegative,
                  { width: COL_CHANGE },
                ]}
              >
                {formatChange(comparison.profit.change)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Top Printers ──────────────────────────────────── */}
        {topPrinters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Printers</Text>
            <View style={styles.listHeader}>
              <Text style={{ width: '60%' }}>Printer</Text>
              <Text style={{ width: '20%', textAlign: 'right' }}>
                Prints
              </Text>
              <Text style={{ width: '20%', textAlign: 'right' }}>
                Profit
              </Text>
            </View>
            {topPrinters.map((p, i) => (
              <View
                key={p.name}
                  style={[
                    styles.listRow,
                    ...(i % 2 === 1 ? [{ backgroundColor: GRAY_100 }] : []),
                  ]}
              >
                <Text style={{ width: '60%' }}>{p.name}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>
                  {p.count}
                </Text>
                <Text
                  style={{
                    width: '20%',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: EMERALD,
                  }}
                >
                  {formatMoney(p.profit, locale, currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Top Materials ─────────────────────────────────── */}
        {topMaterials.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Materials</Text>
            <View style={styles.listHeader}>
              <Text style={{ width: '60%' }}>Material</Text>
              <Text style={{ width: '40%', textAlign: 'right' }}>
                Uses
              </Text>
            </View>
            {topMaterials.map((m, i) => (
              <View
                key={m.name}
                  style={[
                    styles.listRow,
                    ...(i % 2 === 1 ? [{ backgroundColor: GRAY_100 }] : []),
                  ]}
              >
                <Text style={{ width: '60%' }}>{m.name}</Text>
                <Text
                  style={{
                    width: '40%',
                    textAlign: 'right',
                    fontWeight: 'bold',
                  }}
                >
                  {m.count}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Chart Image ───────────────────────────────────── */}
        {chartImage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profit Trend</Text>
            <Image style={styles.chartImage} src={chartImage} />
          </View>
        )}

        {/* ── Footer ────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated by Open3DCalc on {new Date().toLocaleDateString(locale)}
            {' — '}Your data stays on your device.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
