/** Desktop erasure preflight. Destructive delete-all remains unavailable. */

import { app } from "electron";
import path from "node:path";
import { isBetaElectronRuntime } from "./betaRuntime.js";
import { diskJournalAdapter } from "../src/shared/lib/erasureSaga/journal.js";
import type {
  SagaJournal,
  SagaReceipt,
} from "../src/shared/lib/erasureSaga/types.js";
import {
  isValidSagaJournal,
  PLATFORM_STORES,
} from "../src/shared/lib/erasureSaga/types.js";
import { PII_ERASURE_TABLES } from "./piiDomainTables.js";
import type { PayloadDb } from "./erasurePayload.js";
import {
  assertDesktopErasureUnavailable,
  getDesktopErasurePolicy,
} from "./erasurePolicy.js";

export function erasureDir(): string {
  return path.join(app.getPath("userData"), "erasure");
}

const INVALID_JOURNAL_DIAGNOSTIC =
  "[erasure] durable journal invalid or lacks delete_all authorization; preserved; no erasure resumed";
const RENDERER_RESUME_DEFERRED_DIAGNOSTIC =
  "[erasure] durable delete_all resume deferred; renderer verification required";

/** Load and validate the durable saga journal without touching profile data. */
function loadAuthorizedJournal(): SagaJournal | null {
  const journal = diskJournalAdapter(erasureDir()).load();
  if (journal === null) return null;
  if (!isValidSagaJournal(journal, PLATFORM_STORES.electron)) {
    throw new Error(INVALID_JOURNAL_DIAGNOSTIC);
  }
  return journal;
}

function preflightJournal(): SagaJournal | null {
  try {
    return loadAuthorizedJournal();
  } catch {
    console.warn(INVALID_JOURNAL_DIAGNOSTIC);
    throw new Error(INVALID_JOURNAL_DIAGNOSTIC);
  }
}

/** Strict counterpart to the legacy adapter's best-effort table rescan. */
export async function verifySqliteDomainTables(
  db: PayloadDb,
): Promise<string[]> {
  const remaining: string[] = [];
  for (const table of PII_ERASURE_TABLES) {
    try {
      const count = db.$client
        .prepare(`SELECT COUNT(*) AS c FROM ${table}`)
        .get() as { c: number } | undefined;
      if (!count || !Number.isSafeInteger(count.c) || count.c < 0) {
        throw new Error("invalid SQLite count result");
      }
      if (count.c > 0) remaining.push(`${table}: ${count.c} rows`);
    } catch (error) {
      if (error instanceof Error && /no such table/i.test(error.message)) {
        continue;
      }
      throw new Error("SQLite domain table verification failed", {
        cause: error,
      });
    }
  }
  return remaining;
}

/** Reject all starts until exact scope and durable authorization are supported. */
export async function runDesktopErasure(
  db: PayloadDb,
  _authorizationToken: unknown,
  _rendererReport: unknown,
): Promise<never> {
  void db;
  void _authorizationToken;
  void _rendererReport;
  preflightJournal();
  assertDesktopErasureUnavailable();
}

/** Authorization cannot be issued until an exact PII-only scope is supported. */
export function authorizeDesktopErasure(): never {
  preflightJournal();
  assertDesktopErasureUnavailable();
}

/** No authorization exists in the current unavailable state; reject all claims. */
export async function claimDesktopErasure(_token: unknown): Promise<never> {
  void _token;
  preflightJournal();
  assertDesktopErasureUnavailable();
}

/** Startup preflight: non-terminal journals await renderer-side verification. */
export async function resumeErasureIfNeeded(
  _db: PayloadDb,
): Promise<{ resumed: boolean; receipt?: SagaReceipt; journal?: SagaJournal }> {
  // Retained for the existing IPC/startup call signature; intentionally not
  // dereferenced before the journal and renderer-verification preflight.
  void _db;
  // Beta is Web-only: never resume, read or touch profile PII state at
  // startup. The PII IPC surface refuses separately per call, and non-PII
  // startup proceeds — so this is a skip, not a grant and not a crash.
  if (isBetaElectronRuntime()) {
    console.warn(
      "[erasure] Beta channel is Web-only; startup resume skipped, no profile state touched",
    );
    return { resumed: false };
  }
  const existing = preflightJournal();
  if (!existing) return { resumed: false };
  if (existing.state === "committed" || existing.state === "rolled_back") {
    return { resumed: false, journal: existing };
  }
  // Startup has no durable authorization or exact target proof. Preserve the
  // journal and defer without constructing database/store capabilities.
  console.warn(RENDERER_RESUME_DEFERRED_DIAGNOSTIC);
  return { resumed: false, journal: existing };
}

/** Metadata-only journal state for the UI. */
export function erasureStatus(): {
  active: boolean;
  available: boolean;
  blockerCodes: string[];
  state?: string;
  stores?: Array<{ store: string; state: string; attempts: number }>;
} {
  let blockerCodes: string[];
  try {
    blockerCodes = getDesktopErasurePolicy().blockerCodes;
  } catch {
    blockerCodes = ["manifest_unavailable"];
  }
  let journal: SagaJournal | null;
  try {
    journal = preflightJournal();
  } catch {
    return {
      active: true,
      available: false,
      blockerCodes,
      state: "invalid",
      stores: [],
    };
  }
  if (!journal) return { active: false, available: false, blockerCodes };
  return {
    active: journal.state !== "committed" && journal.state !== "rolled_back",
    available: false,
    blockerCodes,
    state: journal.state,
    stores: journal.stores.map((r) => ({
      store: r.store,
      state: r.state,
      attempts: r.attempts,
    })),
  };
}
