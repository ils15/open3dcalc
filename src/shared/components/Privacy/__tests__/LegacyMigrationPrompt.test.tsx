import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import { LegacyMigrationPrompt } from "../LegacyMigrationPrompt";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("LegacyMigrationPrompt retired-path boundary", () => {
  it("does not render or read Stable legacy residue in Beta", () => {
    window.localStorage.setItem(
      "open3dcalc_customers_v1",
      '{"state":{"customers":[{"id":"synthetic-canary"}]}}',
    );
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    const { container } = render(<LegacyMigrationPrompt />);

    expect(container).toBeEmptyDOMElement();
    expect(getItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("open3dcalc_customers_v1")).toContain(
      "synthetic-canary",
    );
  });
});
