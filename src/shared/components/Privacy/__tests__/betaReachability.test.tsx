import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const residueDisclosureMounted = vi.hoisted(() => vi.fn());
const consentStoreImported = vi.hoisted(() => vi.fn());

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/components/Privacy/LegacyResidueDisclosure", () => ({
  LegacyResidueDisclosure: () => {
    residueDisclosureMounted();
    return <div>legacy residue</div>;
  },
}));
vi.mock("@/shared/stores/consentStore", () => {
  consentStoreImported();
  return {
    useConsentStore: { getState: vi.fn() },
  };
});
import { PrivacyScreen } from "../PrivacyScreen";

afterEach(() => {
  cleanup();
  residueDisclosureMounted.mockClear();
  consentStoreImported.mockClear();
});

describe("Beta privacy reachability", () => {
  it("does not read legacy data or mount privacy controls", () => {
    window.localStorage.setItem(
      "open3dcalc_customers_v1",
      '{"state":{"customers":[{"id":"synthetic-canary"}]}}',
    );
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const { container } = render(<PrivacyScreen />);

    expect(container).toBeEmptyDOMElement();
    expect(residueDisclosureMounted).not.toHaveBeenCalled();
    expect(consentStoreImported).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
    expect(getItem).not.toHaveBeenCalledWith("open3dcalc_customers_v1");
    expect(window.localStorage.getItem("open3dcalc_customers_v1")).toContain(
      "synthetic-canary",
    );
  });
});
