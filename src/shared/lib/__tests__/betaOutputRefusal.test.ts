import { afterEach, describe, expect, it, vi } from "vitest";

const jsPDFConstructor = vi.hoisted(() => vi.fn());

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("jspdf", () => ({ jsPDF: jsPDFConstructor }));

import { guardExport } from "@/shared/lib/demoExportGuard";
import { downloadBlob } from "@/shared/lib/download";
import { generateQuotePdf } from "@/platform/web/components/studio/exportQuotePdf";
import type { QuotePdfData } from "@/platform/web/components/studio/exportQuotePdf";

afterEach(() => vi.restoreAllMocks());

describe("Beta output refusal", () => {
  it("blocks shared file downloads and direct PDF generation", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    expect(guardExport()).toBe(true);
    downloadBlob(new Blob(["synthetic-only"]), "synthetic-report.pdf");
    generateQuotePdf({} as QuotePdfData);

    expect(click).not.toHaveBeenCalled();
    expect(jsPDFConstructor).not.toHaveBeenCalled();
  });
});
