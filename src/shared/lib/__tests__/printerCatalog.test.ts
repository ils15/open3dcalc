import { describe, expect, it } from "vitest";
import { printers } from "@/shared/lib/printers";
import { isPersonalPrinter } from "@/shared/lib/printerCatalog";

describe("isPersonalPrinter", () => {
  it("recognizes built-in profiles as library entries", () => {
    expect(isPersonalPrinter(printers[0])).toBe(false);
  });

  it("recognizes explicitly custom profiles as personal", () => {
    expect(isPersonalPrinter({ id: printers[0].id, custom: true })).toBe(true);
  });

  it("recognizes legacy non-built-in profiles without the custom flag", () => {
    expect(isPersonalPrinter({ id: "legacy-printer" })).toBe(true);
  });

  it("honors an explicit non-custom flag", () => {
    expect(isPersonalPrinter({ id: "legacy-printer", custom: false })).toBe(
      false,
    );
  });
});
