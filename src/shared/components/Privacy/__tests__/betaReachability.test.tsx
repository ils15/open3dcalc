import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const residueDisclosureMounted = vi.hoisted(() => vi.fn());
const consentStoreImported = vi.hoisted(() => vi.fn());
const vaultRuntime = vi.hoisted(() => ({
  install: vi.fn(),
  rehydrate: vi.fn(),
  unlock: vi.fn(),
  access: vi.fn(),
  profile: vi.fn(),
}));

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
vi.mock("@/shared/lib/crypto/piiStoreHydration", () => ({
  getPiiStoreAccessState: vaultRuntime.access,
  getPiiStoreRuntimeOptions: vi.fn(),
  hasExistingPiiProfile: vaultRuntime.profile,
  installPiiStoreRuntimeEnvironment: vaultRuntime.install,
  rehydratePiiStoresIfUnlocked: vaultRuntime.rehydrate,
  unlockPiiStoresAndRehydrate: vaultRuntime.unlock,
  setBetaReadabilityChecker: vi.fn(),
  resetBetaReadabilityCheckerForTests: vi.fn(),
}));

import { PrivacyScreen } from "../PrivacyScreen";

afterEach(() => {
  cleanup();
  residueDisclosureMounted.mockClear();
  consentStoreImported.mockClear();
  Object.values(vaultRuntime).forEach((spy) => spy.mockClear());
});

describe("Beta privacy reachability", () => {
  it("does not read legacy data, probe the vault, or mount privacy controls", () => {
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
    expect(vaultRuntime.install).not.toHaveBeenCalled();
    expect(vaultRuntime.rehydrate).not.toHaveBeenCalled();
    expect(vaultRuntime.profile).not.toHaveBeenCalled();
    expect(vaultRuntime.access).not.toHaveBeenCalled();
    expect(vaultRuntime.unlock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("open3dcalc_customers_v1")).toContain(
      "synthetic-canary",
    );
  });
});
