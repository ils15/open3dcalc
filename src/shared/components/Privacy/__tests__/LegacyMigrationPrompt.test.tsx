import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";

import type { LegacyPiiPlaintextReport } from "@/shared/lib/legacyPiiPlaintext";
import {
  residueSignature,
  useLegacyKeepReadOnlyStore,
} from "@/shared/stores/legacyKeepReadOnlyStore";

/**
 * T5.2 — the mount point that opens the choice dialog when there IS plaintext
 * residue AND migration consent has not been granted. A prompt that appears
 * with nothing to do, or that keeps nagging after an explicit answer, is a
 * regression this file pins.
 */

const mockDetect = vi.fn();
const consentState = { migrationConsentGiven: false };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/lib/legacyPiiPlaintext", () => ({
  detectLegacyPlaintextPii: () => mockDetect(),
}));

vi.mock("@/shared/stores/consentStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useConsentStore: (selector?: any) => {
    const state = { migrationConsentGiven: consentState.migrationConsentGiven };
    return selector ? selector(state) : state;
  },
}));

vi.mock("../LegacyMigrationDialog", () => ({
  LegacyMigrationDialog: ({
    open,
    onRequestClose,
    onOpenExport,
    onKeepReadOnly,
  }: {
    open: boolean;
    onRequestClose: () => void;
    onOpenExport: () => void;
    onKeepReadOnly?: () => void;
  }) =>
    open ? (
      <div data-testid="migration-dialog">
        <button type="button" onClick={onRequestClose}>
          close
        </button>
        <button type="button" onClick={onKeepReadOnly}>
          keep
        </button>
        <button type="button" onClick={onOpenExport}>
          export
        </button>
      </div>
    ) : null,
}));

vi.mock("@/shared/components/ui/DataSyncModal", () => ({
  DataSyncModal: ({
    open,
    onRequestClose,
  }: {
    open: boolean;
    onRequestClose: () => void;
  }) =>
    open ? (
      <div data-testid="sync-modal">
        <button type="button" onClick={onRequestClose}>
          sync-close
        </button>
      </div>
    ) : null,
}));

import { LegacyMigrationPrompt } from "../LegacyMigrationPrompt";

function reportOf(present: boolean): LegacyPiiPlaintextReport {
  return {
    present,
    total: present ? 2 : 0,
    keys: [
      { key: "open3dcalc_customers_v1", present, count: present ? 2 : 0 },
      { key: "open3dcalc_quotes_v1", present: false, count: 0 },
      { key: "open3dcalc_history_v2", present: false, count: 0 },
    ],
  };
}

beforeEach(() => {
  mockDetect.mockReset();
  consentState.migrationConsentGiven = false;
  window.localStorage.clear();
  useLegacyKeepReadOnlyStore.setState({ signature: null });
});

describe("LegacyMigrationPrompt", () => {
  it("does not prompt when there is no residue", async () => {
    mockDetect.mockReturnValue(reportOf(false));
    render(<LegacyMigrationPrompt />);
    await waitFor(() => expect(mockDetect).toHaveBeenCalled());
    expect(screen.queryByTestId("migration-dialog")).toBeNull();
  });

  it("prompts when residue exists and migration consent is pending", async () => {
    mockDetect.mockReturnValue(reportOf(true));
    render(<LegacyMigrationPrompt />);
    expect(await screen.findByTestId("migration-dialog")).toBeInTheDocument();
  });

  it("does not prompt once migration consent is granted", async () => {
    mockDetect.mockReturnValue(reportOf(true));
    consentState.migrationConsentGiven = true;
    render(<LegacyMigrationPrompt />);
    await waitFor(() => expect(mockDetect).toHaveBeenCalled());
    expect(screen.queryByTestId("migration-dialog")).toBeNull();
  });

  it("dismisses for the session when the dialog closes", async () => {
    mockDetect.mockReturnValue(reportOf(true));
    render(<LegacyMigrationPrompt />);

    await screen.findByTestId("migration-dialog");
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByTestId("migration-dialog")).toBeNull();
  });

  it("hands export over to the existing sync modal and closes the dialog", async () => {
    mockDetect.mockReturnValue(reportOf(true));
    render(<LegacyMigrationPrompt />);

    await screen.findByTestId("migration-dialog");
    fireEvent.click(screen.getByRole("button", { name: "export" }));
    expect(screen.queryByTestId("migration-dialog")).toBeNull();
    expect(screen.getByTestId("sync-modal")).toBeInTheDocument();
  });

  it("closes the export modal when the sync flow requests it", async () => {
    mockDetect.mockReturnValue(reportOf(true));
    render(<LegacyMigrationPrompt />);

    await screen.findByTestId("migration-dialog");
    fireEvent.click(screen.getByRole("button", { name: "export" }));
    expect(screen.getByTestId("sync-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sync-close" }));
    expect(screen.queryByTestId("sync-modal")).toBeNull();
  });

  // ── L-2: the keep-read-only decision is remembered ──────────────────────

  it("records the keep-read-only choice value-free when the user keeps it", async () => {
    mockDetect.mockReturnValue(reportOf(true));
    render(<LegacyMigrationPrompt />);

    await screen.findByTestId("migration-dialog");
    fireEvent.click(screen.getByRole("button", { name: "keep" }));

    expect(useLegacyKeepReadOnlyStore.getState().signature).toBe(
      residueSignature(reportOf(true)),
    );
    const raw = window.localStorage.getItem(
      "open3dcalc_legacy_keep_readonly_v1",
    );
    expect(raw).not.toBeNull();
    // The persistence carries the residue signature only — never a record.
    expect(raw).toContain(residueSignature(reportOf(true)));
  });

  it("does not prompt on a later session while the residue is unchanged", async () => {
    useLegacyKeepReadOnlyStore.setState({
      signature: residueSignature(reportOf(true)),
    });
    mockDetect.mockReturnValue(reportOf(true));

    render(<LegacyMigrationPrompt />);
    await waitFor(() => expect(mockDetect).toHaveBeenCalled());
    expect(screen.queryByTestId("migration-dialog")).toBeNull();
  });

  it("prompts again when the residue changed after the keep-read-only choice", async () => {
    useLegacyKeepReadOnlyStore.setState({
      signature: residueSignature(reportOf(false)),
    });
    mockDetect.mockReturnValue(reportOf(true));

    render(<LegacyMigrationPrompt />);
    expect(await screen.findByTestId("migration-dialog")).toBeInTheDocument();
  });

  it("re-prompts when the Privacy screen reopens the choice", async () => {
    useLegacyKeepReadOnlyStore.setState({
      signature: residueSignature(reportOf(true)),
    });
    mockDetect.mockReturnValue(reportOf(true));

    render(<LegacyMigrationPrompt />);
    await waitFor(() => expect(mockDetect).toHaveBeenCalled());
    expect(screen.queryByTestId("migration-dialog")).toBeNull();

    act(() => useLegacyKeepReadOnlyStore.getState().reopen());

    expect(await screen.findByTestId("migration-dialog")).toBeInTheDocument();
  });
});
