import type { PrinterProfile } from "@/shared/types";
import { printers } from "@/shared/lib/printers";

type CatalogPrinterIdentity = Pick<PrinterProfile, "id"> & {
  custom?: boolean;
};

const BUILTIN_PRINTER_IDS = new Set(printers.map((printer) => printer.id));

/** Treat legacy catalog entries with non-builtin IDs as personal profiles. */
export function isPersonalPrinter(printer: CatalogPrinterIdentity): boolean {
  return (
    printer.custom === true ||
    (printer.custom === undefined && !BUILTIN_PRINTER_IDS.has(printer.id))
  );
}
