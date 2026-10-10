/**
 * Value-free disclosure of the legacy plaintext PII residue and the migration
 * markers (T5.3, ADR-002 §2.2).
 *
 * The Privacy screen must be HONEST about three things at once, without ever
 * rendering a record value:
 *
 *  (a) whether legacy plaintext PII still sits under the three replaced
 *      `localStorage` keys — key NAMES and record counts only, from
 *      `detectLegacyPlaintextPii`;
 *  (b) the re-home / migration-marker state — whether the residue was already
 *      re-homed, is still pending, or belongs to an interrupted migration.
 *
 * ## Why this is a separate module, not component logic
 *
 * The three sources are read-only and already exist. Keeping the derivation
 * pure and injectable means the disclosure can be asserted (including the
 * "no value leaks" contract) without a DOM, and the component stays a dumb
 * renderer. It reads through the manifest-gated storage exactly like the
 * detection half it reuses, so an undeclared key is denied rather than read.
 *
 * ## The states, and what proves each one
 *
 *  - `migrated`   — there is no residue to move, OR the re-home completion
 *                   marker (`LEGACY_PII_REHOME_MARKER_KEY`) exists. That marker
 *                   is only ever written after a run was written AND verified,
 *                   so its presence is positive proof of a completed re-home.
 *  - `incomplete` — residue exists, no verified completion marker, AND the
 *                   history-migration recovery marker holds a resumable backup
 *                   (a durable preimage an interrupted migration left behind).
 *                   The backup is the honest signal of "a migration started and
 *                   did not finish".
 *  - `pending`    — residue exists and nothing proves otherwise: it awaits the
 *                   user's explicit choice. Never reported as done.
 *
 * `already_migrated` and `no_residue` from the re-home status collapse into
 * `migrated` here: both mean "nothing is waiting to be moved". The plaintext
 * source is NEVER deleted (copy-without-delete), so residue may coexist with
 * `migrated` — the panel shows both facts rather than picking one.
 *
 * `historyMarker` is disclosed separately because it is a different migration's
 * marker; its value is PII-bearing, so only its KEY NAME and derived state are
 * ever exposed.
 */

import {
  detectLegacyPlaintextPii,
  type LegacyPiiPlaintextKeyReport,
} from "@/shared/lib/legacyPiiPlaintext";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import {
  MIGRATION_MARKER_KEY,
  MIGRATION_PROGRESS_KEY,
  isHistoryMigrationBackup,
  isHistoryMigrationProgress,
} from "@/shared/lib/migration/marker";
import {
  detectMigrationDrift,
  type MigrationDrift,
} from "@/shared/lib/migration/migrationDrift";

/** Historical marker that reports whether the retired re-home ever completed. */
export const LEGACY_PII_REHOME_MARKER_KEY = "open3dcalc_legacy_pii_rehomed_v1";

/** The re-home disclosure state shown to the user. */
export type RehomeDisclosureState = "migrated" | "pending" | "incomplete";

/** The history-migration marker state shown to the user. */
export type HistoryMarkerState = "absent" | "complete" | "resumable";

/** What the panel needs to know about the re-home. Value-free. */
export interface RehomeDisclosure {
  state: RehomeDisclosureState;
  /** True when the verified completion marker exists. */
  completed: boolean;
  /** The marker KEY NAME only — never its value. */
  markerKey: string;
}

/** What the panel needs to know about the history-migration marker. */
export interface HistoryMarkerDisclosure {
  state: HistoryMarkerState;
  /** The marker KEY NAME only — never its value. */
  markerKey: string;
  /**
   * True when the LEGACY PII-bearing marker key currently holds ANY value.
   *
   * That value is plaintext residue: an old build wrote the raw pre-migration
   * history array there, and copy-without-delete means current code never
   * erases it. Value-free: only presence, never content.
   */
  legacyPlaintextResidue: boolean;
}

export interface LegacyPiiDisclosure {
  residue: {
    present: boolean;
    total: number;
    /** Per-key NAME + count. Same value-free shape as the detection half. */
    keys: LegacyPiiPlaintextKeyReport[];
  };
  rehome: RehomeDisclosure;
  historyMarker: HistoryMarkerDisclosure;
  /**
   * T4.6 — whether the legacy source changed after the migration committed.
   * Value-free: `sources` holds KEY NAMES only. Optional so a caller (or test)
   * may inject a disclosure without one; an absent value means "no drift".
   */
  drift?: MigrationDrift;
}

export interface LegacyPiiDisclosureOptions {
  /**
   * How to read a raw storage value. Injectable so a test can exercise the
   * derivation without a DOM; defaults to the manifest-gated `localStorage`
   * facade, mirroring `detectLegacyPlaintextPii`.
   */
  read?: (key: string) => string | null;
}

/**
 * Derive the history-marker state from BOTH marker generations (W4.4).
 *
 * A legacy PII-bearing backup is a resumable preimage; the current value-free
 * progress marker is the same signal without the preimage (the source is intact
 * and re-read). Either one means an interrupted migration, so the panel stays
 * honest for old and new builds alike. Only the KEY NAMES are ever exposed.
 */
function historyMarkerState(
  legacyRaw: string | null,
  progressRaw: string | null,
): HistoryMarkerState {
  if (legacyRaw === null && progressRaw === null) return "absent";
  // A parseable backup is a durable recovery preimage: an interrupted
  // migration. The value-free progress marker is the same signal.
  if (legacyRaw !== null && isHistoryMigrationBackup(legacyRaw) !== null) {
    return "resumable";
  }
  if (
    progressRaw !== null &&
    isHistoryMigrationProgress(progressRaw) !== null
  ) {
    return "resumable";
  }
  // The legacy non-JSON "done" value and any non-marker document mean there is
  // nothing to resume.
  return "complete";
}

function rehomeState(
  residuePresent: boolean,
  completed: boolean,
  historyState: HistoryMarkerState,
): RehomeDisclosureState {
  if (!residuePresent || completed) return "migrated";
  if (historyState === "resumable") return "incomplete";
  return "pending";
}

/**
 * Derive the value-free disclosure from the three read-only sources.
 *
 * Never throws: an unreadable value is reported as `absent`/no-residue by the
 * detection half, because a storage failure must not turn the Privacy screen
 * into an error page. Writes nothing.
 */
export function getLegacyPiiDisclosure(
  options: LegacyPiiDisclosureOptions = {},
): LegacyPiiDisclosure {
  const read = options.read ?? ((key: string) => guardedStorage.getItem(key));

  const report = detectLegacyPlaintextPii(read);
  const completed = read(LEGACY_PII_REHOME_MARKER_KEY) !== null;
  const legacyMarkerRaw = read(MIGRATION_MARKER_KEY);
  const historyState = historyMarkerState(
    legacyMarkerRaw,
    read(MIGRATION_PROGRESS_KEY),
  );

  return {
    residue: {
      present: report.present,
      total: report.total,
      keys: report.keys,
    },
    rehome: {
      state: rehomeState(report.present, completed, historyState),
      completed,
      markerKey: LEGACY_PII_REHOME_MARKER_KEY,
    },
    historyMarker: {
      state: historyState,
      markerKey: MIGRATION_MARKER_KEY,
      legacyPlaintextResidue: legacyMarkerRaw !== null,
    },
    drift: detectMigrationDrift(read),
  };
}
