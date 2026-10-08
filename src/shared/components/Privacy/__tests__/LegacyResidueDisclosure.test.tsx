import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { LegacyPiiDisclosure } from "@/shared/lib/migration/legacyPiiDisclosure";
import { LEGACY_PII_REHOME_MARKER_KEY } from "@/shared/lib/migration/legacyPiiRehome";
import { MIGRATION_MARKER_KEY } from "@/shared/lib/migration/marker";

/**
 * T5.3 — the legacy-residue disclosure panel.
 *
 * The panel must be HONEST and VALUE-FREE: it names the residue keys and their
 * counts, states the vault access state, and states the re-home / marker state.
 * It must never render a record value nor a marker value. This suite pins the
 * accessibility contract (a labelled region) and the value-free render.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

import { LegacyResidueDisclosure } from "../LegacyResidueDisclosure";

afterEach(() => {
  delete (window as { electronAPI?: unknown }).electronAPI;
});

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const HISTORY = "open3dcalc_history_v2";

function disclosure(
  overrides: Partial<LegacyPiiDisclosure> = {},
): LegacyPiiDisclosure {
  return {
    residue: {
      present: true,
      total: 3,
      keys: [
        { key: CUSTOMERS, present: true, count: 2 },
        { key: QUOTES, present: true, count: 1 },
        { key: HISTORY, present: false, count: 0 },
      ],
    },
    vault: { status: "locked", reason: "profile_locked" },
    rehome: {
      state: "pending",
      completed: false,
      markerKey: LEGACY_PII_REHOME_MARKER_KEY,
    },
    historyMarker: {
      state: "absent",
      markerKey: MIGRATION_MARKER_KEY,
      legacyPlaintextResidue: false,
    },
    ...overrides,
  };
}

function renderPanel(value: LegacyPiiDisclosure) {
  return render(<LegacyResidueDisclosure disclosure={value} />);
}

describe("LegacyResidueDisclosure — a11y", () => {
  it("renders a labelled region", () => {
    renderPanel(disclosure());
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toBeInTheDocument();
  });

  it("announces state changes politely", () => {
    renderPanel(disclosure());
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toHaveAttribute("aria-live", "polite");
  });
});

describe("LegacyResidueDisclosure — residue (value-free)", () => {
  it("names every present residue key with its count", () => {
    renderPanel(disclosure());
    expect(screen.getByText(/open3dcalc_customers_v1/)).toBeInTheDocument();
    expect(screen.getByText(/open3dcalc_quotes_v1/)).toBeInTheDocument();
    expect(
      screen.getByText(/privacy.residue.residueTotal/),
    ).toBeInTheDocument();
  });

  it("omits an absent key from the residue list", () => {
    renderPanel(disclosure());
    expect(screen.queryByText(/open3dcalc_history_v2/)).not.toBeInTheDocument();
  });

  it("renders the empty state when there is no residue", () => {
    renderPanel(
      disclosure({
        residue: {
          present: false,
          total: 0,
          keys: [
            { key: CUSTOMERS, present: false, count: 0 },
            { key: QUOTES, present: false, count: 0 },
            { key: HISTORY, present: false, count: 0 },
          ],
        },
      }),
    );
    expect(screen.getByText("privacy.residue.residueNone")).toBeInTheDocument();
    expect(
      screen.queryByText("privacy.residue.residueTotal"),
    ).not.toBeInTheDocument();
  });
});

describe("LegacyResidueDisclosure — vault state", () => {
  it.each([
    [{ status: "hydrated" } as const, "privacy.residue.vaultHydrated"],
    [
      { status: "locked", reason: "profile_locked" } as const,
      "privacy.residue.vaultLocked",
    ],
    [
      { status: "unavailable", reason: "indexeddb_unavailable" } as const,
      "privacy.residue.vaultUnavailable",
    ],
  ])("states the vault as %o (%#)", (vault, label) => {
    renderPanel(disclosure({ vault }));
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows the typed reason when the vault is unavailable", () => {
    renderPanel(
      disclosure({
        vault: { status: "unavailable", reason: "insecure_context" },
      }),
    );
    expect(
      screen.getByText(/privacy.residue.vaultUnavailableDetail/),
    ).toBeInTheDocument();
    expect(screen.getByText(/insecure_context/)).toBeInTheDocument();
  });
});

describe("LegacyResidueDisclosure — re-home / marker state", () => {
  it.each([
    ["migrated", "privacy.residue.rehomeMigrated"],
    ["pending", "privacy.residue.rehomePending"],
    ["incomplete", "privacy.residue.rehomeIncomplete"],
  ] as const)("states the re-home as %s", (state, label) => {
    renderPanel(
      disclosure({
        rehome: {
          state,
          completed: state === "migrated",
          markerKey: LEGACY_PII_REHOME_MARKER_KEY,
        },
      }),
    );
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ["absent", "privacy.residue.historyAbsent"],
    ["complete", "privacy.residue.historyComplete"],
    ["resumable", "privacy.residue.historyResumable"],
  ] as const)("states the history marker as %s", (state, label) => {
    renderPanel(
      disclosure({
        historyMarker: {
          state,
          markerKey: MIGRATION_MARKER_KEY,
          legacyPlaintextResidue: false,
        },
      }),
    );
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("exposes the marker key NAMES, never their values", () => {
    renderPanel(disclosure());
    expect(
      screen.getByText(new RegExp(LEGACY_PII_REHOME_MARKER_KEY)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(MIGRATION_MARKER_KEY)),
    ).toBeInTheDocument();
  });

  it("discloses the legacy marker's plaintext residue only when it is present", () => {
    // F1: the manifest declares the legacy marker encrypted_at_rest, but any
    // value an old build left is PLAINTEXT residue. The panel must say so.
    renderPanel(
      disclosure({
        historyMarker: {
          state: "resumable",
          markerKey: MIGRATION_MARKER_KEY,
          legacyPlaintextResidue: true,
        },
      }),
    );
    expect(
      screen.getByText(/privacy\.residue\.legacyMarkerPlaintext/),
    ).toBeInTheDocument();
  });

  it("hides the plaintext-marker disclosure when no legacy value remains", () => {
    renderPanel(disclosure());
    expect(
      screen.queryByText(/privacy\.residue\.legacyMarkerPlaintext/),
    ).not.toBeInTheDocument();
  });
});

describe("LegacyResidueDisclosure — drift (T4.6, value-free)", () => {
  it("renders no drift warning when there is no drift", () => {
    renderPanel(disclosure());
    expect(
      screen.queryByText(/privacy\.residue\.driftHeading/),
    ).not.toBeInTheDocument();
  });

  it("renders the honest drift warning when the source changed", () => {
    renderPanel(
      disclosure({
        drift: { detected: true, sources: ["open3dcalc_history_v2"] },
      }),
    );
    expect(
      screen.getByText(/privacy\.residue\.driftHeading/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/privacy\.residue\.driftWarning/),
    ).toBeInTheDocument();
  });

  it("names the changed KEY, never a value", () => {
    renderPanel(
      disclosure({
        drift: { detected: true, sources: ["open3dcalc_products"] },
      }),
    );
    expect(screen.getByText(/open3dcalc_products/)).toBeInTheDocument();
  });
});

describe("LegacyResidueDisclosure — default derivation", () => {
  it("waits for an explicit user request before inspecting legacy data", () => {
    const legacyRows = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };
    render(<LegacyResidueDisclosure />);
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "privacy.quarantine.refresh" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("privacy.residue.residueNone")).toBeNull();
    expect(legacyRows).not.toHaveBeenCalled();
  });

  it("does not render an empty-residue claim when explicit inspection is unavailable", async () => {
    const legacyRows = vi.fn().mockRejectedValue(new Error("IPC disabled"));
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };
    render(<LegacyResidueDisclosure />);

    fireEvent.click(
      screen.getByRole("button", { name: "privacy.quarantine.refresh" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "privacy.quarantine.loadError",
    );
    expect(screen.queryByText("privacy.residue.residueNone")).toBeNull();
    expect(legacyRows).toHaveBeenCalledTimes(1);
  });

  it("discloses the DESKTOP residue read over IPC after explicit inspection", async () => {
    // The bridge never hydrates the three PII keys, so the residue is in SQLite
    // and only the read-only IPC answers. The panel must show it, key name and
    // count only.
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: {
        legacyRows: async () => ({
          scannedAt: new Date().toISOString(),
          rows: [
            {
              key: "open3dcalc_customers_v1",
              value: JSON.stringify({
                state: { customers: [{ id: "a" }, { id: "b" }] },
              }),
              status: "legacy_plaintext",
            },
            {
              key: "open3dcalc_quotes_v1",
              value: null,
              status: "absent",
            },
            {
              key: "open3dcalc_history_v2",
              value: null,
              status: "absent",
            },
          ],
        }),
      },
    };
    try {
      render(<LegacyResidueDisclosure />);
      fireEvent.click(
        screen.getByRole("button", { name: "privacy.quarantine.refresh" }),
      );
      await waitFor(() =>
        expect(screen.getByText(/open3dcalc_customers_v1/)).toBeInTheDocument(),
      );
    } finally {
      delete (window as { electronAPI?: unknown }).electronAPI;
    }
  });
});
