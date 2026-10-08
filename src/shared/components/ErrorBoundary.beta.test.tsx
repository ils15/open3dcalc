import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));

import { ErrorBoundary } from "./ErrorBoundary";

function Thrower(): never {
  throw new Error("synthetic beta boundary failure");
}

const STABLE_CANARY_KEY = "open3dcalc_customers_v1";
const STABLE_CANARY_VALUE = '{"customers":[]}';
const STABLE_THEME_KEY = "open3dcalc_theme";
const BETA_KEYS = [
  "open3dcalc_beta_test_customers_v1",
  "open3dcalc_beta_test_quotes_v1",
  "open3dcalc_beta_test_history_v1",
] as const;

describe("ErrorBoundary Beta cache reset", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    // Silence the expected boundary error; jsdom would otherwise print it.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Avoid a real navigation; jsdom's reload is a no-op stub target.
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  it("clears only the three beta_test keys and keeps Stable canaries", () => {
    window.localStorage.setItem(STABLE_CANARY_KEY, STABLE_CANARY_VALUE);
    window.localStorage.setItem(STABLE_THEME_KEY, "dark");
    window.sessionStorage.setItem(STABLE_CANARY_KEY, STABLE_CANARY_VALUE);
    for (const key of BETA_KEYS) {
      window.localStorage.setItem(key, "synthetic-beta-payload");
    }

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    const resetButton = screen.getByRole("button", {
      name: "Limpar Cache Local",
    });
    fireEvent.click(resetButton);

    for (const key of BETA_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    expect(window.localStorage.getItem(STABLE_CANARY_KEY)).toBe(
      STABLE_CANARY_VALUE,
    );
    expect(window.localStorage.getItem(STABLE_THEME_KEY)).toBe("dark");
    expect(window.sessionStorage.getItem(STABLE_CANARY_KEY)).toBe(
      STABLE_CANARY_VALUE,
    );
    expect(window.location.reload).toHaveBeenCalled();
  });
});
