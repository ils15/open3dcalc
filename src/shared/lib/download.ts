import { guardExport } from "./demoExportGuard";

/**
 * O choke point único de emissão de arquivo ao disco.
 *
 * Recusa (e explica, via `guardExport`) enquanto o modo demo está ativo: o
 * dado demo é ficcional e efêmero, então nenhum documento pode ser escrito a
 * partir dele. Histórico, clientes, orçamentos, produtos, relatórios e CSVs
 * todos funnelam por aqui — Blob → URL → click → revoke nunca executam em
 * demo, por construção.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (guardExport()) {
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
