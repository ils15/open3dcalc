import { describe, expect, it } from "vitest";
import type { CalculationResult } from "@/shared/types";
import { exportResultToCsv, serializeCsvRows } from "./csvExport";

const result: CalculationResult = {
  materialCost: 1,
  energyCost: 1,
  machineCost: 1,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 1,
  softwareCost: 1,
  failureCost: 1,
  extrasCost: 1,
  postProcessingCost: 1,
  subtotal: 1,
  totalCost: 1,
  sellPrice: 1,
  profit: 1,
  marketplaceFee: 1,
  taxAmount: 1,
  costPerGram: 1,
  costPerUnit: 1,
  unitWeight: 1,
  estimatedPrintTime: 1,
  targetMarginPercent: 1,
  breakEvenPrice: 1,
  actualMargin: 1,
  carbonFootprintGrams: 1,
};

describe("CSV serialization", () => {
  it("escapes delimiters, quotes, and newlines in every cell", () => {
    expect(
      serializeCsvRows([
        { Project: 'Widget, "Pro"', Customer: "Alice\r\nSmith" },
      ]),
    ).toBe('Project,Customer\n"Widget, ""Pro""","Alice\r\nSmith"');
  });

  it("neutralizes formula prefixes, including leading whitespace and control characters", () => {
    expect(
      serializeCsvRows([
        { Value: " =1+1" },
        { Value: "+SUM(1,2)" },
        { Value: "-CMD()" },
        { Value: "@SUM(1,2)" },
        { Value: "\t=1+1" },
        { Value: " \t+SUM(1,2)" },
        { Value: "\r=1+1" },
      ]),
    ).toBe(
      'Value\n\' =1+1\n"\'+SUM(1,2)"\n\'-CMD()\n"\'@SUM(1,2)"\n"\'\t=1+1"\n"\' \t+SUM(1,2)"\n"\'\r=1+1"',
    );
  });

  it("neutralizes formula-like product names in the product CSV export", () => {
    expect(exportResultToCsv(result, "\t=HYPERLINK(\"https://evil.test\")")).toContain(
      'Produto,"\'\t=HYPERLINK(""https://evil.test"")"',
    );
  });
});
