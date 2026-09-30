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
import { SecondaryNavigation } from "@/platform/web/SecondaryNavigation";

const noop = () => {};

/** Landmarks that expose an accessible name inside the sidebar. */
function namedLandmarks(root: HTMLElement): string[] {
  const selector = "nav,section,aside,main,header,footer,form,[role]";
  return Array.from(root.querySelectorAll(selector))
    .map((el) => el.getAttribute("aria-label"))
    .filter((name): name is string => Boolean(name));
}

describe("sidebar landmark names", () => {
  it("gives every landmark in the sidebar a distinct accessible name", () => {
    // The defect: a modules region and a resources nav both named
    // "nav.navigation", so the landmark list offered two identical entries and
    // neither could be told apart. That is WCAG 2.4.6.
    const { container } = render(
      <DesktopSidebar
        activeTab="calculator"
        onTabChange={noop}
        footer={<SecondaryNavigation onInternalNavigate={noop} desktop />}
      />,
    );

    const aside = container.querySelector("aside")!;
    const names = namedLandmarks(aside);
    const counts = names.reduce<Record<string, number>>((acc, n) => {
      acc[n] = (acc[n] ?? 0) + 1;
      return acc;
    }, {});
    const duplicates = Object.entries(counts).filter(([, n]) => n > 1);

    expect(
      duplicates,
      `landmarks sharing an accessible name inside one <aside>: ${JSON.stringify(duplicates)}`,
    ).toEqual([]);
    expect(names).toContain("nav.navigation");
    expect(names).toContain("nav.resources");
  });

  it("names the resources nav differently from the modules region", () => {
    const { container } = render(
      <DesktopSidebar
        activeTab="calculator"
        onTabChange={noop}
        footer={<SecondaryNavigation onInternalNavigate={noop} desktop />}
      />,
    );

    const aside = container.querySelector("aside")!;
    const region = within(aside).getByRole("region", {
      name: "nav.navigation",
    });
    const resourcesNav = within(aside).getByRole("navigation", {
      name: "nav.resources",
    });

    expect(region).toBeInTheDocument();
    expect(resourcesNav).toBeInTheDocument();
    expect(region.getAttribute("aria-label")).not.toBe(
      resourcesNav.getAttribute("aria-label"),
    );
  });

  it("keeps the resource items reachable by their own names", () => {
    render(<SecondaryNavigation onInternalNavigate={noop} desktop />);

    const nav = screen.getByRole("navigation", { name: "nav.resources" });
    // Renaming the landmark must not leak into the items inside it.
    for (const name of [
      "nav.wiki",
      "nav.changelog",
      "footer.github",
      "footer.telegram",
    ]) {
      expect(
        within(nav).getByRole(
          nav.querySelector(`[aria-label="${name}"]`)?.tagName === "A"
            ? "link"
            : "button",
          { name },
        ),
      ).toBeInTheDocument();
    }
  });

  it("keeps the resources name on the mobile variant too, with its own layout", () => {
    // desktop={false} is the other half of SecondaryNavigation; the landmark
    // name must be the resources one on both, and the item classes differ.
    const { container } = render(
      <SecondaryNavigation onInternalNavigate={noop} />,
    );

    const nav = screen.getByRole("navigation", { name: "nav.resources" });
    expect(nav.className).toContain("pt-3");
    expect(nav.className).not.toContain("mt-auto");
    expect(
      within(nav).getByRole("button", { name: "nav.wiki" }).className,
    ).toContain("min-h-[48px]");
    expect(container.querySelectorAll("nav[aria-label]")).toHaveLength(1);
  });

  it("keeps the tablet strip free of duplicate landmark names", () => {
    const { container } = render(
      <TabletSidebar activeTab="calculator" onTabChange={noop} />,
    );

    const aside = container.querySelector("aside")!;
    const names = namedLandmarks(aside);
    expect(new Set(names).size).toBe(names.length);
  });
});
