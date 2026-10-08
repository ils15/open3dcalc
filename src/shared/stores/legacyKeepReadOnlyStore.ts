import { create } from "zustand";
import type { LegacyPiiPlaintextReport } from "@/shared/lib/legacyPiiPlaintext";

/**
 * Retired legacy-residue decision store.
 *
 * T5.2 left the choice session-only: `LegacyMigrationDialog.handleKeepReadOnly`
 * set local state and the prompt reappeared on EVERY new session, because
 * nothing remembered the answer. This store persists it — VALUE-FREE and
 * non-PII: it holds a SIGNATURE of the residue (each legacy key's name and
 * record COUNT), never a record and never a value. Storing counts is what lets
 * the decision expire HONESTLY: if the residue changes (an old client writes
 * again, or the user migrates), the signature no longer matches and the prompt
 * returns. A stored decision therefore means exactly "the residue has not
 * changed since the user chose to keep it read-only".
 *
 * `reopen()` forgets the decision so the choice can be offered again — the
 * Privacy screen path that satisfies "always offer a way back to the choice".
 *
 * The Beta test-only contract does not inspect or persist Stable residue. Keep
 * this compatibility export inert so old UI imports cannot read or mutate a
 * removed manifest key.
 */

/** Retired key name; exported only for source compatibility. */
export const LEGACY_KEEP_READONLY_KEY = "open3dcalc_legacy_keep_readonly_v1";

/**
 * A value-free signature of the residue: the key NAME and its record COUNT
 * (or `absent`). Two calls with the same residue produce the same string; any
 * change in presence or count changes it. No record value is ever included.
 */
export function residueSignature(report: LegacyPiiPlaintextReport): string {
  return report.keys
    .map((entry) => `${entry.key}=${entry.present ? entry.count : "absent"}`)
    .join("|");
}

interface LegacyKeepReadOnlyState {
  /** The signature of the residue the user chose to keep read-only, if any. */
  signature: string | null;
  /** Persist the keep-read-only choice for this residue signature. */
  keep(signature: string): void;
  /** Forget the choice so it can be offered again. */
  reopen(): void;
}

export const useLegacyKeepReadOnlyStore = create<LegacyKeepReadOnlyState>(
  () => ({
    signature: null,
    keep: () => undefined,
    reopen: () => undefined,
  }),
);
