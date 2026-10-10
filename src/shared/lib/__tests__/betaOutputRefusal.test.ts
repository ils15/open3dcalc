import { afterEach, describe, expect, it, vi } from "vitest";

import { guardExport } from "@/shared/lib/demoExportGuard";
import { downloadBlob } from "@/shared/lib/download";

afterEach(() => vi.restoreAllMocks());

describe("Beta real-data export", () => {
  it("allows local exports outside demo mode", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:beta-export-test");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    expect(guardExport()).toBe(false);
    downloadBlob(new Blob(["local user data"]), "open3dcalc-export.json");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:beta-export-test");
  });
});
