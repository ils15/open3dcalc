import { jsPDF } from "jspdf";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { downloadBlob } from "@/shared/lib/download";
import { useWorkshopProfileStore } from "@/shared/stores/workshopProfileStore";
import type { Quote, Customer } from "@/shared/types";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  return [37, 99, 235];
}

export interface QuotePdfData {
  projectName: string;
  tech: "fdm" | "resin";
  filamentType: string;
  costPerKg: number;
  weightGrams: number;
  resinVolumeMl?: number;
  resinDensity?: number;
  filamentDiameter?: number;
  hours: number;
  minutes: number;
  powerWatts: number;
  kwhRate: number;
  energyCost: number;
  totalEnergyKwh: number;
  cureTimeMinutes?: number;
  washTimeMinutes?: number;
  materialCost: number;
  machineDeprec: number;
  machineMaint: number;
  failureRisk: number;
  laborCost: number;
  hourlyRate: number;
  hardwareCost: number;
  packagingCost: number;
  finishingCost: number;
  specificConsumables: number;
  totalCost: number;
  profit: number;
  marginPercent: number;
  sellPrice: number;
}

export function generateQuotePdf(data: QuotePdfData): void {
  if (guardExport()) return;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Workshop Profile Branding
  const profile = useWorkshopProfileStore.getState().profile;
  const brandName = (profile.workshopName || "OPEN3DCALC STUDIO").toUpperCase();

  // Colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentBlue = profile.reportPrimaryColor
    ? hexToRgb(profile.reportPrimaryColor)
    : [37, 99, 235]; // Custom or Blue 600
  const emeraldColor = [5, 150, 105]; // Emerald 600
  const textMuted = [100, 116, 139]; // Slate 500
  const lightBg = [248, 250, 252]; // Slate 50
  const borderLine = [226, 232, 240]; // Slate 200

  let y = margin;

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, "F");

  // Logo or Brand Title
  const hasLogo = profile.logoUrl && profile.logoUrl.startsWith("data:image/");
  let textStartX = margin + 8;

  if (hasLogo && profile.logoUrl) {
    try {
      doc.addImage(profile.logoUrl, margin + 4, y + 3, 20, 20);
      textStartX = margin + 28;
    } catch {
      textStartX = margin + 8;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(brandName, textStartX, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(190, 210, 245);
  const subtitleDoc = profile.document
    ? `${profile.document} • Relatório Técnico de Produção & Orçamento`
    : "Relatório Técnico de Produção & Proposta Comercial";
  doc.text(subtitleDoc, textStartX, y + 18);

  // Date and Protocol on the right
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const docId = `DOC-${Math.floor(now.getTime() / 1000)
    .toString(16)
    .toUpperCase()}`;

  doc.setFontSize(8);
  doc.setTextColor(200, 220, 255);
  doc.text(
    `Emissão: ${dateStr} às ${timeStr}`,
    pageWidth - margin - 8,
    y + 11,
    { align: "right" },
  );
  doc.text(`Protocolo: ${docId}`, pageWidth - margin - 8, y + 18, {
    align: "right",
  });

  y += 32;

  // Project Info Card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  const displayProject =
    data.projectName?.trim() || "Peça / Projeto sem Identificação Nominal";
  doc.text(displayProject, margin + 6, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const techLabel =
    data.tech === "resin"
      ? "Impressão 3D SLA / MSLA (Resina Fotopolímero UV 405nm)"
      : "Impressão 3D FDM / FFF (Filamento Termoplástico)";
  doc.text(`Tecnologia: ${techLabel}`, margin + 6, y + 15);

  const durationStr = `${data.hours}h ${data.minutes.toString().padStart(2, "0")}m`;
  doc.text(`Tempo de Máquina: ${durationStr}`, pageWidth - margin - 6, y + 15, {
    align: "right",
  });

  y += 28;

  // Function to draw section header
  const drawSectionHeader = (title: string, currentY: number) => {
    doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
    doc.rect(margin, currentY, 3, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(title, margin + 6, currentY + 5.5);
    return currentY + 10;
  };

  // Function to draw row table item
  const drawRow = (
    label: string,
    value: string,
    currentY: number,
    isSubtotal = false,
  ) => {
    if (isSubtotal) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currentY - 3.5, contentWidth, 6.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    }
    doc.setFontSize(8.5);
    doc.text(label, margin + 4, currentY);

    if (isSubtotal) {
      doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
    } else {
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    }
    doc.text(value, pageWidth - margin - 4, currentY, { align: "right" });

    // Hairline divider
    if (!isSubtotal) {
      doc.setDrawColor(240, 242, 246);
      doc.line(
        margin + 4,
        currentY + 2.5,
        pageWidth - margin - 4,
        currentY + 2.5,
      );
    }

    return currentY + 6;
  };

  // Section 1: Insumos & Materiais
  y = drawSectionHeader("1. CONSUMO DE INSUMOS & MATERIAIS", y);
  y = drawRow(
    "Material / Insumo Selecionado",
    data.filamentType || "Padrão",
    y,
  );

  if (data.tech === "resin") {
    y = drawRow("Densidade da Resina", `${data.resinDensity || 1.12} g/cm³`, y);
    y = drawRow(
      "Volume Nominal Utilizado",
      `${(data.resinVolumeMl || 0).toFixed(1)} ml`,
      y,
    );
    y = drawRow(
      "Massa Líquida Equivalente",
      `${(data.weightGrams || 0).toFixed(1)} g`,
      y,
    );
    y = drawRow(
      "Custo Unitário da Resina",
      `R$ ${(data.costPerKg || 0).toFixed(2)} / Litro`,
      y,
    );
  } else {
    y = drawRow(
      "Diâmetro do Filamento",
      `${data.filamentDiameter || 1.75} mm`,
      y,
    );
    y = drawRow(
      "Peso do Material Gasto",
      `${(data.weightGrams || 0).toFixed(1)} g`,
      y,
    );
    y = drawRow(
      "Custo Unitário do Filamento",
      `R$ ${(data.costPerKg || 0).toFixed(2)} / kg`,
      y,
    );
  }
  y = drawRow(
    "Subtotal de Material",
    `R$ ${data.materialCost.toFixed(2).replace(".", ",")}`,
    y,
    true,
  );
  y += 4;

  // Section 2: Energia & Tempo de Operação
  y = drawSectionHeader("2. TEMPO DE MÁQUINA, CURA & ENERGIA ELÉTRICA", y);
  y = drawRow(
    "Duração do Ciclo de Impressão",
    `${data.hours} horas e ${data.minutes} minutos`,
    y,
  );
  y = drawRow("Potência Nominal do Equipamento", `${data.powerWatts} Watts`, y);

  if (data.tech === "resin") {
    y = drawRow(
      "Tempo de Pós-Cura UV (Câmara)",
      `${data.cureTimeMinutes || 0} minutos`,
      y,
    );
    y = drawRow(
      "Tempo de Lavagem em Solvente (IPA)",
      `${data.washTimeMinutes || 0} minutos`,
      y,
    );
  }

  y = drawRow(
    "Energia Total Consumida",
    `${data.totalEnergyKwh.toFixed(3)} kWh`,
    y,
  );
  y = drawRow(
    "Tarifa de Energia Aplicada",
    `R$ ${data.kwhRate.toFixed(2)} / kWh`,
    y,
  );
  y = drawRow(
    "Subtotal de Energia Elétrica",
    `R$ ${data.energyCost.toFixed(2).replace(".", ",")}`,
    y,
    true,
  );
  y += 4;

  // Section 3: Insumos Auxiliares & Pós-Processamento
  y = drawSectionHeader("3. INSUMOS AUXILIARES & CUSTOS EXTRAS", y);
  if (data.tech === "resin") {
    y = drawRow(
      "Insumos Auxiliares (IPA + EPIs Nitrílicos + Filme FEP)",
      `R$ ${data.specificConsumables.toFixed(2).replace(".", ",")}`,
      y,
    );
  } else {
    y = drawRow(
      "Insumos Auxiliares (Adesão de Mesa + Desgaste de Bico)",
      `R$ ${data.specificConsumables.toFixed(2).replace(".", ",")}`,
      y,
    );
  }
  y = drawRow(
    "Fixadores, Parafusos & Hardware",
    `R$ ${data.hardwareCost.toFixed(2).replace(".", ",")}`,
    y,
  );
  y = drawRow(
    "Embalagem de Proteção & Caixa",
    `R$ ${data.packagingCost.toFixed(2).replace(".", ",")}`,
    y,
  );
  y = drawRow(
    "Acabamento Manual & Pintura",
    `R$ ${data.finishingCost.toFixed(2).replace(".", ",")}`,
    y,
  );
  const extraTotal =
    data.hardwareCost +
    data.packagingCost +
    data.finishingCost +
    data.specificConsumables;
  y = drawRow(
    "Subtotal Custos Extras",
    `R$ ${extraTotal.toFixed(2).replace(".", ",")}`,
    y,
    true,
  );
  y += 4;

  // Section 4: Mão de Obra e Desgaste
  y = drawSectionHeader("4. DEPRECIAÇÃO, MANUTENÇÃO & MÃO DE OBRA", y);
  y = drawRow(
    "Depreciação de Máquina / Hora",
    `R$ ${data.machineDeprec.toFixed(2).replace(".", ",")}`,
    y,
  );
  y = drawRow(
    "Reserva de Manutenção Preventiva",
    `R$ ${data.machineMaint.toFixed(2).replace(".", ",")}`,
    y,
  );
  y = drawRow(
    "Margem de Segurança Contra Falhas (5%)",
    `R$ ${data.failureRisk.toFixed(2).replace(".", ",")}`,
    y,
  );
  y = drawRow(
    "Mão de Obra Técnica Especializada",
    `R$ ${data.laborCost.toFixed(2).replace(".", ",")}`,
    y,
  );
  y += 4;

  // Section 5: Resumo Financeiro & Preço de Venda
  y = drawSectionHeader("5. RESUMO FINANCEIRO & PREÇO SUGERIDO AO CLIENTE", y);

  // Big Box for Price Summary
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "FD");

  // Left column: Cost & Profit
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("CUSTO TOTAL DE FABRICAÇÃO", margin + 6, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(
    `R$ ${data.totalCost.toFixed(2).replace(".", ",")}`,
    margin + 6,
    y + 14,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`MARGEM DE LUCRO (+${data.marginPercent}%)`, margin + 6, y + 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.text(
    `R$ ${data.profit.toFixed(2).replace(".", ",")}`,
    margin + 6,
    y + 26,
  );

  // Right column: Final Sell Price
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.text("PREÇO FINAL SUGERIDO AO CLIENTE", pageWidth - margin - 6, y + 9, {
    align: "right",
  });

  doc.setFontSize(18);
  doc.text(
    `R$ ${data.sellPrice.toFixed(2).replace(".", ",")}`,
    pageWidth - margin - 6,
    y + 20,
    { align: "right" },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    "Impostos e frete a combinar com o cliente",
    pageWidth - margin - 6,
    y + 25,
    { align: "right" },
  );

  // Footer with Payment terms and PIX
  const footerY = pageHeight - margin + 2;
  doc.setDrawColor(borderLine[0], borderLine[1], borderLine[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  const paymentInfo = profile.pixKey
    ? `Pagamento PIX (${profile.pixType.toUpperCase()}): ${profile.pixKey} • ${profile.defaultPaymentTerms}`
    : `Condições: ${profile.defaultPaymentTerms}`;
  doc.text(paymentInfo, margin, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const contactParts = [
    profile.workshopName,
    profile.phone ? `WhatsApp: ${profile.phone}` : null,
    profile.email ? `E-mail: ${profile.email}` : null,
    profile.defaultWarranty,
  ].filter(Boolean);
  doc.text(contactParts.join(" • "), margin, footerY);
  doc.text("Validade: 15 dias", pageWidth - margin, footerY, {
    align: "right",
  });

  // Save the PDF through downloadBlob funnel
  const cleanName = (data.projectName || "Orcamento_Open3DCalc").replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  downloadBlob(doc.output("blob"), `${cleanName}_Proposta.pdf`);
}

export function exportCommercialQuotePdf(
  quote: Quote,
  customer?: Customer,
): void {
  if (guardExport()) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const profile = useWorkshopProfileStore.getState().profile;
  const brandName = (profile.workshopName || "OPEN3DCALC STUDIO").toUpperCase();
  const accentColor = profile.reportPrimaryColor
    ? hexToRgb(profile.reportPrimaryColor)
    : [37, 99, 235];

  // Header Dark Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(margin, margin, contentWidth, 26, 3, 3, "F");

  // Logo or Brand Title
  const hasLogo = profile.logoUrl && profile.logoUrl.startsWith("data:image/");
  let textStartX = margin + 8;

  if (hasLogo && profile.logoUrl) {
    try {
      doc.addImage(profile.logoUrl, margin + 4, margin + 3, 20, 20);
      textStartX = margin + 28;
    } catch {
      textStartX = margin + 8;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(brandName, textStartX, margin + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(190, 210, 245);
  const subTitle = profile.document
    ? `Doc: ${profile.document} • Orçamento Comercial de Impressão 3D`
    : "Proposta Comercial & Orçamento de Impressão 3D";
  doc.text(subTitle, textStartX, margin + 18);

  // Number & Date on right
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(
    `ORÇAMENTO #${String(quote.number).padStart(3, "0")}`,
    pageWidth - margin - 8,
    margin + 11,
    { align: "right" },
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 255);
  doc.text(
    `Data: ${new Date(quote.createdAt).toLocaleDateString("pt-BR")}`,
    pageWidth - margin - 8,
    margin + 18,
    { align: "right" },
  );

  let y = margin + 32;

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
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
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
  const paymentTerms = quote.paymentTerms || profile.defaultPaymentTerms;
  const footerNote = quote.footerNote || profile.defaultWarranty;

  if (paymentTerms || footerNote || profile.pixKey) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("CONDIÇÕES DE FORNECIMENTO & PAGAMENTO:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let noteY = y + 5;
    if (paymentTerms) {
      doc.text(`• Pagamento: ${paymentTerms}`, margin, noteY);
      noteY += 5;
    }
    if (profile.pixKey) {
      doc.text(
        `• Chave PIX (${profile.pixType.toUpperCase()}): ${profile.pixKey} (Favorecido: ${profile.workshopName})`,
        margin,
        noteY,
      );
      noteY += 5;
    }
    if (footerNote) {
      doc.text(`• Garantia & Observações: ${footerNote}`, margin, noteY);
    }
  }

  // Footer banner
  const footerY = pageHeight - margin + 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  const footerParts = [
    profile.workshopName,
    profile.document ? `Doc: ${profile.document}` : null,
    profile.phone ? `WhatsApp: ${profile.phone}` : null,
    profile.email ? `E-mail: ${profile.email}` : null,
  ].filter(Boolean);
  doc.text(footerParts.join(" • "), margin, footerY - 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Orçamento gerado pelo Open3DCalc Studio - Manufatura Digital",
    margin,
    footerY + 1,
  );
  doc.text("Página 1 de 1", pageWidth - margin, footerY + 1, {
    align: "right",
  });

  downloadBlob(
    doc.output("blob"),
    `Orcamento_${String(quote.number).padStart(3, "0")}_${(quote.title || "Proposta").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
  );
}

