import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrivacyScreen } from "../PrivacyScreen";

// ---------------------------------------------------------------------------
// D1.1 S4 — privacy screen: presents the quarantine state (metadata only)
// and the two explicit exits (migrate / eliminate — ADR-002 §2.2.3/§2.2.4).
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  quarantineReport: vi.fn(),
  migrateKey: vi.fn(),
  eliminateKey: vi.fn(),
}));

vi.mock("react-i18next", () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    if (opts && "key" in opts) return `${key}:${String(opts.key)}`;
    if (opts && "count" in opts) return `${key}:${String(opts.count)}`;
    return key;
  };
  return {
    useTranslation: () => ({ t }),
  };
});

const baseReport = {
  scannedAt: new Date().toISOString(),
  entries: [
    { key: "open3dcalc_quotes_v1", status: "quarantined", recordCount: 3 },
    { key: "open3dcalc_settings_v2", status: "non_pii" },
  ],
  quarantinedKeys: ["open3dcalc_quotes_v1"],
};

function stubElectronApi(): void {
  vi.stubGlobal("electronAPI", {
    privacy: {
      quarantineReport: hoisted.quarantineReport,
      migrateKey: hoisted.migrateKey,
      eliminateKey: hoisted.eliminateKey,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  hoisted.quarantineReport.mockResolvedValue(baseReport);
  hoisted.migrateKey.mockResolvedValue({
    key: "open3dcalc_quotes_v1",
    migrated: true,
    verified: true,
  });
  hoisted.eliminateKey.mockResolvedValue({
    key: "open3dcalc_quotes_v1",
    eliminated: true,
  });
});

describe("PrivacyScreen (D1.1 S4)", () => {
  it("renders quarantined keys with record counts and both exits", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    await waitFor(() =>
      expect(screen.getAllByText(/quarantined|Quarantined/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/privacy.quarantine.records:3/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "privacy.quarantine.migrate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "privacy.quarantine.eliminate" }),
    ).toBeInTheDocument();
  });

  it("migrate calls the IPC and refreshes the report", async () => {
    stubElectronApi();
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PrivacyScreen />);
    await waitFor(() =>
      expect(hoisted.quarantineReport).toHaveBeenCalledTimes(1),
    );
    await user.click(
      screen.getByRole("button", { name: "privacy.quarantine.migrate" }),
    );
    await waitFor(() => expect(hoisted.migrateKey).toHaveBeenCalled());
    await waitFor(() =>
      expect(hoisted.quarantineReport).toHaveBeenCalledTimes(2),
    );
  });

  it("eliminate calls the IPC with the quarantined key", async () => {
    stubElectronApi();
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PrivacyScreen />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "privacy.quarantine.eliminate" })),
    );
    await user.click(
      screen.getByRole("button", { name: "privacy.quarantine.eliminate" }),
    );
    await waitFor(() =>
      expect(hoisted.eliminateKey).toHaveBeenCalledWith("open3dcalc_quotes_v1"),
    );
  });

  it("never renders quarantined values — metadata only", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    await waitFor(() => expect(screen.getAllByText(/open3dcalc_quotes_v1/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Fernanda/)).not.toBeInTheDocument();
  });

  it("shows the desktop-only notice on web (no electronAPI)", () => {
    render(<PrivacyScreen />);
    expect(screen.getByText("privacy.quarantine.desktopOnly")).toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });
});
