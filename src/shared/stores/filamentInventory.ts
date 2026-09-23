/**
 * Shim de compatibilidade (Phase 6).
 *
 * O inventário de filamento passou a ter um único dono no W6: `spoolStore.ts`.
 * Duas visões (o FilamentInventory original e a nova Estante de Carretéis)
 * compartilham o MESMO store e a MESMA chave (`open3dcalc_filaments`) — caso
 * contrário dois stores zustand sobre a mesma chave localStorage divergiriam
 * em memória e o usuário veria dados stale ao trocar de aba.
 *
 * Toda a API pública existente é preservada; importadores antigos não mudam.
 */
export {
  useSpoolStore as useFilamentInventory,
  SPOOLS_KEY,
  SPOOL_MATERIALS,
  remainingPct,
  filterSpools,
  sortSpools,
} from "./spoolStore";
export type {
  FilamentSpool,
  SpoolStatus,
  SpoolFilters,
  SpoolSortKey,
  SpoolSortDir,
} from "./spoolStore";
