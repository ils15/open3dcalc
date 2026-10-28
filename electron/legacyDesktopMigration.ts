/**
 * S2 Desktop — migração explícita dos perfis v1.14.
 *
 * A 1.14 desktop guardava clientes, orçamentos e histórico na MESMA tabela
 * `storage`, sob os nomes herdados da web (`open3dcalc_customers_v1`,
 * `open3dcalc_quotes_v1`, `open3dcalc_history_v2`). O 2.x desktop lê o
 * namespace `open3dcalc_pwless_*`. A ponte é a renomeação com mescla por ID —
 * executada SOMENTE por ação explícita do usuário, preservando a fonte e
 * idempotente (rodar de novo não duplica). As tabelas normalizadas antigas
 * (customers/quotes/quote_items) não são lidas por fluxos atuais e ficam
 * intocadas.
 *
 * Envelopes: os rows são o wrapper persist do zustand. `history_v2` carrega
 * version 2 e `customers/quotes` version 1 — os mesmos campos que os destinos
 * `pwless_*` esperam, então a migração copia o envelope inteiro após validar
 * o shape (registros inválidos são descartados, nunca propagados).
 */

import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { readStoredRow, writeStoredRow } from "./storageRows.js";
import type { MinimalStorageDb } from "./storageRows.js";
import { isBetaElectronRuntime } from "./betaRuntime.js";

interface DatabaseHandle {
  $client: MinimalStorageDb;
}

type TrustedSenderAssertion = (event: IpcMainInvokeEvent) => void;

const LEGACY_KEYS = {
  customers: "open3dcalc_customers_v1",
  quotes: "open3dcalc_quotes_v1",
  history: "open3dcalc_history_v2",
} as const;

const PWLESS_KEYS = {
  customers: "open3dcalc_pwless_customers_v1",
  quotes: "open3dcalc_pwless_quotes_v1",
  history: "open3dcalc_pwless_history_v1",
} as const;

const FIELD_BY_TYPE = {
  customers: "customers",
  quotes: "quotes",
  history: "entries",
} as const;

export type LegacyType = keyof typeof LEGACY_KEYS;

export interface LegacyDesktopPreview {
  sources: Array<{ type: LegacyType; records: number; corrupt: boolean }>;
  total: number;
  hasAny: boolean;
}

export interface LegacyDesktopReport {
  imported: number;
  skipped: number;
  perType: Record<LegacyType, number>;
}

type Row = Record<string, unknown>;

function parseEnvelope(
  raw: string | undefined,
  field: string,
): { records: Row[]; corrupt: boolean } {
  if (raw === undefined) return { records: [], corrupt: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { records: [], corrupt: true };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const state = (parsed as { state?: unknown }).state;
    if (state && typeof state === "object" && !Array.isArray(state)) {
      const arr = (state as Record<string, unknown>)[field];
      if (Array.isArray(arr)) return { records: arr as Row[], corrupt: false };
    }
  }
  return { records: [], corrupt: true };
}

const VALIDATORS: Record<LegacyType, (row: Row) => boolean> = {
  customers: (r) =>
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    r.name.trim().length > 0,
  quotes: (r) => typeof r.id === "string" && typeof r.number === "number",
  history: (r) =>
    typeof r.id === "string" &&
    typeof r.timestamp === "number" &&
    (r.type === "fdm" || r.type === "resin"),
};

function mergeById(
  target: Row[],
  incoming: Row[],
): { merged: Row[]; imported: number; skipped: number } {
  const ids = new Set(target.map((r) => String(r.id)));
  const fresh = incoming.filter((r) => !ids.has(String(r.id)));
  return {
    merged: [...target, ...fresh],
    imported: fresh.length,
    skipped: incoming.length - fresh.length,
  };
}

/** Read-only: counts valid records per legacy source. */
export function detectLegacyDesktopData(
  db: MinimalStorageDb,
): LegacyDesktopPreview {
  const sources: LegacyDesktopPreview["sources"] = [];
  let total = 0;
  for (const type of Object.keys(LEGACY_KEYS) as LegacyType[]) {
    const raw = readStoredRow(db, LEGACY_KEYS[type]);
    const { records, corrupt } = parseEnvelope(
      raw ?? undefined,
      FIELD_BY_TYPE[type],
    );
    const valid = records.filter(VALIDATORS[type]).length;
    sources.push({ type, records: valid, corrupt });
    total += valid;
  }
  return { sources, total, hasAny: total > 0 };
}

/** Apply: merge legacy rows into the pwless rows. Legacy keys are never written. */
export function applyLegacyDesktopMigration(
  db: MinimalStorageDb,
): LegacyDesktopReport {
  let imported = 0;
  let skipped = 0;
  const perType = { customers: 0, quotes: 0, history: 0 } as Record<
    LegacyType,
    number
  >;

  for (const type of Object.keys(LEGACY_KEYS) as LegacyType[]) {
    const legacyRaw = readStoredRow(db, LEGACY_KEYS[type]);
    if (legacyRaw === null) continue;
    const { records } = parseEnvelope(legacyRaw, FIELD_BY_TYPE[type]);
    const valid = records.filter(VALIDATORS[type]);
    if (valid.length === 0) continue;

    const pwlessRaw = readStoredRow(db, PWLESS_KEYS[type]);
    const current = parseEnvelope(
      pwlessRaw ?? undefined,
      FIELD_BY_TYPE[type],
    ).records;
    const { merged, imported: n, skipped: s } = mergeById(current, valid);
    if (n === 0) {
      perType[type] = 0;
      continue;
    }
    // Envelope versions mirror the destination stores: history v2,
    // customers/quotes v1.
    const version = type === "history" ? 2 : 1;
    const state = { [FIELD_BY_TYPE[type]]: merged };
    writeStoredRow(db, PWLESS_KEYS[type], JSON.stringify({ state, version }));
    imported += n;
    skipped += s;
    perType[type] = n;
  }

  return { imported, skipped, perType };
}

/** IPC channel names for the explicit v1.14 desktop migration. */
export const LEGACY_MIGRATION_CHANNELS = {
  detect: "pii:legacy:detect",
  apply: "pii:legacy:apply",
} as const;

/** Register the two routes. Refuses on the Beta electron runtime. */
export function registerLegacyDesktopMigrationHandlers(
  ipcMain: Pick<IpcMain, "handle">,
  database: DatabaseHandle,
  assertTrustedSender: TrustedSenderAssertion,
): void {
  if (isBetaElectronRuntime()) return; // Beta is web-only and refuses PII IPC.

  ipcMain.handle(
    LEGACY_MIGRATION_CHANNELS.detect,
    (event): LegacyDesktopPreview => {
      assertTrustedSender(event);
      return detectLegacyDesktopData(database.$client);
    },
  );

  ipcMain.handle(
    LEGACY_MIGRATION_CHANNELS.apply,
    (event): LegacyDesktopReport => {
      assertTrustedSender(event);
      return applyLegacyDesktopMigration(database.$client);
    },
  );
}
