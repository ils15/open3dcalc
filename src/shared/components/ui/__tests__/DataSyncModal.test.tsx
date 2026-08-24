import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataSyncModal } from "../DataSyncModal";

const { mockImportData, mockExportData, mockIsEncrypted } = vi.hoisted(() => ({
  mockImportData: vi.fn(),
  mockExportData: vi.fn(),
  mockIsEncrypted: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/lib/dataSync", () => ({
  exportData: (...args: unknown[]) => mockExportData(...args),
  importData: (...args: unknown[]) => mockImportData(...args),
  isEncrypted: (...args: unknown[]) => mockIsEncrypted(...args),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { initial, animate, exit, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function selectFile() {
  fireEvent.click(screen.getByRole("tab", { name: "sync.import.tab" }));
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File(['{"data":1}'], "backup.open3dcalc", {
    type: "application/json",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("DataSyncModal import confirmation", () => {
  beforeEach(() => {
    mockImportData.mockReset();
    mockExportData.mockReset();
    mockIsEncrypted.mockReset().mockResolvedValue(false);
    mockImportData.mockResolvedValue({ imported: 5, conflicts: 0, errors: 0 });
  });

  it("imports immediately in merge mode without confirmation", () => {
    render(<DataSyncModal open={true} />);
    selectFile();
    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));
    expect(mockImportData).toHaveBeenCalledTimes(1);
    expect(mockImportData).toHaveBeenCalledWith(expect.any(File), {
      password: undefined,
      mode: "merge",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a confirmation warning before importing in replace mode", () => {
    render(<DataSyncModal open={true} />);
    selectFile();
    fireEvent.click(
      screen.getByRole("radio", { name: /sync.import.modeReplace/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));

    expect(mockImportData).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("sync.import.replaceConfirm");
    expect(
      screen.getByRole("button", { name: "common.confirm" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "common.cancel" }),
    ).toBeInTheDocument();
  });

  it("proceeds with the import after confirming", () => {
    render(<DataSyncModal open={true} />);
    selectFile();
    fireEvent.click(
      screen.getByRole("radio", { name: /sync.import.modeReplace/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    expect(mockImportData).toHaveBeenCalledTimes(1);
    expect(mockImportData).toHaveBeenCalledWith(expect.any(File), {
      password: undefined,
      mode: "replace",
    });
  });

  it("dismisses the warning without importing when cancelled", () => {
    render(<DataSyncModal open={true} />);
    selectFile();
    fireEvent.click(
      screen.getByRole("radio", { name: /sync.import.modeReplace/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(mockImportData).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets the confirmation when the import mode changes", () => {
    render(<DataSyncModal open={true} />);
    selectFile();
    fireEvent.click(
      screen.getByRole("radio", { name: /sync.import.modeReplace/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "sync.import.button" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", { name: /sync.import.modeMerge/ }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
