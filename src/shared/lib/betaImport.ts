import { LEGACY_BETA_PII_KEYS } from "./manifestStorage";
import type { Customer, Quote } from "@/shared/types";

/**
 * S2 — Importação explícita dos dados de teste do perfil Beta.
 *
 * O build Beta guardou clientes, orçamentos e histórico nas três chaves
 * `open3dcalc_beta_test_*` do MESMO perfil de navegador usado pela Stable.
 * A Stable nunca as lê automaticamente (namespace test-only é o contrato do
 * canal), então este módulo oferece o caminho do plano: prévia por
 * tipo/contagem, importação merge-by-id preservando IDs, fonte intacta e
 * idempotência (rodar de novo não duplica).
 *
 * Pureza: todo acesso a storage entra por injeção (`read`), o que permite
 * testar com fixtures sem tocar o navegador. A gravação é feita pela UI via
 * setState nas stores (o middleware persist assina qualquer mudança de
 * estado e escreve pelos adaptadores gated).
 */

export type BetaSourceType = "customers" | "quotes" | "history";

export interface BetaSourceReport {
  readonly type: BetaSourceType;
  readonly storageKey: string;
  /** Parsed records that look valid for import. */
  readonly records: number;
  /** Envelope present but unparseable. */
  readonly corrupt: boolean;
}

export interface BetaImportPreview {
  readonly sources: BetaSourceReport[];
  readonly total: number;
  readonly hasAny: boolean;
}

type ReadFn = (key: string) => string | null;

function parsePersistedArray(
  raw: string,
  field: string,
  expectedVersion: number,
): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const state = (parsed as { state?: unknown }).state;
    const version = (parsed as { version?: unknown }).version;
    if (
      state &&
      typeof state === "object" &&
      version === expectedVersion &&
      Array.isArray((state as Record<string, unknown>)[field])
    ) {
      return (state as Record<string, unknown>)[field] as unknown[];
    }
    // Tolerant fallback: right field, wrong declared version — the beta wrote
    // these with the app's own serializers, so trust the shape.
    if (
      state &&
      typeof state === "object" &&
      Array.isArray((state as Record<string, unknown>)[field])
    ) {
      return (state as Record<string, unknown>)[field] as unknown[];
    }
  }
  return null;
}

function looksLikeCustomer(record: unknown): record is Customer {
  const r = record as Record<string, unknown>;
  return (
    typeof r?.id === "string" &&
    typeof r?.name === "string" &&
    r.name.trim().length > 0
  );
}

function looksLikeQuote(record: unknown): record is Quote {
  const r = record as Record<string, unknown>;
  return (
    typeof r?.id === "string" &&
    typeof (r as { number?: unknown }).number === "number"
  );
}

function looksLikeHistoryEntry(record: unknown): boolean {
  const r = record as Record<string, unknown>;
  return (
    typeof r?.id === "string" &&
    typeof r?.timestamp === "number" &&
    (r?.type === "fdm" || r?.type === "resin")
  );
}

const VALIDATORS: Record<BetaSourceType, (record: unknown) => boolean> = {
  customers: looksLikeCustomer,
  quotes: looksLikeQuote,
  history: looksLikeHistoryEntry,
};

/** Detect and count importable Beta-test records, per type. Read-only. */
export function detectBetaData(read: ReadFn): BetaImportPreview {
  const sources: BetaSourceReport[] = [];
  let total = 0;

  for (const type of ["customers", "quotes", "history"] as const) {
    const legacy =
      type === "history"
        ? LEGACY_BETA_PII_KEYS.open3dcalc_history_v2
        : type === "customers"
          ? LEGACY_BETA_PII_KEYS.open3dcalc_customers_v1
          : LEGACY_BETA_PII_KEYS.open3dcalc_quotes_v1;
    const raw = read(legacy.key);
    if (raw === null) {
      sources.push({
        type,
        storageKey: legacy.key,
        records: 0,
        corrupt: false,
      });
      continue;
    }
    const records = parsePersistedArray(raw, legacy.field, legacy.version);
    if (records === null) {
      sources.push({ type, storageKey: legacy.key, records: 0, corrupt: true });
      continue;
    }
    const valid = records.filter(VALIDATORS[type]).length;
    sources.push({
      type,
      storageKey: legacy.key,
      records: valid,
      corrupt: false,
    });
    total += valid;
  }

  return { sources, total, hasAny: total > 0 };
}

/** Merge-by-id: target wins on conflict, source records keep their ids. */
export function mergeById<T extends { id: string }>(
  target: readonly T[],
  incoming: readonly T[],
): { merged: T[]; imported: number; skipped: number } {
  const targetIds = new Set(target.map((item) => item.id));
  const fresh = incoming.filter((item) => !targetIds.has(item.id));
  return {
    merged: [...target, ...fresh],
    imported: fresh.length,
    skipped: incoming.length - fresh.length,
  };
}

export interface BetaImportResult {
  readonly imported: number;
  readonly skippedDuplicates: number;
  readonly perType: Record<BetaSourceType, number>;
  readonly sourceIntact: boolean;
}

/** Filter valid records out of a parsed beta array. */
export function validRecords(
  type: BetaSourceType,
  read: ReadFn,
): Array<Record<string, unknown>> {
  const legacy =
    type === "history"
      ? LEGACY_BETA_PII_KEYS.open3dcalc_history_v2
      : type === "customers"
        ? LEGACY_BETA_PII_KEYS.open3dcalc_customers_v1
        : LEGACY_BETA_PII_KEYS.open3dcalc_quotes_v1;
  const raw = read(legacy.key);
  if (raw === null) return [];
  const records = parsePersistedArray(raw, legacy.field, legacy.version);
  if (records === null) return [];
  return records.filter(VALIDATORS[type]) as Array<Record<string, unknown>>;
}

const LEGACY_VALUES = Object.values(LEGACY_BETA_PII_KEYS);

/** Re-read every beta source and confirm none was modified or deleted. */
export function verifySourceIntact(
  read: ReadFn,
  snapshot: ReadonlyMap<string, string | null>,
): boolean {
  for (const [key, value] of snapshot) {
    if (read(key) !== value) return false;
  }
  return true;
}

/** Snapshot the raw beta sources before any import (source-intact proof). */
export function snapshotBetaSources(read: ReadFn): Map<string, string | null> {
  const snapshot = new Map<string, string | null>();
  for (const legacy of LEGACY_VALUES) {
    snapshot.set(legacy.key, read(legacy.key));
  }
  return snapshot;
}
