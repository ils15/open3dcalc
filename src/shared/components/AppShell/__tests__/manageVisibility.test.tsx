import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { resetManifestForTests } from "@/shared/lib/manifestGate";
import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import manifestFixture from "../../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

import { ManageVisibilityButton } from "../ManageVisibilityButton";
import { NavigationProvider } from "../NavigationProvider";
import { TABS } from "../tabs";
import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";

/**
 * Phase 7o s3 — Settings → Manage Visibility.
 *
 * The dialog is the only place a destination can be hidden, and it must be
 * explicit that hiding is navigation-only: the copy says so, and the tests
 * assert it against the store. Pricing/Calculator is presented as permanently
 * visible with no control at all, rather than a disabled button a keyboard user
 * can still land on.
 */

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
  useNavigationPrefsStore.setState(defaultNavigationPrefs());
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderControl(): void {
  render(
    <NavigationProvider>
      <ManageVisibilityButton />
    </NavigationProvider>,
  );
}

describe("ManageVisibilityButton — opening and closing", () => {
  it("is a real button that reports its expanded state", () => {
    renderControl();

    const trigger = screen.getByRole("button", {
      name: "settings.manageVisibility",
    });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveClass("focus-visible:ring-2");
  });

  it("opens a modal dialog labelled by its own title", () => {
    renderControl();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("settings.visibility.title");
    expect(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("states that hiding never deletes data", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    expect(
      within(screen.getByRole("dialog")).getByText(
        "settings.visibility.description",
      ),
    ).toBeInTheDocument();
  });

  it("closes on the close button", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings.visibility.close" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a backdrop click", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    fireEvent.click(screen.getByTestId("visibility-backdrop"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ManageVisibilityButton — keyboard and focus handling", () => {
  it("moves focus into the dialog when it opens", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
      true,
    );
  });

  it("keeps Tab inside the dialog (focus trap)", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    const dialog = screen.getByRole("dialog");
    // Wrap from the last focusable back to the first.
    for (let i = 0; i < 30; i += 1) {
      fireEvent.keyDown(document, { key: "Tab" });
      expect(dialog.contains(document.activeElement), `tab ${i}`).toBe(true);
    }
  });

  it("returns focus to the trigger when it closes", () => {
    renderControl();
    const trigger = screen.getByRole("button", {
      name: "settings.manageVisibility",
    });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(trigger);
  });

  it("does not let Escape leak to the enclosing popover", () => {
    // The settings sheet / header dropdowns are useDismissablePopover, which
    // listens on `window` — an ancestor of `document`. One Escape must close
    // only the dialog, or the user loses the layer behind it too.
    function Host(): React.ReactElement {
      const { open, toggle, triggerRef, contentRef } =
        useDismissablePopover<HTMLButtonElement>(true);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={toggle}>
            host trigger
          </button>
          {open && (
            <div ref={contentRef} data-testid="host-popover">
              <ManageVisibilityButton />
            </div>
          )}
        </>
      );
    }
    render(
      <NavigationProvider>
        <Host />
      </NavigationProvider>,
    );

    expect(screen.getByTestId("host-popover")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("host-popover")).toBeInTheDocument();
  });
});

describe("ManageVisibilityButton — the destination list", () => {
  it("lists every navigation destination", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    const dialog = screen.getByRole("dialog");
    for (const tab of TABS) {
      expect(
        within(dialog).getByText(tab.labelKey),
        tab.id,
      ).toBeInTheDocument();
    }
  });

  it("offers a Hide control per destination", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    expect(
      screen.getAllByRole("button", { name: "settings.visibility.hide" }),
    ).toHaveLength(TABS.length - 1);
  });

  it("never offers a control for Pricing/Calculator", () => {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );

    const dialog = screen.getByRole("dialog");
    const row = within(dialog)
      .getByText("nav.pricing")
      .closest("li") as HTMLElement;

    expect(
      within(row).getByText("settings.visibility.alwaysVisible"),
    ).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "settings.visibility.hide" }),
    ).toBeNull();
  });
});

describe("ManageVisibilityButton — hiding and showing", () => {
  function openDialog(): HTMLElement {
    renderControl();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );
    return screen.getByRole("dialog");
  }

  it("hides a destination", () => {
    const dialog = openDialog();
    const row = within(dialog).getByText("nav.history").closest("li")!;

    fireEvent.click(
      within(row).getByRole("button", { name: "settings.visibility.hide" }),
    );

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual(["history"]);
  });

  it("swaps the control to Show once hidden", () => {
    const dialog = openDialog();
    const row = within(dialog).getByText("nav.history").closest("li")!;

    fireEvent.click(
      within(row).getByRole("button", { name: "settings.visibility.hide" }),
    );

    expect(
      within(row).getByRole("button", { name: "settings.visibility.show" }),
    ).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "settings.visibility.hide" }),
    ).toBeNull();
  });

  it("shows a hidden destination again", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    const dialog = openDialog();
    const row = within(dialog).getByText("nav.history").closest("li")!;

    fireEvent.click(
      within(row).getByRole("button", { name: "settings.visibility.show" }),
    );

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual([]);
  });

  it("persists the change to the registered key", () => {
    const dialog = openDialog();
    const row = within(dialog).getByText("nav.infill").closest("li")!;

    fireEvent.click(
      within(row).getByRole("button", { name: "settings.visibility.hide" }),
    );

    expect(
      JSON.parse(window.localStorage.getItem("open3dcalc_nav_v1") ?? "{}")
        .hiddenTabs,
    ).toEqual(["infill"]);
  });

  it("restores everything through Show all", () => {
    useNavigationPrefsStore.getState().setTabVisibility("history", false);
    useNavigationPrefsStore.getState().setTabVisibility("infill", false);
    const dialog = openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings.visibility.showAll",
      }),
    );

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual([]);
  });

  it("marks a hidden destination with a state badge, not aria-pressed", () => {
    const dialog = openDialog();
    // Verb buttons name the action, so a pressed "Hide" button would read as
    // "hiding is on" — the state belongs on the row, not the button.
    const row = within(dialog).getByText("nav.history").closest("li")!;
    fireEvent.click(
      within(row).getByRole("button", { name: "settings.visibility.hide" }),
    );

    const hiddenRow = within(dialog)
      .getByText("nav.history")
      .closest("li") as HTMLElement;
    expect(
      within(hiddenRow).getByText("settings.visibility.hidden"),
    ).toBeInTheDocument();
    expect(
      within(hiddenRow)
        .getByRole("button", { name: "settings.visibility.show" })
        .hasAttribute("aria-pressed"),
    ).toBe(false);
  });

  it("shows no state badge while a destination is visible", () => {
    const dialog = openDialog();

    expect(within(dialog).queryByText("settings.visibility.hidden")).toBeNull();
  });

  it("never changes the active destination", () => {
    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    const dialog = openDialog();
    const row = within(dialog).getByText("nav.history").closest("li")!;

    fireEvent.click(
      within(row).getByRole("button", { name: "settings.visibility.hide" }),
    );

    expect(useNavigationPrefsStore.getState().activeTab).toBe("dashboard");
  });

  it("does not touch any user-data key", () => {
    const saved = {
      open3dcalc_settings_v2: '{"activeTab":"fdm","quantity":4}',
      open3dcalc_history_v2: '[{"id":"h1","summary":"Vaso"}]',
      open3dcalc_spool_v1: '[{"id":"s1","brand":"Polymaker"}]',
    };
    for (const [key, value] of Object.entries(saved)) {
      window.localStorage.setItem(key, value);
    }

    const dialog = openDialog();
    for (const labelKey of ["nav.history", "nav.infill", "nav.quotes"]) {
      const row = within(dialog).getByText(labelKey).closest("li")!;
      fireEvent.click(
        within(row).getByRole("button", { name: "settings.visibility.hide" }),
      );
    }

    for (const [key, value] of Object.entries(saved)) {
      expect(window.localStorage.getItem(key), key).toBe(value);
    }
  });
});
