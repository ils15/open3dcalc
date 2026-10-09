import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * T5.3 — the value-free legacy-residue disclosure derivation.
 *
 * This is the pure half of the honest disclosure surface: it answers, from the
 * three existing read-only sources, (a) whether legacy plaintext PII residue
 * exists (key NAMES + counts only), (b) the vault access state, and (c) the
 * re-home / migration-marker state. It renders nothing and writes nothing.
 *
 * The specs below pin the honesty contract: no record value may ever reach the
 * returned object, and each state is derived from the source that actually
 * proves it.
 */

const mockVaultState = vi.fn();

vi.mock("@/shared/lib/crypto/piiStoreHydration", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/shared/lib/crypto/piiStoreHydration")
    >();
  return { ...actual, getPiiStoreAccessState: () => mockVaultState() };
});

import { guardedStorage } from "@/shared/lib/manifestStorage";
import {
  MIGRATION_MARKER_KEY,
  MIGRATION_PROGRESS_KEY,
} from "@/shared/lib/migration/marker";
import { LEGACY_PII_REHOME_MARKER_KEY } from "@/shared/lib/migration/legacyPiiDisclosure";
import {
  getLegacyPiiDisclosure,
  type LegacyPiiDisclosureOptions,
} from "@/shared/lib/migration/legacyPiiDisclosure";

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const HISTORY = "open3dcalc_history_v2";

/** A read map returning `null` for anything it was not given. */
function readMap(
  entries: Record<string, string | null>,
): (key: string) => string | null {
  return (key: string): string | null => entries[key] ?? null;
}

const FIELD: Record<string, string> = {
  [CUSTOMERS]: "customers",
  [QUOTES]: "quotes",
  [HISTORY]: "entries",
};

/** A persisted wrapper with `count` records, each carrying a leak canary. */
function persisted(count: number, field: string): string {
  return JSON.stringify({
    state: {
      [field]: Array.from({ length: count }, (_, i) => ({
        id: `${field}-${i}`,
        secret: "SENTINEL-LEAK-CANARY",
      })),
    },
    version: 1,
  });
}

/** Residue for the given key/count pairs, values carrying a leak canary. */
function residue(keys: Record<string, number>): (key: string) => string | null {
  const map: Record<string, string> = {};
  for (const [key, count] of Object.entries(keys)) {
    map[key] = persisted(count, FIELD[key]);
  }
  return readMap(map);
}

const BACKUP_MARKER = JSON.stringify({
  type: "open3dcalc-history-v2-backup",
  source: JSON.stringify([{ id: "legacy-1" }]),
  baseEntries: [],
});

const LOCKED = { status: "locked", reason: "profile_locked" } as const;

function disclosureWith(options: LegacyPiiDisclosureOptions) {
  return getLegacyPiiDisclosure(options);
}

beforeEach(() => {
  mockVaultState.mockReset();
  mockVaultState.mockReturnValue(LOCKED);
  vi.restoreAllMocks();
});

describe("getLegacyPiiDisclosure — residue (value-free)", () => {
  it("reports no residue and a nothing-to-migrate re-home state", () => {
    const disclosure = disclosureWith({ read: readMap({}), vault: LOCKED });

    expect(disclosure.residue.present).toBe(false);
    expect(disclosure.residue.total).toBe(0);
    expect(disclosure.residue.keys).toEqual([
      { key: CUSTOMERS, present: false, count: 0 },
      { key: QUOTES, present: false, count: 0 },
      { key: HISTORY, present: false, count: 0 },
    ]);
    expect(disclosure.rehome.state).toBe("migrated");
  });

  it("surfaces key NAMES and counts, never a record value", () => {
    const disclosure = disclosureWith({
      read: residue({ [CUSTOMERS]: 2, [QUOTES]: 1 }),
      vault: LOCKED,
    });

    expect(disclosure.residue.present).toBe(true);
    expect(disclosure.residue.total).toBe(3);
    expect(disclosure.residue.keys.map((entry) => entry.key)).toEqual([
      CUSTOMERS,
      QUOTES,
      HISTORY,
    ]);
    expect(JSON.stringify(disclosure)).not.toContain("SENTINEL-LEAK-CANARY");
  });
});

describe("getLegacyPiiDisclosure — vault state", () => {
  it.each([
    { status: "hydrated" } as const,
    LOCKED,
    { status: "unavailable", reason: "indexeddb_unavailable" } as const,
  ])("passes the injected vault state through ($status)", (vault) => {
    const disclosure = disclosureWith({ read: readMap({}), vault });
    expect(disclosure.vault).toEqual(vault);
  });

  it("asks the vault gate by default when no state is injected", () => {
    mockVaultState.mockReturnValue({ status: "hydrated" });
    const disclosure = disclosureWith({ read: readMap({}) });
    expect(disclosure.vault).toEqual({ status: "hydrated" });
    expect(mockVaultState).toHaveBeenCalledTimes(1);
  });
});

describe("getLegacyPiiDisclosure — re-home / marker state", () => {
  it("is pending when residue exists and there is no proof of a completed re-home", () => {
    const disclosure = disclosureWith({
      read: residue({ [CUSTOMERS]: 1 }),
      vault: LOCKED,
    });
    expect(disclosure.rehome.state).toBe("pending");
    expect(disclosure.rehome.completed).toBe(false);
  });

  it("is migrated once the re-home completion marker exists", () => {
    const read = readMap({
      [CUSTOMERS]: persisted(1, "customers"),
      [LEGACY_PII_REHOME_MARKER_KEY]: JSON.stringify({
        v: 1,
        keys: [CUSTOMERS],
      }),
    });
    const disclosure = disclosureWith({ read, vault: { status: "hydrated" } });
    expect(disclosure.rehome.state).toBe("migrated");
    expect(disclosure.rehome.completed).toBe(true);
  });

  it("is incomplete when an interrupted migration left a recovery backup", () => {
    const read = readMap({
      [CUSTOMERS]: persisted(1, "customers"),
      [MIGRATION_MARKER_KEY]: BACKUP_MARKER,
    });
    const disclosure = disclosureWith({ read, vault: LOCKED });
    expect(disclosure.rehome.state).toBe("incomplete");
    expect(disclosure.historyMarker.state).toBe("resumable");
  });

  it("prefers a completed re-home over a stale recovery marker", () => {
    const read = readMap({
      [CUSTOMERS]: persisted(1, "customers"),
      [LEGACY_PII_REHOME_MARKER_KEY]: JSON.stringify({
        v: 1,
        keys: [CUSTOMERS],
      }),
      [MIGRATION_MARKER_KEY]: BACKUP_MARKER,
    });
    const disclosure = disclosureWith({ read, vault: { status: "hydrated" } });
    expect(disclosure.rehome.state).toBe("migrated");
  });
});

describe("getLegacyPiiDisclosure — history migration marker (value-free)", () => {
  it("reports absent when there is no marker", () => {
    const disclosure = disclosureWith({ read: readMap({}), vault: LOCKED });
    expect(disclosure.historyMarker.state).toBe("absent");
  });

  it("reports complete for the legacy non-JSON done value", () => {
    const disclosure = disclosureWith({
      read: readMap({ [MIGRATION_MARKER_KEY]: "done" }),
      vault: LOCKED,
    });
    expect(disclosure.historyMarker.state).toBe("complete");
  });

  it("reports complete for a non-backup JSON document", () => {
    const disclosure = disclosureWith({
      read: readMap({ [MIGRATION_MARKER_KEY]: JSON.stringify({ v: 1 }) }),
      vault: LOCKED,
    });
    expect(disclosure.historyMarker.state).toBe("complete");
  });

  it("reports resumable for the W4.4 value-free progress marker", () => {
    // A new build never stores a preimage; the value-free progress marker is
    // the same "interrupted" signal, so the panel must not regress to pending.
    const read = readMap({
      [CUSTOMERS]: persisted(1, "customers"),
      [MIGRATION_PROGRESS_KEY]: JSON.stringify({
        type: "open3dcalc-history-v2-progress",
        v: 1,
      }),
    });
    const disclosure = disclosureWith({ read, vault: LOCKED });
    expect(disclosure.historyMarker.state).toBe("resumable");
    expect(disclosure.rehome.state).toBe("incomplete");
  });

  it("reports complete for a non-marker value under the progress key", () => {
    const disclosure = disclosureWith({
      read: readMap({ [MIGRATION_PROGRESS_KEY]: JSON.stringify({ v: 1 }) }),
      vault: LOCKED,
    });
    expect(disclosure.historyMarker.state).toBe("complete");
  });

  it("never exposes the marker's record values", () => {
    const read = readMap({
      [MIGRATION_MARKER_KEY]: JSON.stringify({
        type: "open3dcalc-history-v2-backup",
        source: JSON.stringify([
          { id: "legacy-1", summary: "SENTINEL-LEAK-CANARY" },
        ]),
        baseEntries: [],
      }),
    });
    const disclosure = disclosureWith({ read, vault: LOCKED });
    expect(JSON.stringify(disclosure)).not.toContain("SENTINEL-LEAK-CANARY");
  });

  it("exposes only the marker key NAMES, never values", () => {
    const disclosure = disclosureWith({ read: readMap({}), vault: LOCKED });
    expect(disclosure.rehome.markerKey).toBe(LEGACY_PII_REHOME_MARKER_KEY);
    expect(disclosure.historyMarker.markerKey).toBe(MIGRATION_MARKER_KEY);
  });

  it("flags the legacy marker's plaintext residue when any value remains", () => {
    // F1: the legacy key is PLAINTEXT residue whenever it holds anything — a
    // resumable backup OR the legacy non-JSON "done" value.
    for (const raw of [BACKUP_MARKER, "done"]) {
      const disclosure = disclosureWith({
        read: readMap({ [MIGRATION_MARKER_KEY]: raw }),
        vault: LOCKED,
      });
      expect(disclosure.historyMarker.legacyPlaintextResidue).toBe(
        raw !== null,
      );
    }
  });

  it("reports no legacy plaintext residue when the legacy key is absent", () => {
    const disclosure = disclosureWith({ read: readMap({}), vault: LOCKED });
    expect(disclosure.historyMarker.legacyPlaintextResidue).toBe(false);
  });

  it("does not treat the value-free progress marker as legacy plaintext residue", () => {
    const disclosure = disclosureWith({
      read: readMap({
        [MIGRATION_PROGRESS_KEY]: JSON.stringify({
          type: "open3dcalc-history-v2-progress",
          v: 1,
        }),
      }),
      vault: LOCKED,
    });
    expect(disclosure.historyMarker.state).toBe("resumable");
    expect(disclosure.historyMarker.legacyPlaintextResidue).toBe(false);
  });
});

describe("getLegacyPiiDisclosure — default readers", () => {
  it("reads through the manifest-gated storage by default", () => {
    const spy = vi.spyOn(guardedStorage, "getItem").mockReturnValue(null);
    disclosureWith({ vault: LOCKED });

    for (const key of [
      CUSTOMERS,
      QUOTES,
      HISTORY,
      LEGACY_PII_REHOME_MARKER_KEY,
      MIGRATION_MARKER_KEY,
      MIGRATION_PROGRESS_KEY,
    ]) {
      expect(spy).toHaveBeenCalledWith(key);
    }
  });
});
