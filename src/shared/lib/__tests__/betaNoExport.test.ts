import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

const createExportEnvelope = vi.hoisted(() =>
  vi.fn(async () => "synthetic-envelope"),
);
const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/lib/exportEnvelope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/lib/exportEnvelope")>();
  return { ...actual, createExportEnvelope };
});
vi.mock("@/shared/lib/download", () => ({ downloadBlob }));

import { DataSyncModal } from "@/shared/components/ui/DataSyncModal";
import { exportData } from "@/shared/lib/dataSync";
import { importData } from "@/shared/lib/dataSync";

describe("betaNoExport", () => {
  beforeEach(() => {
    createExportEnvelope.mockClear();
    downloadBlob.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not expose the import/export dialog in the Beta channel", () => {
    render(createElement(DataSyncModal, { open: true }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("refuses encrypted export before payload collection or download", async () => {
    await expect(
      exportData({ password: "synthetic-test-password" }),
    ).rejects.toThrow(/unsupported|unavailable|beta/i);

    expect(createExportEnvelope).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("refuses import before reading the selected file", async () => {
    const file = new File(["{}"], "synthetic-beta-import.json", {
      type: "application/json",
    });
    const readFile = vi.spyOn(file, "text");

    await importData(file, { mode: "merge" }).catch(() => undefined);

    expect(readFile).not.toHaveBeenCalled();
  });
});
