/**
 * F1 — the `calc-basico` tour must be FUNCTIONAL on the surface the app
 * actually renders, not merely gated to it.
 *
 * The previous state of the code mounted `<Tutorial />` whenever
 * `layoutMode === "classic"`, and `StudioLayout` is the render root for every
 * layout mode. The gate was internally consistent (mount, auto-start and the
 * runtime re-check in `useAppInit` all keyed off `layoutMode === "classic"`),
 * but the previous reduced Studio calculator carried ZERO `data-tutorial`
 * anchors. The tour therefore ran steps that spotlighted controls not on
 * screen.
 *
 * This spec is the anti-regression lock for that fix. Two properties, both
 * rendered from the REAL render root (`App` → `StudioLayout` →
 * `CalculatorSurface`, no Studio mocks, no fake anchor harness):
 *
 *  1. Every anchored step of the tour has a real, visible anchor in the DOM.
 *     Data-driven off the registry, so a NEW anchored step added to
 *     `TOURS` without a Studio anchor fails here too.
 *  2. The engine actually SPOTLIGHTS those steps — `Tutorial` resolves a
 *     non-degenerate rect for the anchor and renders the overlay instead of
 *     degrading to a centered card with `showOverlay = false`.
 *
 * (2) is what the review could not establish from static reachability
 * analysis: it is observed behaviour of the real component tree.
 */

import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/shared/i18n/i18n";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import App from "./App";
import { DEFAULT_TOUR, TOURS } from "@/shared/components/ui/tutorialTours";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useConsentStore } from "@/shared/stores/consentStore";

// The tutorial is intentionally paused by the beta first-run modal. This spec
// exercises the stable Studio path where the tutorial is available in place.
vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

// The real i18next instance (side-effectful import) so the assertions can pin
// the user-visible copy the tour shows in this surface. jsdom resolves the
// language from `navigator.language`, so the bundle is picked at run time
// rather than hard-coded.
void i18n;

type Bundle = typeof ptBR;

function bundle(): Bundle {
  return (i18n.resolvedLanguage ?? i18n.language).startsWith("pt")
    ? ptBR
    : (enUS as Bundle);
}

function stepTitle(key: string): string {
  const steps = bundle().tutorial.steps as Record<string, { title: string }>;
  return steps[key].title;
}

function nextLabel(): string {
  return bundle().tutorial.next;
}

// jsdom has no layout engine: `scrollIntoView` is absent (the engine calls it
// the instant an anchor resolves) and every `getBoundingClientRect()` is a
// zero-rect. The engine treats a zero-size target as NOT FOUND
// (`findVisibleTarget`), so a non-zero rect stub is what makes the spotlight
// observable at all — without it the test could not tell "anchor missing"
// apart from "jsdom has no boxes", and would pass vacuously.
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

const NON_ZERO_RECT: DOMRect = {
  x: 40,
  y: 60,
  width: 320,
  height: 180,
  top: 60,
  left: 40,
  right: 360,
  bottom: 240,
  toJSON: () => ({}),
} as DOMRect;

beforeEach(async () => {
  localStorage.clear();
  useLayoutStore.setState({ layoutMode: "classic" });

  // Consent FIRST, before any render. The tour is only ever meant to run for a
  // returning user: `useAppInit` gates auto-start behind
  // `open3dcalc_onboarded`, and onboarding sits behind the default-deny consent
  // modal. On a cold store that modal is a live `aria-modal="true"` dialog, and
  // the Tutorial's modal-pause observer (`Tutorial.tsx:545-561`) responds to it
  // with `skipTutorial()` — by design, not a bug. Granting consent through the
  // store's own `giveConsent()` puts the tree in the state production is in when
  // the tour fires, and it is not a mock: nothing is stubbed, the modal simply
  // never mounts.
  await useConsentStore.getState().giveConsent();

  useTutorialStore.setState({
    isActive: false,
    isCompleted: false,
    activeTour: DEFAULT_TOUR,
    currentStep: 1,
    completedSteps: [],
    completedTours: [],
    sessionDismissed: false,
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => NON_ZERO_RECT,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Anchored steps of the tour under test, in registry order. */
function anchoredSteps() {
  return TOURS[DEFAULT_TOUR].filter(
    (step): step is typeof step & { target: string } => step.target !== null,
  );
}

/**
 * The Tutorial card, found through the engine's OWN disambiguation hook.
 *
 * `Tutorial.tsx` marks its card `data-tutorial="true"` precisely so the
 * modal-pause observer can exclude it (`Tutorial.tsx:550`). Reusing that hook is
 * what keeps this spec about the tour: on a cold store the first-run CONSENT
 * modal is also `role="dialog" aria-modal="true"`, so a bare
 * `getByRole("dialog")` matches both and throws "Found multiple elements".
 * That ambiguity is a defect in the query, not in the surface — and the layering
 * is fine (`--z-tour: 55` > the consent modal's `z-50`), so the tour really is
 * the thing the user sees on top.
 */
function tutorialCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>(
    '[role="dialog"][data-tutorial="true"]',
  );
  if (!card) throw new Error("tutorial card is not mounted");
  return card;
}

describe("calc-basico anchors on the real Studio surface", () => {
  it("is the tour the app can fire on this surface", () => {
    // Guards the premise of this spec: if the auto-start tour ever changes,
    // the anchors below must follow it.
    expect(DEFAULT_TOUR).toBe("calc-basico");
    expect(anchoredSteps().map((s) => s.key)).toEqual([
      "material",
      "print",
      "sales",
      "results",
      "export",
    ]);
  });

  it("renders a visible anchor for every anchored step of the tour", () => {
    render(<App />);

    // The shared Classic calculator must be the thing on screen.
    expect(screen.getByTestId("calculator-inputs")).toBeInTheDocument();

    const missing = anchoredSteps()
      .filter((step) => document.querySelectorAll(step.target).length === 0)
      .map((step) => `${step.key} → ${step.target}`);

    expect(
      missing,
      `calc-basico steps without a Studio anchor: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("spotlights every anchored step instead of degrading to a bare card", async () => {
    render(<App />);

    // ConfirmDialog keeps its close animation mounted for 200ms after the
    // initial closed render. Let that transient DOM state settle before the
    // tutorial's modal guard is exercised.
    await vi.waitFor(
      () => {
        expect(
          document.querySelector(
            '[role="dialog"][aria-modal="true"]:not([data-tutorial="true"])',
          ),
        ).toBeNull();
      },
      { timeout: 1000 },
    );

    act(() => {
      useTutorialStore.getState().startTour(DEFAULT_TOUR);
    });

    // Step 1 (welcome) is a centered card: no anchor by design.
    await vi.waitFor(
      () => {
        expect(tutorialCard()).toHaveAccessibleName(stepTitle("welcome"));
      },
      { timeout: 3000 },
    );

    for (const step of anchoredSteps()) {
      fireEvent.click(
        within(tutorialCard()).getByRole("button", { name: nextLabel() }),
      );

      // The copy the step promises must be the card on screen…
      await vi.waitFor(
        () => {
          expect(tutorialCard()).toHaveAccessibleName(stepTitle(step.key));
        },
        { timeout: 3000 },
      );

      // …AND the engine must have resolved a rect: `missing: true` sets
      // `showOverlay = false`, so a visible overlay is the observable proof
      // that the anchor was found on this surface.
      await vi.waitFor(
        () => {
          expect(
            document.querySelector('[data-testid="tutorial-overlay"]'),
            `step "${step.key}" degraded: no spotlight overlay rendered`,
          ).not.toBeNull();
        },
        { timeout: 3000 },
      );

      // The anchor the engine resolved is the real Studio control.
      expect(
        document.querySelector(step.target),
        `step "${step.key}" anchor ${step.target} vanished`,
      ).not.toBeNull();
    }
  });
});
