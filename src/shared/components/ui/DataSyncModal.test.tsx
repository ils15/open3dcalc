import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataSyncModal } from "./DataSyncModal";

const { mockExportData, mockImportData } = vi.hoisted(() => ({
  mockExportData: vi.fn(),
  mockImportData: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/lib/dataSync", () => ({
  exportData: (...args: unknown[]) => mockExportData(...args),
  importData: (...args: unknown[]) => mockImportData(...args),
}));

describe("DataSyncModal", () => {
  beforeEach(() => {
    mockExportData.mockReset();
    mockImportData.mockReset().mockResolvedValue({
      imported: 3,
      conflicts: 0,
      errors: 0,
    });
  });

  it("renders nothing when closed", () => {
    const { container } = render(<DataSyncModal open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("exports readable JSON without a password", async () => {
    mockExportData.mockResolvedValue({
      fileName: "backup.open3dcalc",
      sizeBytes: 2048,
    });
    render(<DataSyncModal open={true} />);

    const button = screen.getByRole("button", { name: "sync.export.button" });
    expect(button).toBeEnabled();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    fireEvent.click(button);

    expect(mockExportData).toHaveBeenCalledWith();
    expect(await screen.findByText(/backup.open3dcalc/)).toBeInTheDocument();
  });

  it("does not show a password field when selecting a legacy encrypted file", () => {
    const { container } = render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['{"encrypted":true}'], "legacy.open3dcalc", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("imports a readable file without a password", async () => {
    const { container } = render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["{}"], "backup.open3dcalc", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));

    expect(mockImportData).toHaveBeenCalledWith(file, { mode: "merge" });
    expect(
      await screen.findByText("sync.import.results.imported"),
    ).toBeInTheDocument();
  });

  it("shows the local-data privacy notice", () => {
    render(<DataSyncModal open={true} />);
    expect(screen.getByText(/sync.lgpd_notice/)).toBeInTheDocument();
  });
});
