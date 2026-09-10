import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingModal } from "../OnboardingModal";

// Mock i18n — resolves the onboarding keys so tests assert translated labels
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "onboarding.previous": "Anterior",
        "onboarding.next": "Próximo",
        "onboarding.slideOf": "Slide {{current}} de {{total}}",
      };
      let value = translations[key] ?? key;
      if (options) {
        for (const [name, replacement] of Object.entries(options)) {
          value = value.replace(`{{${name}}}`, String(replacement));
        }
      }
      return value;
    },
  }),
}));

describe("OnboardingModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders when not dismissed", () => {
    render(<OnboardingModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when previously dismissed", () => {
    localStorage.setItem("open3dcalc_onboarded", "true");
    const { container } = render(<OnboardingModal />);
    expect(container.innerHTML).toBe("");
  });

  it("dismisses when close button is clicked", () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);
    fireEvent.click(screen.getByLabelText("common.close"));
    expect(onComplete).toHaveBeenCalled();
    expect(localStorage.getItem("open3dcalc_onboarded")).toBe("true");
  });

  it("navigates between slides", () => {
    render(<OnboardingModal />);
    // Click next button
    const nextButton = screen.getByLabelText("Próximo");
    fireEvent.click(nextButton);
    // Should still be in dialog
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders navigation labels from i18n", () => {
    render(<OnboardingModal />);
    expect(screen.getByLabelText("Anterior")).toBeInTheDocument();
    expect(screen.getByLabelText("Próximo")).toBeInTheDocument();
    expect(screen.getByLabelText("Slide 1 de 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Slide 2 de 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Slide 3 de 3")).toBeInTheDocument();
  });
});
