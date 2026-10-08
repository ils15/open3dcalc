/**
 * Production caller for receipt-scoped withdrawal purge (Beta12 follow-up).
 *
 * ## What it does
 *
 * When a durable, receipt-scoped withdrawal journal exists, this purges ONLY
 * the new-namespace rows linked to that receipt's scope, then records the
 * verified completion through `completeWithdrawal`. The PII write lock releases
 * only after the trusted-process rescan proves the scoped rows are gone; an
 * incomplete purge is recorded `incomplete`, the lock stays engaged and a retry
 * is idempotent. It never reports a success it cannot prove.
 *
 * ## Fail-closed
 *
 * The journal's targets are validated against the exact new-PII allowlist. A
 * legacy key, a domain table or a mixed target refuses BEFORE the purge and
 * keeps the lock — this caller never deletes anything the new namespace does
 * not own.
 */

import type { WithdrawalClaim } from "../src/shared/lib/consent/withdrawal.js";
import { randomUUID } from "node:crypto";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import {
  NEW_PII_ERASURE_SURFACE,
  newPiiErasureKeyForTarget,
  type NewPiiErasureTarget,
} from "../src/shared/lib/crypto/newPiiErasureJournal.js";
import {
  NEW_PII_DOMAIN_KEYS,
  type NewPiiDomain,
  type NewPiiStorageKey,
} from "../src/shared/lib/crypto/newPiiNamespace.js";
import type { MinimalStorageDb } from "./persistGate.js";
import { deleteNewPiiRow, remainingNewPiiRows } from "./newPiiStore.js";
import {
  claimWithdrawalVerification,
  completeWithdrawal,
  loadWithdrawalJournal,
  markWithdrawalIncomplete,
  requestWithdrawal,
} from "./withdrawalJournal.js";
import {
  betaElectronPiiRefusal,
  isBetaElectronRuntime,
} from "./betaRuntime.js";

export type WithdrawalPurgeResult =
  { ok: true; purged: string[] } | { ok: false; reason: string };

/**
 * The exact new-PII targets a receipt scope authorises.
 *
 * The logical domains the passwordless route owns are mapped through
 * `NEW_PII_DOMAIN_KEYS`; a domain outside the scope contributes no target, so
 * the purge can never widen beyond what the receipt granted.
 */
export function newPiiWithdrawalTargets(
  scope: readonly string[],
): NewPiiErasureTarget[] {
  const domains: NewPiiDomain[] = ["customers", "quotes", "history"];
  const targets: NewPiiErasureTarget[] = [];
  for (const domain of domains) {
    if (scope.includes(domain)) {
      targets.push({
        surface: NEW_PII_ERASURE_SURFACE,
        id: NEW_PII_DOMAIN_KEYS[domain],
      });
    }
  }
  return targets;
}

export interface WithdrawalPurgeInput {
  dir: string;
  db: MinimalStorageDb;
  claim: WithdrawalClaim;
  now: Date;
}

/**
 * Verify (or resume) the withdrawal, purge the exact scoped new-PII rows, and
 * complete only on a verified postcondition.
 */
export function runWithdrawalPurge(
  input: WithdrawalPurgeInput,
): WithdrawalPurgeResult {
  const { dir, db, claim, now } = input;
  const journal = loadWithdrawalJournal(dir);
  if (!journal) return { ok: false, reason: "no_request" };
  // Completed is terminal: an idempotent re-run reports no work, but ONLY for
  // the exact nonce that settled it. A foreign/stale token must never receive a
  // free success — that is the reuse that let a new receipt see `ok: true` with
  // rows remaining.
  if (journal.state === "completed") {
    if (
      journal.claimed_nonce === null ||
      journal.claimed_nonce !== claim.nonce
    ) {
      return { ok: false, reason: "binding_mismatch" };
    }
    return { ok: true, purged: [] };
  }

  let current = journal;
  if (current.claimed_nonce === null) {
    const verdict = claimWithdrawalVerification(dir, claim, now);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    current = verdict.journal;
  } else if (current.claimed_nonce !== claim.nonce) {
    return { ok: false, reason: "binding_mismatch" };
  }

  // Exact new-PII targets only. A legacy/mixed target fails closed BEFORE any
  // delete and keeps the lock engaged.
  const keys: NewPiiStorageKey[] = [];
  for (const target of current.targets) {
    const key = newPiiErasureKeyForTarget(target);
    if (key === null) {
      markWithdrawalIncomplete(dir, current.request_id);
      return { ok: false, reason: "plan_refused" };
    }
    keys.push(key as NewPiiStorageKey);
  }
  if (keys.length === 0) {
    markWithdrawalIncomplete(dir, current.request_id);
    return { ok: false, reason: "plan_refused" };
  }

  for (const key of keys) deleteNewPiiRow(db, key);

  const remaining = remainingNewPiiRows(db, keys);
  if (remaining.length > 0) {
    markWithdrawalIncomplete(dir, current.request_id);
    return { ok: false, reason: "purge_unverified" };
  }

  completeWithdrawal(dir, current.request_id);
  return { ok: true, purged: keys };
}

/* ------------------------------------------------------------------ */
/*  IPC registration (main process)                                    */
/* ------------------------------------------------------------------ */

/** The exact channels the receipt-scoped withdrawal purge owns. */
export const WITHDRAWAL_PURGE_CHANNELS = {
  request: "withdrawal:request",
  purge: "withdrawal:purge",
} as const;

/** The default lifetime of an issued withdrawal nonce. */
export const WITHDRAWAL_TTL_MS = 10 * 60 * 1000;

export interface WithdrawalRequestInput {
  profile?: unknown;
  receiptId?: unknown;
  scope?: unknown;
}

interface DatabaseHandle {
  $client: MinimalStorageDb;
}

type TrustedSenderAssertion = (event: IpcMainInvokeEvent) => void;

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Register the production withdrawal-purge route.
 *
 * `request` persists a durable, receipt-scoped journal with ONLY the new-PII
 * targets the receipt scope authorises and returns a one-use nonce. `purge`
 * consumes that nonce, purges exactly those rows and records the verified
 * completion through `completeWithdrawal`. A pending/incomplete journal is
 * returned as-is, so a retry never rewrites the request; a COMPLETED journal is
 * terminal and is replaced by a fresh journal for a new receipt/scope.
 */
export function registerWithdrawalPurgeHandlers(
  ipcMain: Pick<IpcMain, "handle">,
  database: DatabaseHandle,
  assertTrustedSender: TrustedSenderAssertion,
  dir: string,
  profile: string,
): void {
  ipcMain.handle(
    WITHDRAWAL_PURGE_CHANNELS.request,
    (event, input: WithdrawalRequestInput = {}) => {
      // Beta is Web-only: refuse before the sender check, the journal read and
      // any nonce minting. Per call, never cached.
      if (isBetaElectronRuntime()) {
        throw betaElectronPiiRefusal(WITHDRAWAL_PURGE_CHANNELS.request);
      }
      assertTrustedSender(event);
      const existing = loadWithdrawalJournal(dir);
      // A live request (pending/incomplete) is returned verbatim so a retry
      // never rewrites the durable record. A COMPLETED journal is terminal: it
      // must NOT be reused for a new receipt/scope, or its `purge` would report
      // a false `{ ok: true, purged: [] }` while the new rows remain. Fall
      // through and persist a fresh journal for the new request.
      if (existing && existing.state !== "completed") {
        return {
          token: existing.nonce,
          expiresAt: existing.expires_at,
          targets: existing.targets,
        };
      }
      if (typeof input.receiptId !== "string" || input.receiptId.length === 0) {
        throw new Error("withdrawal receiptId must be a non-empty string");
      }
      if (!isStringArray(input.scope)) {
        throw new Error("withdrawal scope must be a string array");
      }
      const targets = newPiiWithdrawalTargets(input.scope);
      if (targets.length === 0) {
        throw new Error("withdrawal scope has no new-PII targets");
      }
      const now = new Date();
      const journal = requestWithdrawal(dir, {
        requestId: randomUUID(),
        profile,
        targets,
        receiptId: input.receiptId,
        nonce: randomUUID(),
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + WITHDRAWAL_TTL_MS).toISOString(),
      });
      return {
        token: journal.nonce,
        expiresAt: journal.expires_at,
        targets: journal.targets,
      };
    },
  );

  ipcMain.handle(WITHDRAWAL_PURGE_CHANNELS.purge, (event, token: unknown) => {
    if (isBetaElectronRuntime()) {
      throw betaElectronPiiRefusal(WITHDRAWAL_PURGE_CHANNELS.purge);
    }
    assertTrustedSender(event);
    const journal = loadWithdrawalJournal(dir);
    if (!journal) throw new Error("no withdrawal request");
    if (typeof token !== "string" || token.length === 0) {
      throw new Error("withdrawal token must be a non-empty string");
    }
    const claim: WithdrawalClaim = {
      nonce: token,
      operation: "withdraw_consent",
      profile: journal.profile,
      targets: journal.targets,
    };
    return runWithdrawalPurge({
      dir,
      db: database.$client,
      claim,
      now: new Date(),
    });
  });
}
