import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { GuideDrawer } from "../GuideDrawer";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

/**
 * Regression guard for the v1.14.0-beta.2 black-screen crash (React #185).
 *
 * `GuideDrawer` mounts unconditionally in the always-visible `Header` (the
 * "button" variant), so it renders on the very first pass of the app. Its
 * `tutorialStore` selector must return a *cached* value: zustand v5 subscribes
 * through `useSyncExternalStore`, and React re-renders forever when
 * `getSnapshot` hands back a fresh reference every call. An object-returning
 * selector — `(s) => ({ startTour: s.startTour })` — produced a new object on
 * every snapshot, so React bailed out with "Maximum update depth exceeded"
 * during the initial render, left `#root` empty, and painted nothing.
 *
 * The sibling `GuideDrawer.test.tsx` mocks the whole store, which is why it
 * never exercised the real subscription and let the loop ship. This suite
 * deliberately uses the real store.
 */
describe("GuideDrawer / real store subscription", () => {
  it("renders without an infinite update loop (React #185)", () => {
    // No tutorialStore mock: the real zustand v5 useSyncExternalStore path is
    // the thing under test. Before the fix this render threw
    // "Maximum update depth exceeded".
    render(<GuideDrawer />);

    expect(
      screen.getByRole("button", { name: "nav.wiki" }),
    ).toBeInTheDocument();
  });

  it("the startTour selector returns a stable reference across snapshots", () => {
    // The loop's mechanism, asserted directly: a selector must not mint a new
    // object per call. `startTour` is a store action, so the field selector
    // returns the same function every time.
    const select = (s: { startTour: unknown }) => s.startTour;
    const first = select(useTutorialStore.getState());
    const second = select(useTutorialStore.getState());

    expect(first).toBe(second);
  });
});
