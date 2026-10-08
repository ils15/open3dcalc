import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/components/ui/PrivacyBanner", () => ({
  PrivacyBanner: () => <div data-testid="privacy-banner" />,
}));

import { PrivacyOnboarding } from "../PrivacyOnboarding";

describe("PrivacyOnboarding", () => {
  it("shows Stable privacy information without requiring consent to save", () => {
    render(<PrivacyOnboarding />);
    expect(screen.getByTestId("privacy-banner")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
