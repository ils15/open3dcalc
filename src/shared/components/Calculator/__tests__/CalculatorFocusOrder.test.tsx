import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Calculator } from "../Calculator";
import { useLayoutStore } from "@/shared/stores/layoutStore";

const shortcutRegistry = vi.hoisted(
  () =>
    ({
      current: [] as Array<{
        key: string;
        ctrl?: boolean;
        handler: () => void;
      }>,
    }) as {
      current: Array<{ key: string; ctrl?: boolean; handler: () => void }>;
    },
);
const calculatorActions = vi.hoisted(() => ({
  setSelectedPrinter: vi.fn(),
}));
const interactionHarness = vi.hoisted(() => ({
  enabled: false,
  undo: undefined as (() => void) | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T,>(selector: (state: T) => T) => selector,
}));

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: (
    selector?: (state: Record<string, unknown>) => unknown,
  ) => {
    const state = {
      activeTab: "fdm",
      undo: () => interactionHarness.undo?.(),
      setSelectedPrinter: calculatorActions.setSelectedPrinter,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/shared/stores/catalogStore", () => ({
  useCatalogStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      printers: [{ id: "test-printer" }],
      materials: [],
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/shared/stores/filamentInventory", () => ({
  useFilamentInventory: (
    selector?: (state: Record<string, unknown>) => unknown,
  ) => {
    const state = { spools: [] };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({ symbol: "R$" }),
}));

vi.mock("@/shared/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: (
    shortcuts: Array<{ key: string; ctrl?: boolean; handler: () => void }>,
  ) => {
    shortcutRegistry.current = shortcuts;
  },
}));

vi.mock("@/shared/components/ui/Toast", () => ({
  ToastContainer: ({
    items,
    onDismiss,
  }: {
    items: Array<{ id: number; message: string }>;
    onDismiss: (id: number) => void;
  }) => (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-label={`Dismiss ${item.message}`}
          onClick={() => onDismiss(item.id)}
        >
          {item.message}
        </button>
      ))}
    </>
  ),
}));

vi.mock("@/shared/components/ui/QuickStartBanner", () => ({
  QuickStartBanner: () => null,
}));

vi.mock("@/shared/components/Results/ResultsPanel", async () => {
  const React = await import("react");

  function StatefulResultsPanel({
    variant,
    sidebarTab,
    onExportBlocked,
  }: {
    variant: string;
    sidebarTab?: string;
    onExportBlocked?: (message: string) => void;
  }) {
    const [sellOverride, setSellOverride] = React.useState("42.00");
    const [isEditingPrice, setIsEditingPrice] = React.useState(false);
    const [priceDraft, setPriceDraft] = React.useState("");

    return (
      <div
        data-testid="results-panel-instance"
        data-variant={variant}
        data-sidebar-tab={sidebarTab}
      >
        {interactionHarness.enabled && (
          <button
            type="button"
            data-testid="results-blocked-export"
            onClick={() => onExportBlocked?.("test.export.blocked")}
          >
            Blocked export
          </button>
        )}
        <button type="button" data-testid="sidebar-control">
          Panel action
        </button>
        <label>
          Sell price override
          <input
            aria-label="Sell price override"
            value={sellOverride}
            onChange={(event) => setSellOverride(event.target.value)}
          />
        </label>
        {isEditingPrice ? (
          <label>
            Price draft
            <input
              aria-label="Price draft"
              value={priceDraft}
              onChange={(event) => setPriceDraft(event.target.value)}
            />
          </label>
        ) : (
          <button
            type="button"
            data-testid="edit-price"
            onClick={() => {
              setPriceDraft("42.00");
              setIsEditingPrice(true);
            }}
          >
            Edit price
          </button>
        )}
      </div>
    );
  }

  return { ResultsPanel: StatefulResultsPanel };
});

vi.mock("../TechToggle", () => ({ TechToggle: () => null }));
vi.mock("../LevelToggle", () => ({ LevelToggle: () => null }));
vi.mock("../ProductName", () => ({ ProductName: () => null }));
vi.mock("../SectionNav", () => ({
  SectionNav: () => <button type="button" data-testid="nav-control" />,
}));
vi.mock("../SectionRenderer", async () => {
  const React = await import("react");
  const { ResultsPanel } =
    await import("@/shared/components/Results/ResultsPanel");

  return {
    SectionRenderer: ({
      showInlineResults,
      handleInput,
      handlePrinterSelect,
    }: {
      showInlineResults?: boolean;
      handleInput: (value: string, setter: (value: number) => void) => void;
      handlePrinterSelect: (id: string) => void;
    }) => {
      const [fieldValue, setFieldValue] = React.useState(0);
      const fieldHistory = React.useRef<number[]>([]);
      const setUndoableFieldValue = (value: number): void => {
        fieldHistory.current.push(fieldValue);
        setFieldValue(value);
      };
      interactionHarness.undo = () => {
        const previousValue = fieldHistory.current.pop();
        if (previousValue !== undefined) setFieldValue(previousValue);
      };

      return (
        <>
          {showInlineResults && <ResultsPanel variant="mobile" />}
          <button type="button" data-testid="input-control" />
          {interactionHarness.enabled && (
            <>
              <button
                type="button"
                data-testid="calculator-field-change"
                onClick={() => handleInput("8.25", setUndoableFieldValue)}
              >
                Set numeric value
              </button>
              <button
                type="button"
                data-testid="calculator-field-empty"
                onClick={() => handleInput("", setUndoableFieldValue)}
              >
                Clear numeric value
              </button>
              <button
                type="button"
                data-testid="calculator-select-printer"
                onClick={() => handlePrinterSelect("test-printer")}
              >
                Select printer
              </button>
              <output data-testid="calculator-field-result">
                {fieldValue}
              </output>
            </>
          )}
        </>
      );
    },
  };
});

let availableWidth = 1100;
let resizeObserverCallback: ResizeObserverCallback | null = null;
let resizeObserverTarget: Element | null = null;
const defaultViewportWidth = window.innerWidth;

const mockResizeObserver = (
  measureWidth?: (target: Element) => number,
): void => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObserverCallback = callback;
      }

      observe(target: Element): void {
        resizeObserverTarget = target;
        this.notify(measureWidth?.(target) ?? availableWidth);
      }

      private notify(width: number): void {
        this.callback(
          [
            {
              target: resizeObserverTarget as Element,
              contentRect: { width } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      }

      unobserve(): void {}
      disconnect(): void {}
    },
  );
};

const resizeTo = async (width: number): Promise<void> => {
  availableWidth = width;
  await act(async () => {
    resizeObserverCallback?.(
      [
        {
          target: resizeObserverTarget as Element,
          contentRect: { width } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: defaultViewportWidth,
  });
  resizeObserverCallback = null;
  resizeObserverTarget = null;
  shortcutRegistry.current = [];
  calculatorActions.setSelectedPrinter.mockReset();
  interactionHarness.enabled = false;
  interactionHarness.undo = undefined;
  useLayoutStore.setState({ sidebarMode: "compact" });
});

describe("Calculator layout order and responsive results state", () => {
  it("registers export and print shortcut handlers", () => {
    availableWidth = 1100;
    mockResizeObserver();
    render(<Calculator />);

    expect(
      shortcutRegistry.current.map(({ key, ctrl }) => [key, ctrl]),
    ).toEqual([
      ["z", true],
      ["e", true],
      ["p", true],
    ]);

    const exportAction = vi.fn();
    const exportButton = document.createElement("button");
    exportButton.dataset.shortcut = "export";
    exportButton.addEventListener("click", exportAction);
    document.body.append(exportButton);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const [, exportShortcut, printShortcut] = shortcutRegistry.current;

    exportShortcut.handler();
    printShortcut.handler();

    expect(exportAction).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
    exportButton.remove();
    print.mockRestore();
  });

  it("undoes the last numeric input with the undo shortcut", async () => {
    availableWidth = 900;
    interactionHarness.enabled = true;
    mockResizeObserver();
    const user = userEvent.setup();
    render(<Calculator />);

    await user.click(screen.getByTestId("calculator-field-change"));
    expect(screen.getByTestId("calculator-field-result")).toHaveTextContent(
      "8.25",
    );

    act(() => shortcutRegistry.current[0]?.handler());

    expect(screen.getByTestId("calculator-field-result")).toHaveTextContent(
      "0",
    );
  });

  it("routes field, printer and blocked-export interactions through Calculator", async () => {
    availableWidth = 900;
    interactionHarness.enabled = true;
    mockResizeObserver();
    const user = userEvent.setup();
    render(<Calculator />);

    await user.click(screen.getByTestId("calculator-field-change"));
    expect(screen.getByTestId("calculator-field-result")).toHaveTextContent(
      "8.25",
    );
    await user.click(screen.getByTestId("calculator-field-empty"));
    expect(screen.getByTestId("calculator-field-result")).toHaveTextContent(
      "0",
    );

    await user.click(screen.getByTestId("calculator-select-printer"));
    expect(calculatorActions.setSelectedPrinter).toHaveBeenCalledWith(
      expect.objectContaining({ id: "test-printer" }),
    );

    await user.click(screen.getByTestId("results-blocked-export"));
    const toast = screen.getByRole("button", {
      name: "Dismiss test.export.blocked",
    });
    expect(toast).toBeInTheDocument();
    await user.click(toast);
    expect(
      screen.queryByRole("button", { name: "Dismiss test.export.blocked" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the one results tree and focus order aligned on desktop", async () => {
    availableWidth = 1100;
    mockResizeObserver();
    const user = userEvent.setup();
    render(<Calculator />);

    const layout = screen.getByTestId("calculator-layout");
    expect(layout).toHaveAttribute("data-layout-mode", "three-region");
    const children = Array.from(layout.children);
    expect(children.map((child) => child.getAttribute("data-testid"))).toEqual([
      "calculator-section-nav",
      "results-sidebar",
      "calculator-inputs",
    ]);

    const sidebar = screen.getByTestId("results-sidebar");
    const inputs = screen.getByTestId("calculator-inputs");
    expect(sidebar.className).toContain("calculator-results-sidebar");
    expect(sidebar).toHaveAttribute("id", "section-results");
    expect(sidebar).toHaveAttribute("data-tutorial", "results");
    expect(sidebar.className).toContain("col-start-3 row-start-1");
    expect(sidebar.className).toContain("scroll-mt-24");
    expect(
      layout.querySelector('[data-tutorial="results-sidebar"]'),
    ).toBeInTheDocument();
    expect(inputs.className).toContain("col-start-2");
    expect(layout.className).toContain("calculator-layout--three-region");
    expect(sidebar.className).not.toContain("order-");
    expect(inputs.className).not.toContain("order-");
    expect(screen.getAllByTestId("results-panel-instance")).toHaveLength(1);
    expect(screen.queryByTestId("inline-results")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByTestId("nav-control")).toHaveFocus();
    for (const mode of ["compact", "tabs", "dock", "expanded"]) {
      await user.tab();
      expect(screen.getByTestId(`sidebar-mode-${mode}`)).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByTestId("sidebar-compact-chart")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("sidebar-compact-bars")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("sidebar-control")).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("textbox", { name: "Sell price override" }),
    ).toHaveFocus();
  });

  it("preserves edit state, active tab and focused draft across both width transitions", async () => {
    availableWidth = 900;
    mockResizeObserver();
    const user = userEvent.setup();
    render(<Calculator />);

    const layout = screen.getByTestId("calculator-layout");
    expect(layout).toHaveAttribute("data-layout-mode", "inline-results");
    expect(screen.getAllByTestId("results-panel-instance")).toHaveLength(1);
    expect(screen.getByTestId("results-panel-instance")).toHaveAttribute(
      "data-variant",
      "mobile",
    );

    const override = screen.getByRole("textbox", {
      name: "Sell price override",
    });
    await user.clear(override);
    await user.type(override, "71.30");
    await user.click(screen.getByTestId("edit-price"));
    const draft = screen.getByRole("textbox", { name: "Price draft" });
    await user.clear(draft);
    await user.type(draft, "82.40");
    expect(draft).toHaveFocus();

    await resizeTo(1100);
    expect(layout).toHaveAttribute("data-layout-mode", "three-region");
    expect(screen.getAllByTestId("results-panel-instance")).toHaveLength(1);
    expect(screen.getByTestId("results-panel-instance")).toHaveAttribute(
      "data-variant",
      "sidebar",
    );
    expect(
      screen.getByRole("textbox", { name: "Sell price override" }),
    ).toHaveValue("71.30");
    expect(screen.getByRole("textbox", { name: "Price draft" })).toHaveValue(
      "82.40",
    );
    expect(screen.getByRole("textbox", { name: "Price draft" })).toHaveFocus();

    await user.click(screen.getByTestId("sidebar-mode-tabs"));
    const barsTab = screen.getByRole("tab", { name: "results.sidebar.bars" });
    await user.click(barsTab);
    expect(barsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("results-panel-instance")).toHaveAttribute(
      "data-sidebar-tab",
      "bars",
    );
    screen.getByRole("textbox", { name: "Price draft" }).focus();

    await resizeTo(900);
    expect(layout).toHaveAttribute("data-layout-mode", "inline-results");
    expect(screen.getAllByTestId("results-panel-instance")).toHaveLength(1);
    expect(screen.getByTestId("results-panel-instance")).toHaveAttribute(
      "data-variant",
      "mobile",
    );
    expect(screen.getByTestId("results-panel-instance")).toHaveAttribute(
      "data-sidebar-tab",
      "bars",
    );
    expect(screen.getByRole("textbox", { name: "Price draft" })).toHaveValue(
      "82.40",
    );
    expect(screen.getByRole("textbox", { name: "Price draft" })).toHaveFocus();

    await resizeTo(1100);
    expect(screen.getByTestId("results-panel-instance")).toHaveAttribute(
      "data-sidebar-tab",
      "bars",
    );
    expect(screen.getByRole("textbox", { name: "Price draft" })).toHaveFocus();
  });

  it("uses the full 1440px viewport when the real main column is max-width constrained", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });

    const main = document.createElement("main");
    main.id = "main";
    const mainBounds = {
      x: 240,
      left: 240,
      right: 1166,
      top: 0,
      bottom: 900,
      width: 926,
      height: 900,
      toJSON: () => ({}),
    } as DOMRect;
    vi.spyOn(main, "getBoundingClientRect").mockReturnValue(mainBounds);
    const calculatorContent = document.createElement("div");
    main.append(calculatorContent);
    document.body.append(main);

    const mainPadding = 40;
    const parentContentWidth = mainBounds.width - mainPadding * 2;
    const viewportContentWidth =
      window.innerWidth - (mainBounds.left + mainPadding) - mainPadding;
    const expectedMeasuredWidth = Math.max(
      parentContentWidth,
      viewportContentWidth,
    );
    expect(parentContentWidth).toBe(846);
    expect(expectedMeasuredWidth).toBe(1120);

    mockResizeObserver((target) =>
      target.classList.contains("calculator-viewport-measure")
        ? expectedMeasuredWidth
        : parentContentWidth,
    );
    render(<Calculator />, { container: calculatorContent });

    const layout = screen.getByTestId("calculator-layout");
    expect(layout).toHaveAttribute("data-layout-mode", "three-region");
    expect(screen.getByTestId("calculator-measure")).toHaveClass(
      "calculator-viewport-measure",
    );
    expect(screen.getByTestId("results-sidebar").className).toContain(
      "col-start-3 row-start-1",
    );
    expect(
      mainBounds.left + mainPadding + expectedMeasuredWidth,
    ).toBeLessThanOrEqual(window.innerWidth - mainPadding);

    main.remove();
  });

  it.each([
    { width: 1007, mode: "inline-results" },
    { width: 900, mode: "inline-results" },
    { width: 768, mode: "inline-results" },
    { width: 390, mode: "inline-results" },
  ])("keeps results inline at $width effective CSS px", ({ width, mode }) => {
    availableWidth = width;
    mockResizeObserver();
    render(<Calculator />);

    const layout = screen.getByTestId("calculator-layout");
    expect(layout).toHaveAttribute("data-layout-mode", mode);
    expect(screen.getByTestId("results-sidebar").className).toContain(
      "col-start-2 row-start-1",
    );
    expect(screen.getByTestId("results-sidebar").className).toContain(
      "scroll-mt-24",
    );
    expect(screen.getByTestId("calculator-inputs").className).toContain(
      "row-start-2",
    );
    expect(screen.getAllByTestId("results-panel-instance")).toHaveLength(1);
    expect(screen.getByTestId("results-sidebar").className).not.toContain(
      "calculator-results-sidebar",
    );
    expect(screen.queryByTestId("inline-results")).not.toBeInTheDocument();
  });

  it.each([1008, 1040, 1280, 1440])(
    "keeps the rail at %i measured CSS px",
    (width) => {
      availableWidth = width;
      mockResizeObserver();
      render(<Calculator />);

      expect(screen.getByTestId("calculator-layout")).toHaveAttribute(
        "data-layout-mode",
        "three-region",
      );
      expect(screen.getByTestId("results-sidebar")).toBeInTheDocument();
      expect(screen.getAllByTestId("results-panel-instance")).toHaveLength(1);
    },
  );
});
