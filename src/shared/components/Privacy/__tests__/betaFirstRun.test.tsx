import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));
vi.mock("@/shared/stores/consentStore", () => ({
  useConsentStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ privacyBannerDismissed: false, dismissBanner: vi.fn() }),
}));

import { PrivacyOnboarding } from "../PrivacyOnboarding";

afterEach(() => cleanup());

describe("Beta local-data disclosure", () => {
  it("shows the non-blocking local-data notice without asking for a password", () => {
    render(<PrivacyOnboarding />);

    expect(screen.getByRole("status")).toHaveTextContent("privacy.banner.text");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText(/passphrase|senha/i)).toBeNull();
  });
});
