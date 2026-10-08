import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const consentState = vi.hoisted(() => ({
  consentGiven: false,
  privacyBannerDismissed: false,
  giveConsent: vi.fn(),
  dismissBanner: vi.fn(),
}));
const consentStoreRead = vi.hoisted(() => vi.fn());

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/stores/consentStore", () => ({
  useConsentStore: (selector: (state: typeof consentState) => unknown) => {
    consentStoreRead();
    return selector(consentState);
  },
}));

import { PrivacyOnboarding } from "../PrivacyOnboarding";

afterEach(() => {
  cleanup();
  consentState.consentGiven = false;
  consentState.privacyBannerDismissed = false;
  consentState.giveConsent.mockClear();
  consentStoreRead.mockClear();
});

describe("betaFirstRun", () => {
  it("explains test-only synthetic plaintext storage and the unavailable features", () => {
    render(<PrivacyOnboarding />);

    expect(screen.getByText("privacy.betaFirstRun.title")).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.testOnly"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.syntheticOnly"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.plaintextLocal"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.noPassword"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.noMigration"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.noExport"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("privacy.betaFirstRun.disposable"),
    ).toBeInTheDocument();
  });

  it("does not put a consent modal or password gate in front of the Beta test app", () => {
    render(<PrivacyOnboarding />);

    // Wave4: the Beta first-run notice IS a dialog (role=dialog with the
    // honest betaFirstRun copy), but it must never be a consent modal nor a
    // password gate — so it must not touch the consent store.
    expect(
      screen.getByRole("dialog", { name: "privacy.betaFirstRun.title" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/password|senha/i)).toBeNull();
    expect(consentState.giveConsent).not.toHaveBeenCalled();
    expect(consentStoreRead).not.toHaveBeenCalled();
  });
});
