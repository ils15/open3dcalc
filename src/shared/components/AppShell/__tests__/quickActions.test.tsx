import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import { QuickActionsSpeedDial } from "@/shared/components/AppShell/QuickActionsSpeedDial";
import { QuickStatusPill } from "@/shared/components/AppShell/QuickStatusPill";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
// `FilamentSpool` is owned by the spool store (`spoolStore.ts:25`), not by
// `@/shared/types` — it is imported from where it is actually declared rather
// than re-exported into `types/` to satisfy a test.
import { useSpoolStore, type FilamentSpool } from "@/shared/stores/spoolStore";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import type { HistoryEntry } from "@/shared/types";

/**
 * The floating quick-actions dial and the workshop status pill.
 *
 * The prototype (`Example/src/components/QuickActionsSpeedDial.tsx`,
 * `MiniDashOverlay.tsx`) supplies the two-floating-elements SHAPE — a speed dial
 * and a separate status pill, not one toolbar — and nothing else worth copying.
 * Its accessibility is strictly worse than the app's: the trigger carries only a
 * `title` (no `aria-expanded`, `aria-haspopup`, `aria-controls` or `role`), the
 * items are `div`s with `onClick`, so they are unreachable by keyboard, and
 * Escape/outside-click close the menu WITHOUT returning focus to the trigger.
 *
 * Every case below pins the app's own precedent instead —
 * `useDismissablePopover` (Escape closes AND returns focus), and the
 * `ManageVisibilityButton` dialog (`role="dialog"`, `aria-modal`, focus in on
 * open, Tab contained, focus back to the trigger on close).
 *
 * On `aria-haspopup`: each control declares the popup it ACTUALLY opens. The
 * trigger opens a `role="menu"`, so it says `menu`; the one item that opens the
 * modal says `dialog`; the three that navigate declare nothing. The desktop
 * suite's "every dialog trigger is Manage Visibility" loop was too specific to
 * survive a second dialog trigger and became a naming invariant instead.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const resetCalculator = vi.fn();
const exportPdfSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useNavigationPrefsStore.setState({
    activeTab: "calculator",
    focusMode: false,
    focusModeReturnTab: null,
    hiddenTabs: [],
  } as never);
  useCalculatorStore.setState({
    results: null,
    resetCalculator,
  } as never);
  useHistoryStore.setState({ entries: [] } as never);
  useSpoolStore.setState({ spools: [] } as never);
  void exportPdfSpy;
});

function renderDial(): void {
  render(
    <NavigationProvider>
      <QuickActionsSpeedDial />
    </NavigationProvider>,
  );
}

function renderPill(): void {
  render(
    <NavigationProvider>
      <QuickStatusPill />
    </NavigationProvider>,
  );
}

/**
 * Queried by the popup contract rather than by name: the trigger deliberately
 * renames itself between "open" and "close" (as the prototype does), so a
 * name-based query would not survive an open menu.
 */
const trigger = (): HTMLElement => {
  const el = document.querySelector<HTMLButtonElement>(
    'button[aria-haspopup="menu"]',
  );
  if (!el) throw new Error("dial trigger not found");
  return el;
};

const openDial = (): void => {
  fireEvent.click(trigger());
};

/** A minimal but well-formed spool; only status/weightGrams drive the rule. */
function spool(id: string, weightGrams: number): FilamentSpool {
  return {
    id,
    material: "PLA",
    brand: "Teste",
    color: "Preto",
    weightGrams,
    originalWeightGrams: 1000,
    spoolPrice: 50,
    dateAdded: 0,
    notes: "",
    status: "in_stock",
    purchaseStore: "",
  } as unknown as FilamentSpool;
}

function historyEntry(id: string, sellPrice: number): HistoryEntry {
  return {
    id,
    timestamp: 0,
    type: "fdm",
    name: `Produto ${id}`,
    summary: "",
    totalCost: sellPrice / 2,
    sellPrice,
    profit: sellPrice / 2,
    result: {} as HistoryEntry["result"],
    snapshot: null,
  };
}

// ─── the dial ────────────────────────────────────────────────────────────

describe("QuickActionsSpeedDial — opening and closing", () => {
  it("starts closed", () => {
    renderDial();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "quickActions.open" })).toBe(
      trigger(),
    );
  });

  it("opens on the trigger and closes on a second activation", () => {
    renderDial();

    openDial();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("flips aria-expanded in step with the menu", () => {
    renderDial();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    openDial();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  /**
   * The case the prototype fails: it closes on Escape but leaves focus on
   * <body>, so a keyboard user who opened the menu cannot get back to the
   * control that opened it. This is the assertion that proves the app's
   * `useDismissablePopover` behaviour is actually wired up.
   */
  it("returns focus to the trigger when Escape closes the menu", () => {
    renderDial();
    openDial();

    const item = screen.getByRole("menuitem", {
      name: "quickActions.newProject",
    });
    item.focus();
    expect(document.activeElement).toBe(item);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes when the pointer lands outside it", () => {
    renderDial();
    openDial();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("stays open when the pointer lands inside it", () => {
    renderDial();
    openDial();

    fireEvent.mouseDown(screen.getByRole("menu"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

describe("QuickActionsSpeedDial — semantics", () => {
  it("declares a menu on the trigger, because a menu is what it opens", () => {
    renderDial();

    // `menu`, not `dialog`: the popup is a `role="menu"` of `role="menuitem"`s.
    // The WAI-ARIA menu-button pattern. Claiming `dialog` here would be a new
    // lie of exactly the kind the prototype already tells (its items are `div`s
    // with `onClick`) — the popup type has to describe what actually opens.
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).not.toHaveAttribute("aria-haspopup", "dialog");
  });

  it("declares a dialog on the one item that opens one", () => {
    renderDial();
    openDial();

    // The shortcuts item opens a MODAL, so that is what it advertises. The
    // other three navigate and must not claim to open anything.
    expect(
      screen.getByRole("menuitem", { name: "quickActions.shortcuts" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
    for (const name of [
      "quickActions.newProject",
      "quickActions.quote",
      "quickActions.inventory",
    ]) {
      expect(screen.getByRole("menuitem", { name }), name).not.toHaveAttribute(
        "aria-haspopup",
      );
    }
  });

  it("points aria-controls at the menu it owns", () => {
    renderDial();

    const controls = trigger().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    openDial();
    expect(document.getElementById(controls as string)).toBe(
      screen.getByRole("menu"),
    );
  });

  it("exposes real buttons, not divs with onClick", () => {
    renderDial();
    openDial();

    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.tagName.toLowerCase()).toBe("button");
      expect(item).not.toBeEmptyDOMElement();
    }
  });

  it("gives every item an accessible name", () => {
    renderDial();
    openDial();

    expect(
      within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((i) => i.getAttribute("aria-label") ?? i.textContent),
    ).not.toContain("");
  });

  it("moves focus between items with the arrow keys", () => {
    renderDial();
    openDial();

    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    items[0].focus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("runs an action from the keyboard and closes the menu", async () => {
    renderDial();
    openDial();

    const item = screen.getByRole("menuitem", {
      name: "quickActions.newProject",
    });
    item.focus();
    // user-event, not `fireEvent.keyDown`: Enter-on-a-button is a *browser*
    // default action, and jsdom does not synthesize the click that follows it.
    // `fireEvent.keyDown` therefore proved nothing about the app — the menu
    // stayed open because no click was ever dispatched, not because the item
    // ignored the key. user-event models the activation the browser performs.
    await userEvent.keyboard("{Enter}");

    expect(resetCalculator).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("QuickActionsSpeedDial — the four actions", () => {
  it("resets the calculator for a new project", () => {
    renderDial();
    openDial();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "quickActions.newProject" }),
    );

    expect(resetCalculator).toHaveBeenCalledTimes(1);
    expect(useNavigationPrefsStore.getState().activeTab).toBe("calculator");
  });

  it("routes the quote action to the QuoteSection surface", () => {
    renderDial();
    openDial();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "quickActions.quote" }),
    );

    expect(useNavigationPrefsStore.getState().activeTab).toBe("quotes");
  });

  it("routes the stock action to the SpoolShelf surface", () => {
    renderDial();
    openDial();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "quickActions.inventory" }),
    );

    expect(useNavigationPrefsStore.getState().activeTab).toBe("inventory");
  });

  it("opens the keyboard shortcuts dialog", () => {
    renderDial();
    openDial();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "quickActions.shortcuts" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  /**
   * Omitted by owner decision, so asserted ABSENT: a disabled entry is still a
   * Tab stop, and a stop the user can never act on is worse than no item.
   */
  it.each([
    ["quickActions.fleet", "fleet of machines"],
    ["quickActions.copilot", "AI assistant"],
    ["quickActions.simplified", "simplified mode"],
  ])("omits %s (%s) rather than shipping a dead entry", (key) => {
    renderDial();
    openDial();

    expect(screen.queryByRole("menuitem", { name: key })).toBeNull();
    expect(
      within(screen.getByRole("menu")).getAllByRole("menuitem"),
    ).toHaveLength(4);
  });
});

// ─── the shortcuts dialog ────────────────────────────────────────────────

describe("keyboard shortcuts dialog", () => {
  function openShortcuts(): HTMLElement {
    renderDial();
    openDial();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "quickActions.shortcuts" }),
    );
    return screen.getByRole("dialog");
  }

  it("is a modal dialog with a name", () => {
    const dialog = openShortcuts();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName();
  });

  it("moves focus into the dialog when it opens", () => {
    const dialog = openShortcuts();

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  /**
   * The trap, modelled on manageVisibility.test.tsx:144. Tab wraps from the last
   * focusable back to the first and never escapes the dialog.
   */
  it("keeps Tab inside the dialog", () => {
    const dialog = openShortcuts();

    for (let i = 0; i < 30; i += 1) {
      fireEvent.keyDown(document, { key: "Tab" });
      expect(dialog.contains(document.activeElement), `tab ${i}`).toBe(true);
    }
  });

  it("returns focus to the trigger when Escape closes it", () => {
    // `trigger()` cannot be read before the first render: the FAB does not exist
    // until the dial is mounted. The reference is captured AFTER the dialog is
    // open, which is the same node the dialog's returnFocusRef points at.
    openShortcuts();
    const fab = trigger();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(fab);
  });

  it("lists the shortcuts the app actually registers", () => {
    openShortcuts();

    const list = screen.getByTestId("shortcut-list");
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(list.textContent).toContain("Ctrl+Z");
  });
});

// ─── locale parity ───────────────────────────────────────────────────────

/**
 * Only `tutorial.launcher` has an automatic lock elsewhere, so a key that
 * exists in pt-BR and not in en-US renders as the raw key ("quickActions.open")
 * for every en-US user and breaks nothing. Parity is asserted here instead:
 * EXACT key-set equality in both directions, and no blank value.
 */
describe("quickActions.* locale parity", () => {
  it("has the same key set in pt-BR and en-US", () => {
    expect(Object.keys(ptBR.quickActions).sort()).toEqual(
      Object.keys(enUS.quickActions).sort(),
    );
  });

  it.each([
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ])("has no blank value in %s", (_locale, dict) => {
    for (const [key, value] of Object.entries(dict.quickActions)) {
      expect(typeof value, `quickActions.${key}`).toBe("string");
      expect((value as string).trim(), `quickActions.${key}`).not.toBe("");
    }
  });

  it("keeps the three action labels distinct from the trigger labels", () => {
    // "Novo Projeto" appearing as both the FAB label and the item label would
    // make the two controls indistinguishable to a screen-reader user.
    for (const dict of [ptBR, enUS]) {
      expect(dict.quickActions.newProject).not.toBe(dict.quickActions.open);
      expect(dict.quickActions.shortcutsTitle).not.toBe(
        dict.quickActions.shortcuts,
      );
    }
  });
});

// ─── the status pill ─────────────────────────────────────────────────────

describe("QuickStatusPill", () => {
  const segments = (): HTMLElement[] => screen.getAllByTestId(/^pill-segment-/);

  it("shows three segments once there is something to report", () => {
    useCalculatorStore.setState({ results: {} } as never);
    renderPill();

    expect(segments()).toHaveLength(3);
  });

  it("hides itself with no result and no history", () => {
    renderPill();

    expect(screen.queryByTestId("quick-status-pill")).toBeNull();
  });

  it("appears for a calculated result even with empty history", () => {
    useCalculatorStore.setState({ results: {} } as never);
    renderPill();

    expect(screen.getByTestId("quick-status-pill")).toBeInTheDocument();
  });

  it("appears for history alone, with no calculated result", () => {
    useHistoryStore.setState({
      entries: [historyEntry("a", 100)],
    } as never);
    renderPill();

    expect(screen.getByTestId("quick-status-pill")).toBeInTheDocument();
  });

  it("sums sellPrice across history for the revenue segment", () => {
    useCalculatorStore.setState({ results: {} } as never);
    useHistoryStore.setState({
      entries: [historyEntry("a", 100), historyEntry("b", 250.5)],
    } as never);
    renderPill();

    const revenue = screen.getByTestId("pill-segment-revenue");
    // 350.50 in the app's resolved currency, never the INVALID_CURRENCY_MARKER.
    expect(revenue.textContent).not.toContain("—");
    expect(revenue.textContent).toMatch(/350/);
  });

  it("never renders the empty-value marker in the revenue segment", () => {
    useCalculatorStore.setState({ results: {} } as never);
    renderPill();

    expect(
      screen.getByTestId("pill-segment-revenue").textContent,
    ).not.toContain("—");
  });

  /**
   * The prototype filters at 250g (`MiniDashOverlay.tsx:124`); the app filters at
   * 100g (`FilamentInventory.tsx:396`). Two different numbers for "low filament"
   * on one screen is worse than either, so the app's 100g wins here.
   */
  it("counts low spools at the app's 100g threshold, not the prototype's 250g", () => {
    useCalculatorStore.setState({ results: {} } as never);
    useSpoolStore.setState({
      spools: [
        spool("low-99", 99),
        spool("edge-100", 100),
        spool("mid-200", 200),
        spool("full-1000", 1000),
      ],
    } as never);
    renderPill();

    // Only sub-100g counts: `isLowStockSpool` is a strict `<`.
    expect(screen.getByTestId("pill-segment-lowstock").textContent).toContain(
      "1",
    );
  });

  it("reports no low spools when the shelf is healthy", () => {
    useCalculatorStore.setState({ results: {} } as never);
    useSpoolStore.setState({
      spools: [spool("full-1000", 1000), spool("mid-200", 200)],
    } as never);
    renderPill();

    expect(screen.getByTestId("pill-segment-lowstock").textContent).toContain(
      "0",
    );
  });

  it("enters Focus Mode from its segment", () => {
    useCalculatorStore.setState({ results: {} } as never);
    renderPill();

    fireEvent.click(screen.getByTestId("pill-segment-focus"));

    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
  });

  it("labels itself as a status region", () => {
    useCalculatorStore.setState({ results: {} } as never);
    renderPill();

    expect(screen.getByTestId("quick-status-pill")).toHaveAccessibleName();
  });
});
