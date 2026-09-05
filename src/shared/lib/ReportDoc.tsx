import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CalculationResult } from "@/shared/types";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#7c3aed",
  },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 20 },
  section: { marginBottom: 15 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    borderBottom: "1 solid #ddd",
    paddingBottom: 3,
    marginBottom: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  label: { color: "#444" },
  value: { fontWeight: "semibold" },
  total: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#059669",
    marginTop: 10,
    paddingTop: 10,
    borderTop: "2 solid #059669",
  },
  sell: { fontSize: 16, fontWeight: "bold", color: "#047857", marginTop: 5 },
  profit: { fontSize: 12, fontWeight: "bold", color: "#ea580c", marginTop: 5 },
});

export function ReportDoc({
  result,
  locale = "pt-BR",
  currency = "BRL",
}: {
  result: CalculationResult;
  locale?: string;
  currency?: string;
}) {
  const fmt = (v: number) =>
    (v || 0).toLocaleString(locale, { style: "currency", currency });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Open3DCalc</Text>
        <Text style={styles.subtitle}>Relatório de Custos de Impressão 3D</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produção Direta</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Material</Text>
            <Text style={styles.value}>{fmt(result.materialCost)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Energia</Text>
            <Text style={styles.value}>{fmt(result.energyCost)}</Text>
          </View>
          {result.postProcessingCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Pós-Processamento</Text>
              <Text style={styles.value}>{fmt(result.postProcessingCost)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipamento</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Máquina</Text>
            <Text style={styles.value}>{fmt(result.machineCost)}</Text>
          </View>
          {result.hardwareCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Hardware</Text>
              <Text style={styles.value}>{fmt(result.hardwareCost)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operacional</Text>
          {result.consumablesCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>EPI/Consumíveis</Text>
              <Text style={styles.value}>{fmt(result.consumablesCost)}</Text>
            </View>
          )}
          {result.softwareCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Software</Text>
              <Text style={styles.value}>{fmt(result.softwareCost)}</Text>
            </View>
          )}
          {result.laborCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Mão de Obra</Text>
              <Text style={styles.value}>{fmt(result.laborCost)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risco e Extras</Text>
          {result.failureCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Falha</Text>
              <Text style={styles.value}>{fmt(result.failureCost)}</Text>
            </View>
          )}
          {result.extrasCost > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Extras</Text>
              <Text style={styles.value}>{fmt(result.extrasCost)}</Text>
            </View>
          )}
        </View>

        <View style={styles.total}>
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: "bold" }]}>
              Custo Total
            </Text>
            <Text style={[styles.value, { color: "#059669" }]}>
              {fmt(result.totalCost)}
            </Text>
          </View>
        </View>
        <View style={styles.sell}>
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: "bold" }]}>
              Preço de Venda
            </Text>
            <Text style={[styles.value, { color: "#047857" }]}>
              {fmt(result.sellPrice)}
            </Text>
          </View>
        </View>
        <View style={styles.profit}>
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: "bold" }]}>
              Lucro Líquido
            </Text>
            <Text style={[styles.value, { color: "#ea580c" }]}>
              {fmt(result.profit)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lucro por Hora</Text>
            <Text style={styles.value}>{fmt(result.profitPerHour ?? 0)}/h</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
