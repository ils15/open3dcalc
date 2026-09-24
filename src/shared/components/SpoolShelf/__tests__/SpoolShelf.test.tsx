import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpoolShelf } from "../SpoolShelf";
import {
  useSpoolStore,
  type FilamentSpool,
  type SpoolStatus,
} from "@/shared/stores/spoolStore";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", resolvedLanguage: "pt-BR" },
  }),
}));

vi.mock("@/shared/hooks/useReducedMotion", () => ({
  useReducedMotion: () => motionPreference.reduced,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  type MotionDivProps = HTMLAttributes<HTMLDivElement> & {
    initial?: unknown;
    transition?: { duration?: number };
  };

  const MotionDiv = React.forwardRef<HTMLDivElement, MotionDivProps>(
    ({ children, initial, transition, ...props }, ref) => (
      <div
        ref={ref}
        data-motion-duration={transition?.duration}
        data-motion-initial={JSON.stringify(initial)}
        {...props}
      >
        {children}
      </div>
    ),
  );
  MotionDiv.displayName = "MotionDiv";

  return {
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

function makeSpool(overrides: Partial<FilamentSpool> = {}): FilamentSpool {
  return {
    id: "spool-1",
    brand: "Prusament",
    material: "PLA",
    color: "Red",
    colorHex: "#ef4444",
    weightGrams: 1000,
    originalWeightGrams: 1000,
    costPerKg: 120,
    diameterMm: 1.75,
    notes: "",
    status: "in_stock",
    purchaseStore: "Loja",
    dateAdded: 1_700_000_000_000,
    ...overrides,
  };
}

function setSpools(spools: FilamentSpool[]): void {
  useSpoolStore.setState({ spools });
}

async function openForm() {
  await user.click(screen.getByRole("button", { name: "spools.newSpool" }));
  return screen.getByRole("dialog", { name: "spools.newSpool" });
}

async function fillRequiredFields(
  dialog: HTMLElement,
  values: { brand: string; color: string; weight: string; original: string },
) {
  fireEvent.change(within(dialog).getByLabelText("spools.form.brand"), {
    target: { value: values.brand },
  });
  fireEvent.change(within(dialog).getByLabelText("spools.form.color"), {
    target: { value: values.color },
  });
  fireEvent.change(within(dialog).getByLabelText("spools.form.weight"), {
    target: { value: values.weight },
  });
  fireEvent.change(
    within(dialog).getByLabelText("spools.form.originalWeight"),
    { target: { value: values.original } },
  );
}

let user: ReturnType<typeof userEvent.setup>;

describe("SpoolShelf", () => {
  beforeEach(() => {
    user = userEvent.setup();
    motionPreference.reduced = false;
    setSpools([]);
  });

  it("adds a spool through the form", async () => {
    render(<SpoolShelf />);

    const dialog = await openForm();
    await fillRequiredFields(dialog, {
      brand: "Polymaker",
      color: "Blue",
      weight: "750",
      original: "1000",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "spools.form.save" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "spools.newSpool" }),
    ).not.toBeInTheDocument();
    expect(useSpoolStore.getState().spools).toHaveLength(1);
    expect(useSpoolStore.getState().spools[0]).toMatchObject({
      brand: "Polymaker",
      color: "Blue",
      weightGrams: 750,
      originalWeightGrams: 1000,
    });
  });

  it("edits an existing spool", async () => {
    setSpools([makeSpool()]);
    render(<SpoolShelf />);

    await user.click(screen.getByRole("button", { name: "spools.editSpool" }));
    const dialog = screen.getByRole("dialog", { name: "spools.editSpool" });
    fireEvent.change(within(dialog).getByLabelText("spools.form.brand"), {
      target: { value: "Polymaker" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "spools.form.save" }),
    );

    expect(useSpoolStore.getState().spools[0]?.brand).toBe("Polymaker");
  });

  it("removes a spool only after confirmation", async () => {
    setSpools([makeSpool()]);
    render(<SpoolShelf />);

    await user.click(screen.getByRole("button", { name: "spools.removeSpool" }));
    await user.click(
      screen.getByRole("button", { name: "spools.deleteConfirm" }),
    );

    expect(useSpoolStore.getState().spools).toHaveLength(0);
  });

  it("searches spools by visible text", async () => {
    setSpools([
      makeSpool({ id: "pla", brand: "Prusament", color: "Red" }),
      makeSpool({ id: "petg", brand: "Polymaker", color: "Blue", material: "PETG" }),
    ]);
    render(<SpoolShelf />);

    await user.type(
      screen.getByRole("searchbox", { name: "spools.searchPlaceholder" }),
      "Polymaker",
    );

    expect(screen.getByRole("article", { name: "Blue" })).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "Red" }),
    ).not.toBeInTheDocument();
  });

  it("filters spools by material", async () => {
    setSpools([
      makeSpool({ id: "pla", color: "Red", material: "PLA" }),
      makeSpool({
        id: "petg",
        brand: "Other",
        color: "Blue",
        material: "PETG",
      }),
    ]);
    render(<SpoolShelf />);

    await user.click(screen.getByRole("button", { name: "PETG" }));

    expect(screen.getByRole("article", { name: "Blue" })).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "Red" }),
    ).not.toBeInTheDocument();
  });

  it("filters spools by status", async () => {
    const onTheWay: SpoolStatus = "on_the_way";
    setSpools([
      makeSpool({ id: "stock", color: "Red", status: "in_stock" }),
      makeSpool({
        id: "way",
        brand: "Travel",
        color: "Blue",
        status: onTheWay,
      }),
    ]);
    render(<SpoolShelf />);

    await user.click(
      screen.getByRole("button", { name: "spools.statusOnTheWay" }),
    );

    expect(screen.getByRole("article", { name: "Blue" })).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "Red" }),
    ).not.toBeInTheDocument();
  });

  it("sorts by the selected field and toggles direction", async () => {
    setSpools([
      makeSpool({ id: "old", brand: "Zulu", dateAdded: 100 }),
      makeSpool({ id: "new", brand: "Alpha", dateAdded: 200 }),
    ]);
    render(<SpoolShelf />);
    const list = screen.getByRole("list", { name: "spools.title" });
    const names = () =>
      within(list)
        .getAllByRole("article")
        .map((card) => card.textContent ?? "");

    expect(names()[0]).toContain("Alpha");

    await user.click(screen.getByRole("combobox", { name: "spools.sortLabel" }));
    await user.click(screen.getByRole("option", { name: "spools.sortName" }));
    expect(names()[0]).toContain("Zulu");

    await user.click(screen.getByRole("button", { name: "spools.sortDesc" }));
    expect(names()[0]).toContain("Alpha");
  });

  it("shows the inventory empty state", () => {
    render(<SpoolShelf />);

    expect(screen.getByText("spools.emptyTitle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "spools.emptyAction" }),
    ).toBeInTheDocument();
  });

  it("shows a distinct state when filters match nothing", async () => {
    setSpools([makeSpool()]);
    render(<SpoolShelf />);

    await user.type(
      screen.getByRole("searchbox", { name: "spools.searchPlaceholder" }),
      "no match",
    );

    expect(screen.getByText("spools.filteredEmptyTitle")).toBeInTheDocument();
  });

  it("shows explicit gross/net weights, meters, editable tare, and status", () => {
    setSpools([
      makeSpool({
        weightGrams: 50,
        originalWeightGrams: 1000,
        tareGrams: 200,
      }),
    ]);
    render(<SpoolShelf />);

    expect(screen.getByText("spools.grossWeight")).toBeInTheDocument();
    expect(screen.getByText("inventory.netFilamentWeight")).toBeInTheDocument();
    expect(screen.getByText("spools.lowStock")).toBeInTheDocument();
    expect(screen.getAllByText("spools.statusInStock")).toHaveLength(2);
    expect(screen.getByTestId("net-remaining-spool-1")).toHaveTextContent(
      "0g",
    );
    expect(screen.getByTestId("net-remaining-spool-1")).toHaveTextContent("m");

    const tare = screen.getByTestId("tare-input-spool-1");
    expect(tare).toHaveValue("200");
    fireEvent.change(tare, { target: { value: "150" } });
    fireEvent.blur(tare);
    expect(useSpoolStore.getState().spools[0]?.tareGrams).toBe(150);
  });

  it("exposes remaining filament as an accessible progressbar", () => {
    setSpools([makeSpool({ weightGrams: 250, originalWeightGrams: 1000 })]);
    render(<SpoolShelf />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress).toHaveAttribute("aria-valuenow", "25");
    expect(progress).toHaveAttribute(
      "aria-valuetext",
      "spools.remainingProgress",
    );
  });

  it("closes the form with Escape", async () => {
    render(<SpoolShelf />);
    const dialog = await openForm();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "spools.newSpool" }),
    ).not.toBeInTheDocument();
  });

  it("closes the form by clicking the backdrop", async () => {
    render(<SpoolShelf />);
    const dialog = await openForm();

    await user.click(dialog.parentElement as HTMLElement);

    expect(
      screen.queryByRole("dialog", { name: "spools.newSpool" }),
    ).not.toBeInTheDocument();
  });

  it("shows validation errors and does not submit invalid data", async () => {
    render(<SpoolShelf />);
    const dialog = await openForm();

    await user.clear(within(dialog).getByLabelText("spools.form.weight"));
    await user.clear(
      within(dialog).getByLabelText("spools.form.originalWeight"),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "spools.form.save" }),
    );

    expect(screen.getByText("spools.form.errBrand")).toBeInTheDocument();
    expect(screen.getByText("spools.form.errColor")).toBeInTheDocument();
    expect(screen.getByText("spools.form.errWeight")).toBeInTheDocument();
    expect(screen.getByText("spools.form.errOriginal")).toBeInTheDocument();
    expect(useSpoolStore.getState().spools).toHaveLength(0);
  });

  it("removes entry animation when reduced motion is preferred", async () => {
    motionPreference.reduced = true;
    render(<SpoolShelf />);
    const dialog = await openForm();

    expect(dialog.closest("[data-motion-duration]")).toHaveAttribute(
      "data-motion-duration",
      "0",
    );
  });

  it("renders a circular swatch and surfaces the real filament color", () => {
    setSpools([makeSpool({ color: "Vermelho", colorHex: "#ef4444" })]);
    render(<SpoolShelf />);

    const card = screen.getByRole("article", { name: "Vermelho" });
    expect(within(card).getByTestId("spool-thumb")).toHaveClass("rounded-full");
    expect(within(card).getByTestId("spool-color-spool-1")).toHaveStyle({
      backgroundColor: "#ef4444",
    });
    expect(within(card).getByText("#ef4444")).toBeInTheDocument();
  });
});
