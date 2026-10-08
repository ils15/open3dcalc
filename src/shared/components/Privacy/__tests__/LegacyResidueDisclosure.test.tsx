import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { LegacyResidueDisclosure } from "../LegacyResidueDisclosure";

afterEach(() => {
  delete (window as { electronAPI?: unknown }).electronAPI;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("LegacyResidueDisclosure retired-path boundary", () => {
  it("does not inspect local Stable residue or render an empty-residue claim", async () => {
    window.localStorage.setItem(
      "open3dcalc_customers_v1",
      '{"state":{"customers":[{"id":"synthetic-canary"}]}}',
    );
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    render(<LegacyResidueDisclosure />);

    fireEvent.click(
      screen.getByRole("button", { name: "privacy.quarantine.refresh" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "privacy.quarantine.loadError",
      ),
    );

    expect(getItem).not.toHaveBeenCalledWith("open3dcalc_customers_v1");
    expect(window.localStorage.getItem("open3dcalc_customers_v1")).toContain(
      "synthetic-canary",
    );
    expect(screen.queryByText("privacy.residue.residueNone")).toBeNull();
  });

  it("does not call the retired desktop residue IPC or disclose its response", async () => {
    const legacyRows = vi.fn(async () => ({
      scannedAt: new Date().toISOString(),
      rows: [
        {
          key: "open3dcalc_customers_v1",
          value: '{"state":{"customers":[{"id":"synthetic-canary"}]}}',
          status: "legacy_plaintext",
        },
      ],
    }));
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };
    render(<LegacyResidueDisclosure />);

    fireEvent.click(
      screen.getByRole("button", { name: "privacy.quarantine.refresh" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "privacy.quarantine.loadError",
      ),
    );

    expect(legacyRows).not.toHaveBeenCalled();
    expect(screen.queryByText(/open3dcalc_customers_v1/)).toBeNull();
    expect(screen.queryByText(/synthetic-canary/)).toBeNull();
  });
});
