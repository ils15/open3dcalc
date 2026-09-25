import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tab } from "@/shared/components/AppShell/tabs";

vi.mock("@/shared/components/Header/Header", () => ({ Header: () => null }));
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => null,
}));
vi.mock("@/shared/components/DemoMode/DemoExportBlockedToast", () => ({
  DemoExportBlockedToast: () => null,
}));
vi.mock("@/shared/components/ui/PrivacyBanner", () => ({
  PrivacyBanner: () => null,
}));
vi.mock("@/shared/components/ui/Tutorial", () => ({ Tutorial: () => null }));
vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/components/AppShell/AppShell", () => ({
  AppShell: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
  }): React.ReactElement => (
    <section aria-label="web app shell">
      <output aria-label="active tab">{activeTab}</output>
      <button type="button" onClick={() => onTabChange("history")}>
        Open history
      </button>
    </section>
  ),
}));
vi.mock("./SecondaryNavigation", () => ({
  SecondaryNavigation: () => null,
}));
vi.mock("./components/MobileNav", () => ({ MobileNav: () => null }));
vi.mock("./components/Footer", () => ({ Footer: () => null }));

import App from "./App";

describe("web App navigation owner", () => {
  it("starts at calculator and passes tab transitions through the shared owner", () => {
    render(<App />);

    expect(screen.getByLabelText("active tab")).toHaveTextContent("calculator");
    fireEvent.click(screen.getByRole("button", { name: "Open history" }));
    expect(screen.getByLabelText("active tab")).toHaveTextContent("history");
  });
});
