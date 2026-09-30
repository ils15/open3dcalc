import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

vi.mock("../useVisibleNavigation", () => ({
  useVisiblePrimaryTabs: () => [
    "calculator",
    "dashboard",
    "history",
    "catalog",
    "inventory",
  ],
}));

import { DesktopSidebar, TabletSidebar } from "../Sidebar";

const noop = () => {};

describe("sidebar groups", () => {
  it("groups the navigation modules under a named region", () => {
    render(
      <DesktopSidebar
        activeTab="calculator"
        onTabChange={noop}
        footer={<div data-testid="resources" />}
      />,
    );

    const modules = screen.getByRole("region", { name: "nav.navigation" });
    for (const key of [
      "nav.pricing",
      "nav.dashboard",
      "nav.history",
      "nav.printers",
      "nav.spools",
    ]) {
      expect(
        within(modules).getByRole("button", { name: key }),
      ).toBeInTheDocument();
    }
  });

  it("renders the resources group once, owned by the platform footer", () => {
    render(
      <DesktopSidebar
        activeTab="calculator"
        onTabChange={noop}
        footer={<div data-testid="resources">Links úteis</div>}
      />,
    );

    // The modules group must not restate the resources, and the footer is
    // rendered exactly once — grouping must not duplicate the external links.
    expect(screen.getAllByTestId("resources")).toHaveLength(1);
    const modules = screen.getByRole("region", { name: "nav.navigation" });
    expect(within(modules).queryByText(/Links úteis/)).not.toBeInTheDocument();
  });

  it("keeps aria-current on the active module and off the rest", () => {
    render(
      <DesktopSidebar activeTab="dashboard" onTabChange={noop} footer={null} />,
    );

    const modules = screen.getByRole("region", { name: "nav.navigation" });
    expect(
      within(modules).getByRole("button", { name: "nav.dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(modules).getByRole("button", { name: "nav.pricing" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps the tablet strip icon-only, with the group label only for AT", () => {
    const { container } = render(
      <TabletSidebar activeTab="calculator" onTabChange={noop} />,
    );

    const aside = container.querySelector("aside")!;
    // Width is pinned by layout; the label cannot become visible text here.
    expect(aside.className).toContain("w-16");
    expect(aside.textContent).not.toContain("Nav");

    // A-2: the tablet now goes through SidebarGroup with labelVisible={false},
    // so this is the real group region and it is still a labelled landmark.
    const group = within(aside).getByRole("region", { name: "nav.navigation" });
    expect(within(group).getByText("nav.navigation")).toHaveClass("sr-only");
    expect(
      within(group).getByRole("button", { name: "nav.pricing" }),
    ).toBeInTheDocument();
  });

  it("exercises the labelVisible=false path without leaking a wrapper box", () => {
    const { container } = render(
      <TabletSidebar activeTab="calculator" onTabChange={noop} />,
    );

    // "contents" keeps the strip a flat flex column: an extra block wrapper
    // would insert a gap between the buttons.
    const group = container.querySelector("section")!;
    expect(group.className).toBe("contents");
  });

  it("keeps the visible label on the desktop group", () => {
    render(
      <DesktopSidebar
        activeTab="calculator"
        onTabChange={noop}
        footer={null}
      />,
    );

    // The sr-only fallback is the tablet's path; desktop must show the text.
    const modules = screen.getByRole("region", { name: "nav.navigation" });
    expect(within(modules).getByText("nav.navigation")).toHaveClass("label-xs");
  });

  it("no longer ships the hardcoded tablet 'Nav' literal", () => {
    const { container } = render(
      <TabletSidebar activeTab="calculator" onTabChange={noop} />,
    );
    expect(container.textContent).not.toMatch(/>Nav</);
  });
});
