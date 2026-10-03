import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * Who owns the web App's destination — after the Studio layout refactor (#260).
 *
 * The old spec here asserted that the web App hands its destination to the
 * shared `AppShell` and that the transition travels through the shared
 * navigation store. Refactor #260 deleted `AppShell` from the web tree —
 * `App.tsx` renders `StudioLayout` alone, which owns `activeTab` in its own
 * `useState`. There is no shared owner to hand anything to any more, so the
 * previous assertions were testing a contract that no longer exists.
 *
 * What is worth keeping is the user-visible guarantee behind the old name:
 * the App opens on the calculator, and every navigation affordance in the
 * Studio chrome actually moves the workspace. So this spec drives the REAL
 * `StudioSidebar` / `StudioSubHeader` / `StudioHeader` (they are
 * presentational — props in, events out) and stubs the other destination
 * views so the assertion stays about routing. The calculator itself is
 * deliberately left real: it is the default destination, so stubbing it would
 * take the whole calculator subtree out of the suite's reach for nothing.
 * The stub pattern mirrors `StudioLayout.exportGuard.test.tsx`, the sibling
 * suite for the same component.
 *
 * The destination swap goes through `AnimatePresence mode="wait"`, so it lands
 * a frame after the click: every post-navigation assertion is awaited.
 */

vi.mock("@/shared/hooks/useAppInit", () => ({ useAppInit: vi.fn() }));
vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("./components/studio/StudioDashboardView", () => ({
  StudioDashboardView: () => <div data-testid="view-dashboard" />,
}));
vi.mock("./components/studio/StudioSpoolView", () => ({
  StudioSpoolView: () => <div data-testid="view-inventory" />,
}));
vi.mock("./components/studio/StudioHistoryView", () => ({
  StudioHistoryView: () => <div data-testid="view-history" />,
}));
vi.mock("./components/studio/StudioCustomerView", () => ({
  StudioCustomerView: () => <div data-testid="view-customers" />,
}));
vi.mock("./components/studio/StudioQuotesView", () => ({
  StudioQuotesView: () => <div data-testid="view-quotes" />,
}));
vi.mock("./components/studio/StudioProductsView", () => ({
  StudioProductsView: () => <div data-testid="view-products" />,
}));
vi.mock("./components/studio/StudioMiniDashOverlay", () => ({
  StudioMiniDashOverlay: () => null,
}));
vi.mock("./components/studio/StudioCopilotModal", () => ({
  StudioCopilotModal: () => null,
}));
vi.mock("./components/studio/StudioShortcutsModal", () => ({
  StudioShortcutsModal: () => null,
}));
vi.mock("./components/studio/StudioQuoteModal", () => ({
  StudioQuoteModal: () => null,
}));
// Infill, Catalog, Wiki, Changelog, Privacy, Bento and Guided are reachable
// only by navigating to them, so they never render from the calculator. They
// are deliberately left unmocked: stubbing them would buy nothing and would
// take their module initialisation out of this suite's reach.
vi.mock("@/shared/components/DemoMode/DemoModeIndicator", () => ({
  DemoModeIndicator: () => null,
}));
vi.mock("@/shared/components/DemoMode/DemoExportBlockedToast", () => ({
  DemoExportBlockedToast: () => null,
}));
vi.mock("@/shared/components/Privacy/PrivacyOnboarding", () => ({
  PrivacyOnboarding: () => null,
}));
vi.mock("@/shared/components/Privacy/LegacyMigrationPrompt", () => ({
  LegacyMigrationPrompt: () => null,
}));
vi.mock("@/shared/components/Privacy/PiiLockedShell", () => ({
  PiiLockedShell: () => null,
}));

import App from "./App";

/** The two Studio rails, scoped so their shared labels cannot collide. */
interface Rails {
  sidebar: HTMLElement;
  subHeader: HTMLElement;
}

function rails(container: HTMLElement): Rails {
  const header = container.querySelector("header");
  const subHeader = header?.nextElementSibling;
  const sidebar = container.querySelector("aside");
  if (!header || !(subHeader instanceof HTMLElement) || !sidebar) {
    throw new Error("Studio chrome did not render a header, sub-header and sidebar");
  }
  return { sidebar, subHeader };
}

/**
 * Which destination the workspace is showing.
 *
 * Every destination except the calculator is stubbed above and announces
 * itself with a `view-*` test id. The calculator renders for real, so it is
 * identified by the `StudioHeader` breadcrumb — the signal a user actually
 * reads to know where they are.
 */
function currentView(): string | null {
  const views = screen
    .queryAllByTestId(/^view-/)
    .map((el) => el.getAttribute("data-testid"));
  if (views.length === 1) return views[0];
  if (views.length > 1) return views.join("+");
  return screen.queryByText("Calculadora 3D") ? "calculator" : null;
}

describe("web App navigation owner", () => {
  it("opens on the calculator", () => {
    render(<App />);

    expect(currentView()).toBe("calculator");
  });

  it("moves the workspace when a sidebar module is picked", async () => {
    render(<App />);

    fireEvent.click(screen.getByTitle("Histórico"));

    expect(await screen.findByTestId("view-history")).toBeInTheDocument();
    expect(currentView()).toBe("view-history");
  });

  it("moves the workspace when a sub-header tab is picked", async () => {
    const { container } = render(<App />);

    // The sub-header is the horizontal twin of the sidebar; it must reach the
    // same owner, otherwise the two rails would disagree about where the
    // workspace is. Scoped because both rails carry the same labels.
    fireEvent.click(
      within(rails(container).subHeader).getByRole("button", {
        name: "Orçamentos",
      }),
    );

    expect(await screen.findByTestId("view-quotes")).toBeInTheDocument();
  });

  it("keeps the sidebar and the sub-header in sync on the same destination", async () => {
    const { container } = render(<App />);
    const { sidebar, subHeader } = rails(container);

    fireEvent.click(within(sidebar).getByTitle("Clientes"));
    expect(await screen.findByTestId("view-customers")).toBeInTheDocument();

    // Both rails now mark Clientes as current…
    expect(within(sidebar).getByTitle("Clientes").className).toContain(
      "bg-blue-600/20",
    );
    expect(
      within(subHeader).getByRole("button", { name: "Clientes" }).className,
    ).toContain("bg-[#18233c]");
    // …and both released the calculator, so the highlight is not duplicated.
    expect(within(sidebar).getByTitle("Calculadora").className).not.toContain(
      "bg-blue-600/20",
    );
    expect(
      within(subHeader).getByRole("button", { name: "Calculadora" }).className,
    ).not.toContain("bg-[#18233c]");
  });

  it("switches destination from the keyboard shortcuts", async () => {
    render(<App />);

    // StudioLayout binds 1–4 to the four workshop destinations. Each is read
    // back off the `StudioHeader` breadcrumb, the same label a user follows.
    fireEvent.keyDown(window, { key: "3" });
    expect(await screen.findByText("Frota de Impressoras")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "4" });
    expect(await screen.findByText("Estoque de Carretéis")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "2" });
    expect(await screen.findByText("Dashboard Geral")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "1" });
    expect(await screen.findByText("Calculadora 3D")).toBeInTheDocument();
    expect(currentView()).toBe("calculator");
  });

  it("ignores shortcuts typed into a field", async () => {
    render(<App />);

    fireEvent.click(screen.getByTitle("Histórico"));
    expect(await screen.findByTestId("view-history")).toBeInTheDocument();

    const input: ReactElement = <input aria-label="cena" />;
    const { container } = render(input);
    fireEvent.keyDown(
      container.querySelector("input") as HTMLInputElement,
      { key: "1" },
    );

    expect(currentView()).toBe("view-history");
  });
});