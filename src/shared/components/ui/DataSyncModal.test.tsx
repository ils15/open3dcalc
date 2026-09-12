import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataSyncModal } from "./DataSyncModal";

const { mockExportData, mockImportData, mockIsEncrypted } = vi.hoisted(() => ({
  mockExportData: vi.fn(),
  mockImportData: vi.fn(),
  mockIsEncrypted: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// dataSync.ts is implemented in parallel — the factory mock replaces the module
vi.mock("@/shared/lib/dataSync", () => ({
  exportData: (...args: unknown[]) => mockExportData(...args),
  importData: (...args: unknown[]) => mockImportData(...args),
  isEncrypted: (...args: unknown[]) => mockIsEncrypted(...args),
}));

describe("DataSyncModal", () => {
  beforeEach(() => {
    mockExportData.mockReset();
    mockImportData.mockReset();
    mockIsEncrypted.mockReset();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<DataSyncModal open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders with export tab active by default", () => {
    render(<DataSyncModal open={true} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "sync.export.tab" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "sync.import.tab" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("sync.export.description")).toBeInTheDocument();
  });

  it("switches between export and import tabs", () => {
    render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));
    expect(
      screen.getByRole("tab", { name: "sync.import.tab" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("sync.import.warning")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "sync.export.tab" }));
    expect(
      screen.getByRole("tab", { name: "sync.export.tab" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("sync.export.description")).toBeInTheDocument();
  });

  it("triggers download when export button is clicked", async () => {
    mockExportData.mockResolvedValue({
      fileName: "backup.open3dcalc",
      sizeBytes: 2048,
    });
    render(<DataSyncModal open={true} />);
    // SPEC-03: export is always encrypted — the password is required.
    const button = screen.getByRole("button", { name: "sync.export.button" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("sync.export.password"), {
      target: { value: "senha-sintética" },
    });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(mockExportData).toHaveBeenCalledTimes(1);
    expect(mockExportData).toHaveBeenCalledWith({
      password: "senha-sintética",
    });
    expect(await screen.findByText(/backup.open3dcalc/)).toBeInTheDocument();
    expect(screen.getByText(/sync.export.success/)).toBeInTheDocument();
  });

  it("toggles password field visibility", () => {
    render(<DataSyncModal open={true} />);

    // SPEC-03: encryption is mandatory — the field is always visible.
    const input = screen.getByLabelText(
      "sync.export.password",
    ) as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(
      screen.getByRole("button", { name: "sync.export.passwordShow" }),
    );
    expect(input.type).toBe("text");

    fireEvent.click(
      screen.getByRole("button", { name: "sync.export.passwordHide" }),
    );
    expect(input.type).toBe("password");
  });

  it("accepts .open3dcalc files in the import picker", () => {
    const { container } = render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe(".open3dcalc");
    expect(input).toHaveAttribute("aria-label", "sync.import.selectFile");
  });

  it("imports a file and shows results", async () => {
    mockIsEncrypted.mockResolvedValue(false);
    mockImportData.mockResolvedValue({ imported: 3, conflicts: 1, errors: 0 });
    const { container } = render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["data"], "backup.open3dcalc", {
      type: "application/octet-stream",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockIsEncrypted).toHaveBeenCalledWith(file));

    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));
    expect(mockImportData).toHaveBeenCalledWith(file, {
      password: undefined,
      mode: "merge",
    });

    expect(
      await screen.findByText("sync.import.results.imported"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("sync.import.results.conflicts"),
    ).toBeInTheDocument();
    expect(screen.getByText(/sync.import.success/)).toBeInTheDocument();
  });

  it("shows decryption password field for encrypted files", async () => {
    mockIsEncrypted.mockResolvedValue(true);
    const { container } = render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));

    expect(
      screen.queryByLabelText("sync.import.password"),
    ).not.toBeInTheDocument();

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["enc"], "backup.open3dcalc", {
      type: "application/octet-stream",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByLabelText("sync.import.password")).toBeInTheDocument(),
    );
  });

  it("switches import mode selector", () => {
    render(<DataSyncModal open={true} />);
    fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();

    fireEvent.click(radios[1]);
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
  });

  it("closes on Escape key", () => {
    const onRequestClose = vi.fn();
    render(<DataSyncModal open={true} onRequestClose={onRequestClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("shows the LGPD notice with privacy link", () => {
    render(<DataSyncModal open={true} />);
    expect(screen.getByText(/sync.lgpd_notice/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "sync.privacy_link" }),
    ).toBeInTheDocument();
  });

  it("exposes accessible names on interactive elements", () => {
    render(<DataSyncModal open={true} />);

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-label",
      "sync.title",
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "common.close" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "sync.export.tab" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "sync.import.tab" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "sync.export.button" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "sync.privacy_link" }),
    ).toBeInTheDocument();
  });
});
