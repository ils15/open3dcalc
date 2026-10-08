/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { isBetaElectronRuntime } from "../betaRuntime.js";

describe("Beta Electron runtime boundary", () => {
  it("enables the restricted runtime only for the exact true flag", () => {
    expect(isBetaElectronRuntime({ VITE_BETA_CHANNEL: "true" })).toBe(true);
    expect(isBetaElectronRuntime({ VITE_BETA_CHANNEL: "false" })).toBe(false);
    expect(isBetaElectronRuntime({ VITE_BETA_CHANNEL: "1" })).toBe(false);
    expect(isBetaElectronRuntime({})).toBe(false);
  });
});
