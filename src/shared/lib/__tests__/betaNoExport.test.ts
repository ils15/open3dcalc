import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/lib/download", () => ({ downloadBlob }));

import { DataSyncModal } from "@/shared/components/ui/DataSyncModal";
import { exportData } from "@/shared/lib/dataSync";
import { importData } from "@/shared/lib/dataSync";

describe("betaDataExport", () => {
  beforeEach(() => {
    downloadBlob.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("makes the real-data import/export dialog available in Beta", () => {
    render(createElement(DataSyncModal, { open: true }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "sync.export.button" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("sync.export.password")).toBeNull();
  });

  it("exports readable JSON without a password", async () => {
    const result = await exportData();

    expect(result.fileName).toMatch(/open3dcalc-sync-/);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob] = downloadBlob.mock.calls[0];
    const bundle = JSON.parse(await (blob as Blob).text());
    expect(bundle).not.toHaveProperty("encrypted");
    expect(bundle.data).toMatchObject({
      customers: [],
      quotes: [],
      history: [],
    });
  });

  it("allows the Beta import flow to read a user-selected file", async () => {
    const file = new File(["{}"], "synthetic-beta-import.json", {
      type: "application/json",
    });
    const readFile = vi.spyOn(file, "text");

    await importData(file, { mode: "merge" }).catch(() => undefined);

    expect(readFile).toHaveBeenCalledTimes(1);
  });
});
