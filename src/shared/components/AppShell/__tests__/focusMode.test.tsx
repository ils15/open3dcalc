import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { resetManifestForTests } from "@/shared/lib/manifestGate";
import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import manifestFixture from "../../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import type { ManifestDocument } from "@/shared/lib/dataManifest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

// ─── Mock the tab → surface switch; this suite is about the CHROME
vi.mock("@/shared/components/Calculator/surfaces/CalculatorSurface", () => ({
  CalculatorSurface: () => <div data-testid="surface-calculator" />,
}));
vi.mock("@/shared/components/Dashboard/Dashboard", () => ({
  Dashboard: () => <div data-testid="surface-dashboard" />,
}));
vi.mock("@/shared/components/Calculator/HistoryTab/HistoryTab", () => ({
  HistoryTab: () => <div data-testid="surface-history" />,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => <div data-testid="surface-catalog" />,
}));
vi.mock("@/shared/components/SpoolShelf/SpoolShelf", () => ({
  SpoolShelf: () => <div data-testid="surface-inventory" />,
}));
vi.mock("@/shared/components/Calculator/InfillCalculator", () => ({
  InfillCalculator: () => <div data-testid="surface-infill" />,
}));
vi.mock("@/shared/components/Calculator/QuoteSection", () => ({
  QuoteSection: () => <div data-testid="surface-quotes" />,
}));
vi.mock("@/shared/components/Catalog/CustomerTab", () => ({
  CustomerTab: () => <div data-testid="surface-customers" />,
}));
vi.mock("@/shared/components/Catalog/ProductInventory", () => ({
  ProductInventory: () => <div data-testid="surface-products" />,
}));
vi.mock("@/shared/components/Privacy/PrivacyScreen", () => ({
  PrivacyScreen: () => <div data-testid="surface-privacy" />,
}));
vi.mock("@/shared/components/Changelog/ChangelogPage", () => ({
  ChangelogPage: () => <div data-testid="surface-changelog" />,
}));
vi.mock("@/shared/components/Wiki/WikiPage", () => ({
  WikiPage: () => <div data-testid="surface-wiki" />,
}));

import { AppShell } from "@/shared/components/AppShell/AppShell";
import { FocusModeButton } from "@/shared/components/AppShell/FocusModeButton";
import { ManageVisibilityButton } from "@/shared/components/AppShell/ManageVisibilityButton";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import {
  useActiveTab,
  useNavigateToTab,
} from "@/shared/components/AppShell/NavigationContext";
import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";

/**
 * Phase 7o s4 — Focus Mode.
 *
 * Focus Mode is a TEMPORARY distraction-free state, and it is deliberately not
 * a third mechanism next to the two stage 3 already shipped:
 *
 * - It is not Manage Visibility (a persisted preference that edits the nav).
 * - It is not the persisted active destination (which survives a reload).
 *
 * What it is: while it is on, the chrome is gone, the calculator is the only
 * surface, and one always-visible exit is the single way out. The invariants
 * this file protects are the ones that would make the mode a trap — the exit
 * is real, reachable and unconditional; Escape belongs to whatever layer is on
 * top of it; and a reload erases the mode completely.
 */

/** The shell wired the way both platform Apps wire it, plus the entry control. */
function Harness({
  extras,
}: {
  extras?: React.ReactNode;
} = {}): React.ReactElement {
  const activeTab = useActiveTab();
  const navigateToTab = useNavigateToTab();
  return (
    <>
      <FocusModeButton />
      <button type="button" onClick={() => navigateToTab("history")}>
        internal: history
      </button>
      <AppShell
        activeTab={activeTab}
        onTabChange={navigateToTab}
        mainClassName="main-normal"
        mainFocusClassName="main-focus"
      />
      {extras}
    </>
  );
}

function renderHarness(extras?: React.ReactNode): void {
  render(
    <NavigationProvider>
      <Harness extras={extras} />
    </NavigationProvider>,
  );
}

/** Enter the mode the way a user does: click the control. */
function enterFocusMode(): void {
  fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));
}

function exitButton(): HTMLElement {
  return screen.getByRole("button", { name: "focusMode.exit" });
}

beforeEach(() => {
  resetManifestForTests(manifestFixture as ManifestDocument);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.localStorage.clear();
  useNavigationPrefsStore.setState({
    ...defaultNavigationPrefs(),
    focusMode: false,
    focusModeReturnTab: null,
  });
  useTutorialStore.setState({ isActive: false, sessionDismissed: false });
});

afterEach(() => {
  resetManifestForTests(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
  // Net for the fake timers the Escape-ownership block installs, so a future
  // test here that forgets to restore cannot leak them into the rest of the file.
  vi.useRealTimers();
});

describe("focus mode — entering", () => {
  it.each(["history", "dashboard", "catalog", "inventory"] as const)(
    "remembers %s and switches to the calculator",
    (tab) => {
      useNavigationPrefsStore.getState().setActiveTab(tab);
      renderHarness();

      enterFocusMode();

      expect(useNavigationPrefsStore.getState().focusModeReturnTab).toBe(tab);
      expect(useNavigationPrefsStore.getState().activeTab).toBe("calculator");
      expect(screen.getByTestId("surface-calculator")).toBeInTheDocument();
      expect(screen.queryByTestId(`surface-${tab}`)).toBeNull();
    },
  );

  it.each(["wiki", "changelog", "products", "quotes"] as const)(
    "remembers %s, a destination outside the primary bar",
    (tab) => {
      useNavigationPrefsStore.getState().setActiveTab(tab);
      renderHarness();

      enterFocusMode();

      expect(useNavigationPrefsStore.getState().focusModeReturnTab).toBe(tab);
      expect(screen.getByTestId("surface-calculator")).toBeInTheDocument();
    },
  );

  it("hides the primary navigation, the More disclosure and both sidebars", () => {
    const { container } = render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );
    expect(container.querySelectorAll("aside")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "nav.more" })).toHaveLength(2);

    enterFocusMode();

    expect(container.querySelectorAll("aside")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "nav.more" })).toBeNull();
    for (const labelKey of [
      "nav.pricing",
      "nav.dashboard",
      "nav.history",
      "nav.printers",
      "nav.spools",
    ]) {
      expect(
        screen.queryByRole("button", { name: labelKey }),
        labelKey,
      ).toBeNull();
    }
  });

  it("still renders the calculator, the one destination that cannot be configured away", () => {
    for (const tab of [
      "dashboard",
      "history",
      "catalog",
      "inventory",
      "infill",
      "quotes",
      "customers",
      "products",
      "privacy",
    ] as const) {
      useNavigationPrefsStore.getState().setTabVisibility(tab, false);
    }
    renderHarness();

    enterFocusMode();

    expect(screen.getByTestId("surface-calculator")).toBeInTheDocument();
    expect(exitButton()).toBeInTheDocument();
  });

  it("swaps the main padding so the hidden chrome leaves no dead gutter", () => {
    const { container } = render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );
    const main = (): HTMLElement => container.querySelector("main")!;
    expect(main().className).toContain("main-normal");

    enterFocusMode();

    expect(main().className).toContain("main-focus");
    expect(main().className).not.toContain("main-normal");
  });

  it("does not touch the hidden-destination list or the calculator state", () => {
    useNavigationPrefsStore.getState().setTabVisibility("infill", false);
    useCalculatorStore.setState({ history: [], quantity: 7 });
    renderHarness();

    enterFocusMode();

    expect(useNavigationPrefsStore.getState().hiddenTabs).toEqual(["infill"]);
    expect(useCalculatorStore.getState().quantity).toBe(7);
  });
});

describe("focus mode — the exit is always available", () => {
  it("renders a real button with an accessible name and a visible focus ring", () => {
    renderHarness();
    enterFocusMode();

    const exit = exitButton();
    expect(exit.tagName).toBe("BUTTON");
    expect(exit).toHaveAttribute("type", "button");
    expect(exit).toHaveAccessibleName("focusMode.exit");
    expect(exit.className).toContain("focus-visible:ring-2");
  });

  it("does not use aria-pressed — the control is a verb, not a toggle", () => {
    // Same reasoning as the stage-3 visibility dialog: a pressed button whose
    // label is "Exit focus mode" would read as "exiting is on".
    renderHarness();
    enterFocusMode();

    expect(exitButton()).not.toHaveAttribute("aria-pressed");
  });

  it("is keyboard reachable and not inside a focus trap", () => {
    renderHarness();
    enterFocusMode();

    const exit = exitButton();
    exit.focus();
    expect(document.activeElement).toBe(exit);
    expect(exit.closest('[role="dialog"]')).toBeNull();

    // Tab must be able to leave: the mode adds chrome, it never cages it.
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(document, { key: "Tab" });
      expect(exit.closest('[role="dialog"]'), `tab ${i}`).toBeNull();
    }
  });

  it("announces the mode, so entering it is not silent", () => {
    renderHarness();

    enterFocusMode();

    expect(screen.getByRole("status")).toHaveTextContent("focusMode.hint");
  });

  it.each(["history", "dashboard", "products", "wiki"] as const)(
    "leaves the mode and returns to %s",
    (tab) => {
      useNavigationPrefsStore.getState().setActiveTab(tab);
      renderHarness();
      enterFocusMode();

      fireEvent.click(exitButton());

      expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
      expect(screen.getByTestId(`surface-${tab}`)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "focusMode.exit" }),
      ).toBeNull();
    },
  );

  it("brings the navigation back when it leaves", () => {
    const { container } = render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );
    enterFocusMode();

    fireEvent.click(exitButton());

    expect(container.querySelectorAll("aside")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "nav.more" })).toHaveLength(2);
  });

  it("stays on the calculator when the screen it would restore is hidden", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    renderHarness();
    enterFocusMode();
    // Hidden *while* the mode is on. The entry control lives in the chrome
    // Focus Mode hides, so this cannot be done from the settings dialog; the
    // store is the honest way to test the intersection of the two features.
    useNavigationPrefsStore.getState().setTabVisibility("history", false);

    fireEvent.click(exitButton());

    expect(useNavigationPrefsStore.getState().activeTab).toBe("calculator");
    expect(screen.getByTestId("surface-calculator")).toBeInTheDocument();
    expect(screen.queryByTestId("surface-history")).toBeNull();
  });

  it("moves focus to the exit on entry, not into the void", () => {
    // The mirror of the exit-side case below, and it was the missing half: on
    // entry the FOCUSED node — the FocusModeButton — lives inside a Header,
    // SidebarFooter or MobileSettingsSheet that both Apps unmount, so the
    // browser drops focus to <body> and a keyboard user has to rediscover the
    // whole page. Landing on the exit is also the only useful destination:
    // it is the single way out of the mode.
    renderHarness();
    // fireEvent.click does not move focus the way a real click does, so this
    // reproduces what the browser has actually focused at the moment of entry.
    const entry = screen.getByRole("button", { name: "focusMode.enter" });
    entry.focus();
    expect(document.activeElement).toBe(entry);

    fireEvent.click(entry);

    expect(document.activeElement).toBe(exitButton());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("leaves focus alone on a mount that is already in the mode", () => {
    // The entry case must not fire on first render, or every reload that
    // happened to start in the mode would steal focus from the user.
    act(() => {
      useNavigationPrefsStore.getState().enterFocusMode();
    });
    const probe = document.createElement("input");
    document.body.appendChild(probe);

    renderHarness();
    probe.focus();

    expect(document.activeElement).toBe(probe);
    probe.remove();
  });

  it("returns keyboard focus to the content instead of dropping it on the body", () => {
    const { container } = render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );
    enterFocusMode();

    fireEvent.click(exitButton());

    // The exit control unmounts with the mode, so focus has to be given
    // somewhere deliberate — the main landmark the user is returning to.
    expect(container.querySelector("main")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

describe("focus mode — Escape belongs to the topmost layer", () => {
  // The two tutorial tests below drive the REAL store actions, because the
  // whole point is that the store's own `isActive` / `sessionDismissed` decide
  // who owns the key. `finishTutorial` debounces its write by 800ms, and on
  // real timers that callback outlives this file: the afterEach above calls
  // `resetManifestForTests(null)`, which sets the gate's `loadFailed` flag and
  // so short-circuits `ensureLoaded()` before it can re-read the shipped
  // manifest. A late `checkKey` then finds no index and THROWS — from a bare
  // timer callback, with no test asserting anything, so the run fails without
  // a single red test. That is load-dependent (it only surfaced under
  // `--coverage`, where jsdom is re-created once per file), so it is closed
  // deterministically here instead of being left to timing.
  //
  // Fake timers keep the write INSIDE the test. The flush below is the actual
  // guarantee, and the file-level `vi.useRealTimers()` is the net.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Vitest's default `sequence.hooks: "stack"` runs afterEach hooks in
    // reverse registration order, so this inner hook fires BEFORE the
    // file-level one that invalidates the manifest — the debounce is flushed
    // while the manifest injected in beforeEach is still valid. The
    // `finishTutorial` test additionally flushes in its own body and asserts
    // the write landed, so correctness does not rest on that ordering alone.
    act(() => {
      vi.advanceTimersByTime(800);
    });
  });

  it("exits when nothing else owns the key", () => {
    renderHarness();
    enterFocusMode();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(screen.queryByRole("button", { name: "focusMode.exit" })).toBeNull();
  });

  it("yields to a handler that already consumed the key", () => {
    // Anything listening on `document` or on an element below it runs before a
    // `window` listener, so `defaultPrevented` at this point means a deeper
    // layer took the key. Three of the app's own dialogs close this way.
    renderHarness();
    enterFocusMode();
    const consume = (event: KeyboardEvent): void => event.preventDefault();
    document.addEventListener("keydown", consume);

    fireEvent.keyDown(document.body, { key: "Escape", cancelable: true });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    document.removeEventListener("keydown", consume);
  });

  it("does not steal Escape from the Manage Visibility dialog", () => {
    // The stage-3 dialog listens on `document` and stops propagation, so its
    // Escape never even reaches `window`. Driven through the real dialog
    // inside the real enclosing popover, because that is the exact layering
    // the dialog shipped with.
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
    renderHarness(<Host />);
    enterFocusMode();
    fireEvent.click(
      screen.getByRole("button", { name: "settings.manageVisibility" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    // One Escape, one layer: the dialog closed and the mode stayed on.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("host-popover")).toBeInTheDocument();
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    expect(exitButton()).toBeInTheDocument();
  });

  it("does not steal Escape from an open menu", () => {
    renderHarness();
    enterFocusMode();
    // A `role="menu"` portal — the header currency menu is the real one — owns
    // the key even though its own handler is on `window`, where registration
    // order, not layer order, decides who runs first.
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);

    menu.remove();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("does not steal Escape from an open listbox", () => {
    renderHarness();
    enterFocusMode();
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    document.body.appendChild(listbox);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    // Removed by hand: testing-library only cleans up the container it created,
    // and a listbox left behind in <body> would make every later Escape test
    // pass for the wrong reason.
    listbox.remove();
  });

  it("leaves Escape to the tutorial while it is running", () => {
    renderHarness();
    enterFocusMode();
    act(() => {
      useTutorialStore.getState().startTutorial();
    });
    expect(useTutorialStore.getState().isActive).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });

    // The tutorial is still up: it took the key, exactly as outside the mode.
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    expect(useTutorialStore.getState().isActive).toBe(true);

    act(() => {
      useTutorialStore.getState().finishTutorial();
    });

    // The 800ms debounce is flushed HERE, on purpose, and the write is
    // asserted rather than merely allowed to happen: the point is that the
    // persistence path really runs, against the SPEC-01 registered key, while
    // the manifest this file injected is still valid. Leaving it on real
    // timers is what let the callback escape the test and fail CI.
    expect(window.localStorage.getItem("open3dcalc_tutorial_v1")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(
      JSON.parse(
        window.localStorage.getItem("open3dcalc_tutorial_v1") as string,
      ).isCompleted,
    ).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("takes the key back once the tutorial is dismissed for the session", () => {
    // The tutorial's own handler bails on `sessionDismissed`, so Focus Mode
    // must bail on the same flag — otherwise the key belongs to nobody.
    renderHarness();
    enterFocusMode();
    act(() => {
      useTutorialStore.getState().startTutorial();
      useTutorialStore.getState().dismissTutorial();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("does not listen at all while the mode is off", () => {
    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    renderHarness();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().activeTab).toBe("dashboard");
    expect(screen.getAllByRole("button", { name: "nav.more" })).toHaveLength(2);
  });
});

describe("focus mode — a reload ends it", () => {
  it("is pure UI state: a fresh mount with the mode off shows the full chrome", () => {
    // What a remount can prove is that the mode's whole appearance follows the
    // one transient flag and nothing else. It cannot prove the reload itself:
    // the store is a module singleton, so unmounting the tree leaves it
    // standing. That half of the claim — a real reload re-evaluates the module
    // and comes back with the mode off — is proved in
    // navigationPrefsStore.test by re-importing the store after resetModules.
    useNavigationPrefsStore.getState().setActiveTab("history");
    const { unmount } = render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );
    enterFocusMode();
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    unmount();

    act(() => {
      useNavigationPrefsStore.getState().exitFocusMode();
    });
    render(
      <NavigationProvider>
        <Harness />
      </NavigationProvider>,
    );

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(useNavigationPrefsStore.getState().focusModeReturnTab).toBeNull();
    expect(screen.queryByRole("button", { name: "focusMode.exit" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "nav.more" })).toHaveLength(2);
  });

  it("leaves the calculator on disk, which is where the user was looking", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    renderHarness();
    enterFocusMode();

    expect(
      JSON.parse(window.localStorage.getItem("open3dcalc_nav_v1") ?? "{}")
        .activeTab,
    ).toBe("calculator");
  });

  it("adds no key of its own and no second persistence path", () => {
    window.localStorage.clear();
    renderHarness();

    enterFocusMode();
    fireEvent.click(exitButton());

    expect(Object.keys(window.localStorage)).toEqual(["open3dcalc_nav_v1"]);
    const payload = JSON.parse(
      window.localStorage.getItem("open3dcalc_nav_v1") as string,
    );
    expect(Object.keys(payload).sort()).toEqual(["activeTab", "hiddenTabs"]);
  });
});

describe("focus mode — internal navigation still works", () => {
  it("reaches a screen the chrome no longer offers", () => {
    // Focus Mode hides navigation, it does not forbid navigation: the
    // History → Calculator style hops, the tutorial's cross-tab steps and the
    // go-products bridge must behave exactly as they do outside the mode.
    renderHarness();
    enterFocusMode();

    fireEvent.click(screen.getByRole("button", { name: "internal: history" }));

    expect(screen.getByTestId("surface-history")).toBeInTheDocument();
    expect(exitButton()).toBeInTheDocument();
  });

  it("keeps the exit usable after an internal hop", () => {
    useNavigationPrefsStore.getState().setActiveTab("dashboard");
    renderHarness();
    enterFocusMode();
    fireEvent.click(screen.getByRole("button", { name: "internal: history" }));

    fireEvent.click(exitButton());

    // Exit restores the screen the mode was ENTERED from, not wherever an
    // internal flow happened to leave the user.
    expect(screen.getByTestId("surface-dashboard")).toBeInTheDocument();
  });
});

describe("focus mode — the entry control", () => {
  it("is a real button that does not open a dialog", () => {
    renderHarness();

    const entry = screen.getByRole("button", { name: "focusMode.enter" });
    expect(entry.tagName).toBe("BUTTON");
    expect(entry).toHaveAttribute("type", "button");
    expect(entry).toHaveAccessibleName("focusMode.enter");
    expect(entry).not.toHaveAttribute("aria-haspopup");
    expect(entry).not.toHaveAttribute("aria-expanded");
  });

  it("disappears while the mode is on, so there is exactly one exit", () => {
    renderHarness();

    enterFocusMode();

    expect(
      screen.queryByRole("button", { name: "focusMode.enter" }),
    ).toBeNull();
  });

  it("cannot overwrite the remembered screen by being entered twice", () => {
    useNavigationPrefsStore.getState().setActiveTab("history");
    renderHarness();
    enterFocusMode();

    act(() => {
      useNavigationPrefsStore.getState().enterFocusMode();
    });

    expect(useNavigationPrefsStore.getState().focusModeReturnTab).toBe(
      "history",
    );
  });
});
