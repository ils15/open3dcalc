import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuideDrawer } from "../GuideDrawer";
import { GUIDE_AREAS, getAreaTours } from "../guideAreas";

const mockStartTour = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "pt-BR", resolvedLanguage: "pt-BR" },
  }),
}));

vi.mock("@/shared/stores/tutorialStore", () => ({
  useTutorialStore: Object.assign(
    (selector?: (state: { startTour: typeof mockStartTour }) => unknown) => {
      const state = { startTour: mockStartTour };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ startTour: mockStartTour }) },
  ),
}));

/** Areas whose tours have registered steps today (see guideAreas.AREA_TOURS). */
const AREAS_WITH_TOUR = GUIDE_AREAS.filter((a) => getAreaTours(a).length > 0);
const AREAS_WITHOUT_TOUR = GUIDE_AREAS.filter(
  (a) => getAreaTours(a).length === 0,
);

describe("GuideDrawer", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one card for each of the 20 guide areas", async () => {
    render(<GuideDrawer />);

    expect(GUIDE_AREAS).toHaveLength(20);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));

    for (const area of GUIDE_AREAS) {
      expect(screen.getByText(`guide.${area}.title`)).toBeInTheDocument();
    }
  });

  it("exposes dialog semantics on the trigger", () => {
    render(<GuideDrawer />);
    const trigger = screen.getByRole("button", { name: "nav.wiki" });

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.getAttribute("aria-controls")).toMatch(/guide-drawer/);
  });

  it("marks the drawer as a labelled modal dialog", async () => {
    render(<GuideDrawer />);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("renders the tour CTA only in areas with an available tour", async () => {
    render(<GuideDrawer />);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));

    // Every tour-backed area exposes its CTA…
    for (const area of AREAS_WITH_TOUR) {
      expect(
        screen.getByRole("button", { name: new RegExp(`guide.${area}.cta`) }),
      ).toBeInTheDocument();
    }

    // …and areas without a tour expose none (no dead button).
    for (const area of AREAS_WITHOUT_TOUR) {
      expect(
        screen.queryByRole("button", {
          name: new RegExp(`guide.${area}.cta`),
        }),
      ).not.toBeInTheDocument();
    }
  });

  it("launches the single registered tour directly from the CTA", async () => {
    render(<GuideDrawer />);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));

    // inventory → inventario-bobinas (single tour: direct launch)
    await user.click(
      screen.getByRole("button", { name: /guide\.inventory\.cta/ }),
    );

    expect(mockStartTour).toHaveBeenCalledWith("inventario-bobinas");
    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });

  it("expands a picker for the area with two tours and launches the chosen one", async () => {
    render(<GuideDrawer />);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));

    // calculator owns calc-basico + upload-3d-preview → CTA is a disclosure.
    const cta = screen.getByRole("button", { name: /guide\.calculator\.cta/ });
    expect(cta).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("tutorial.tours.calc-basico.title"),
    ).not.toBeInTheDocument();

    await user.click(cta);
    expect(cta).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("tutorial.tours.calc-basico.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("tutorial.tours.upload-3d-preview.title"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /tutorial\.tours\.calc-basico\.title/,
      }),
    );

    expect(mockStartTour).toHaveBeenCalledWith("calc-basico");
    expect(mockStartTour).not.toHaveBeenCalledWith("upload-3d-preview");
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    render(<GuideDrawer />);
    const trigger = screen.getByRole("button", { name: "nav.wiki" });

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on outside click", async () => {
    render(<GuideDrawer />);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes via the drawer's explicit close button", async () => {
    render(<GuideDrawer />);
    await user.click(screen.getByRole("button", { name: "nav.wiki" }));

    await user.click(screen.getByRole("button", { name: "common.close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts no tour for areas without one", () => {
    expect(AREAS_WITHOUT_TOUR.length).toBeGreaterThan(0);
    // history/changelog/privacy are the canonical tour-less examples.
    expect(getAreaTours("history")).toHaveLength(0);
    expect(getAreaTours("changelog")).toHaveLength(0);
    expect(getAreaTours("privacy")).toHaveLength(0);
  });
});
