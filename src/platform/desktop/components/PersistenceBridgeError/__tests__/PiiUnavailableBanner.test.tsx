// @vitest-environment jsdom

/**
 * Per-key unreadable-data disclosure, after legacy recovery was permanently
 * disabled.
 *
 * `privacy:recover-key` is rejected by the main process and is no longer exposed
 * through the preload bridge (see `electron/__tests__/preloadContract.test.ts`),
 * so this surface must not offer a "Recover now" action that can never succeed.
 * It still discloses the key NAMES and the main process's refusal codes — what a
 * bug report needs — plus an explicit unavailability note.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  latchUnavailableClasses,
  resetUnavailableClassesForTests,
} from "@/platform/desktop/overrides/unavailableClasses";
import { PiiUnavailableBanner } from "../PersistenceBridgeError";

vi.mock("react-i18next", () => ({
  // Identity `t` that PRESERVES interpolation, so an interpolated reason is
  // still visible to the assertions (a bare key-echo would drop it).
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${Object.values(opts).join("|")}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

afterEach(() => {
  resetUnavailableClassesForTests();
  vi.unstubAllGlobals();
});

describe("PiiUnavailableBanner — recovery is permanently disabled", () => {
  it("discloses codes and the unavailability note without a dead recovery action", () => {
    latchUnavailableClasses([
      {
        key: "open3dcalc_customers_v1",
        reason: "legacy_unbound_encryption",
        recoverable: true,
      },
    ]);
    // If the component still reached for the removed channel, this spy would
    // fire; it must never be touched.
    const recoverKey = vi.fn();
    vi.stubGlobal("electronAPI", { privacy: { recoverKey } });

    render(<PiiUnavailableBanner />);

    const text = document.body.textContent ?? "";
    expect(text).toContain("open3dcalc_customers_v1");
    expect(text).toContain("legacy_unbound_encryption");
    expect(text).toContain("persistence.recovery.unavailable");

    expect(
      screen.queryByRole("button", {
        name: "persistence.recovery.recoverAction",
      }),
    ).toBeNull();
    // The only controls are dismissals — no recovery action remains.
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(recoverKey).not.toHaveBeenCalled();
  });
});
